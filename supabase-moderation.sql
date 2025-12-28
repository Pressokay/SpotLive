-- ============================================
-- Système de Modération - SpotLive
-- ============================================
-- Exécutez ce script dans Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Ajouter colonnes de modération à la table stories
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS reports_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS hidden_reason TEXT;

-- Index pour les requêtes de modération
CREATE INDEX IF NOT EXISTS idx_stories_is_hidden ON stories(is_hidden);
CREATE INDEX IF NOT EXISTS idx_stories_reports_count ON stories(reports_count);
CREATE INDEX IF NOT EXISTS idx_stories_active_not_hidden ON stories(expires_at, is_hidden) 
  WHERE expires_at > NOW() AND is_hidden = FALSE;

-- 2. Table pour les signalements
CREATE TABLE IF NOT EXISTS story_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL, -- 'spam', 'inappropriate', 'off_topic', 'other'
  details TEXT, -- Détails optionnels
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Contrainte d'unicité : un user ne peut signaler qu'une fois une story
  UNIQUE(story_id, user_id)
);

-- Index pour les requêtes rapides
CREATE INDEX IF NOT EXISTS idx_story_reports_story_id ON story_reports(story_id);
CREATE INDEX IF NOT EXISTS idx_story_reports_user_id ON story_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_story_reports_composite ON story_reports(story_id, user_id);
CREATE INDEX IF NOT EXISTS idx_story_reports_created_at ON story_reports(created_at DESC);

-- RLS pour story_reports
ALTER TABLE story_reports ENABLE ROW LEVEL SECURITY;

-- Politique: Tout le monde peut créer des signalements
CREATE POLICY "Anyone can create reports" ON story_reports
  FOR INSERT WITH CHECK (true);

-- Politique: Les admins peuvent lire tous les signalements (à implémenter plus tard)
-- Pour l'instant, personne ne peut lire les signalements (sécurité)

-- 3. Trigger pour incrémenter reports_count automatiquement
CREATE OR REPLACE FUNCTION increment_story_reports()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE stories
  SET reports_count = reports_count + 1
  WHERE id = NEW.story_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_reports
AFTER INSERT ON story_reports
FOR EACH ROW
EXECUTE FUNCTION increment_story_reports();

-- 4. Trigger pour masquer automatiquement après 3 signalements
CREATE OR REPLACE FUNCTION auto_hide_story_on_reports()
RETURNS TRIGGER AS $$
DECLARE
  current_reports_count INTEGER;
BEGIN
  -- Récupérer le nombre actuel de signalements
  SELECT reports_count INTO current_reports_count
  FROM stories
  WHERE id = NEW.story_id;
  
  -- Si >= 3 signalements, masquer automatiquement
  IF current_reports_count >= 3 AND current_reports_count < 10 THEN
    UPDATE stories
    SET 
      is_hidden = TRUE,
      hidden_at = NOW(),
      hidden_reason = 'Auto-hidden: ' || current_reports_count || ' reports'
    WHERE id = NEW.story_id;
  END IF;
  
  -- Si >= 10 signalements, masquer définitivement (pour éviter les abus)
  IF current_reports_count >= 10 THEN
    UPDATE stories
    SET 
      is_hidden = TRUE,
      hidden_at = NOW(),
      hidden_reason = 'Auto-hidden: ' || current_reports_count || ' reports (abuse threshold)'
    WHERE id = NEW.story_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_hide_on_reports
AFTER INSERT ON story_reports
FOR EACH ROW
EXECUTE FUNCTION auto_hide_story_on_reports();

-- 5. Fonction RPC pour signaler une story (avec vérification d'unicité)
CREATE OR REPLACE FUNCTION report_story(
  p_story_id TEXT,
  p_user_id UUID,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_report_id UUID;
  v_reports_count INTEGER;
  v_is_hidden BOOLEAN;
BEGIN
  -- Vérifier si l'utilisateur a déjà signalé cette story
  IF EXISTS (
    SELECT 1 FROM story_reports 
    WHERE story_id = p_story_id AND user_id = p_user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Already reported',
      'message', 'Vous avez déjà signalé cette story'
    );
  END IF;
  
  -- Vérifier que la story existe et n'est pas expirée
  IF NOT EXISTS (
    SELECT 1 FROM stories 
    WHERE id = p_story_id AND expires_at > NOW()
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Story not found or expired',
      'message', 'Cette story n''existe plus ou a expiré'
    );
  END IF;
  
  -- Créer le signalement
  INSERT INTO story_reports (story_id, user_id, reason, details)
  VALUES (p_story_id, p_user_id, p_reason, p_details)
  RETURNING id INTO v_report_id;
  
  -- Récupérer le nombre de signalements et l'état
  SELECT reports_count, is_hidden 
  INTO v_reports_count, v_is_hidden
  FROM stories
  WHERE id = p_story_id;
  
  -- Retourner le résultat
  RETURN json_build_object(
    'success', true,
    'report_id', v_report_id,
    'reports_count', v_reports_count,
    'is_hidden', v_is_hidden,
    'message', CASE 
      WHEN v_is_hidden THEN 'Story masquée automatiquement'
      WHEN v_reports_count >= 2 THEN 'Encore ' || (3 - v_reports_count) || ' signalement(s) avant masquage'
      ELSE 'Signalement enregistré'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fonction pour obtenir les raisons de signalement disponibles
CREATE OR REPLACE FUNCTION get_report_reasons()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_array(
    json_build_object('value', 'spam', 'label', 'Spam'),
    json_build_object('value', 'inappropriate', 'label', 'Contenu inapproprié'),
    json_build_object('value', 'off_topic', 'label', 'Hors sujet'),
    json_build_object('value', 'harassment', 'label', 'Harcèlement'),
    json_build_object('value', 'other', 'label', 'Autre')
  );
END;
$$ LANGUAGE plpgsql;

-- 7. Commentaires pour documentation
COMMENT ON TABLE story_reports IS 'Table des signalements de stories par les utilisateurs';
COMMENT ON COLUMN stories.reports_count IS 'Nombre de signalements reçus';
COMMENT ON COLUMN stories.is_hidden IS 'True si la story est masquée (>= 3 signalements)';
COMMENT ON COLUMN stories.hidden_at IS 'Date de masquage automatique';
COMMENT ON COLUMN stories.hidden_reason IS 'Raison du masquage';
COMMENT ON FUNCTION report_story IS 'Fonction pour signaler une story avec vérifications';
COMMENT ON FUNCTION get_report_reasons IS 'Retourne la liste des raisons de signalement disponibles';

