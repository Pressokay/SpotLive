-- ============================================
-- Setup Supabase pour SpotLive
-- ============================================
-- Exécutez ce script dans Supabase Dashboard > SQL Editor
-- ============================================

-- Table users (anonymes)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table stories
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  user_avatar TEXT NOT NULL,
  image_url TEXT NOT NULL,
  video_url TEXT,
  caption TEXT NOT NULL,
  vibe_tags TEXT[] DEFAULT '{}',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_name TEXT NOT NULL,
  country_code TEXT NOT NULL, -- ISO 3166-1 alpha-2 (ex: 'FR', 'GN', 'US')
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index pour les requêtes rapides
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_location ON stories(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_country_code ON stories(country_code);
-- Index composite pour filtrage par pays + expiration (performance optimale)
CREATE INDEX IF NOT EXISTS idx_stories_country_expires ON stories(country_code, expires_at) WHERE expires_at > NOW();

-- RLS (Row Level Security) - Permettre lecture publique, écriture authentifiée
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- Politique: Tout le monde peut lire les stories actives
CREATE POLICY "Anyone can read active stories" ON stories
  FOR SELECT USING (expires_at > NOW());

-- Politique: Tout le monde peut créer des stories
CREATE POLICY "Anyone can create stories" ON stories
  FOR INSERT WITH CHECK (true);

-- Politique: Les users peuvent supprimer leurs propres stories
CREATE POLICY "Users can delete own stories" ON stories
  FOR DELETE USING (true);

-- Politique: Tout le monde peut mettre à jour les likes
CREATE POLICY "Anyone can update likes" ON stories
  FOR UPDATE USING (true);

-- Politique: Tout le monde peut créer des users
CREATE POLICY "Anyone can create users" ON users
  FOR INSERT WITH CHECK (true);

-- Politique: Tout le monde peut lire les users
CREATE POLICY "Anyone can read users" ON users
  FOR SELECT USING (true);

-- Table story_likes pour tracker les likes (contrainte d'unicité)
CREATE TABLE IF NOT EXISTS story_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Contrainte d'unicité : un user ne peut liker qu'une fois une story
  UNIQUE(story_id, user_id)
);

-- Index pour les requêtes rapides
CREATE INDEX IF NOT EXISTS idx_story_likes_story_id ON story_likes(story_id);
CREATE INDEX IF NOT EXISTS idx_story_likes_user_id ON story_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_story_likes_composite ON story_likes(story_id, user_id);

-- RLS pour story_likes
ALTER TABLE story_likes ENABLE ROW LEVEL SECURITY;

-- Politique: Tout le monde peut lire les likes
CREATE POLICY "Anyone can read likes" ON story_likes
  FOR SELECT USING (true);

-- Politique: Tout le monde peut créer des likes (la contrainte UNIQUE empêche les doublons)
CREATE POLICY "Anyone can create likes" ON story_likes
  FOR INSERT WITH CHECK (true);

-- Politique: Les users peuvent supprimer leurs propres likes
CREATE POLICY "Users can delete own likes" ON story_likes
  FOR DELETE USING (true);

-- Fonction pour incrémenter/décrémenter les likes de manière atomique
CREATE OR REPLACE FUNCTION increment_story_likes(story_id TEXT, increment INTEGER)
RETURNS TABLE(likes INTEGER) AS $$
BEGIN
  UPDATE stories 
  SET likes = GREATEST(0, likes + increment)
  WHERE id = story_id;
  
  RETURN QUERY
  SELECT stories.likes FROM stories WHERE stories.id = story_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour maintenir le compteur de likes synchronisé (optionnel mais recommandé)
CREATE OR REPLACE FUNCTION update_story_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE stories SET likes = likes + 1 WHERE id = NEW.story_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE stories SET likes = GREATEST(0, likes - 1) WHERE id = OLD.story_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers
DROP TRIGGER IF EXISTS trigger_update_likes_on_insert ON story_likes;
CREATE TRIGGER trigger_update_likes_on_insert
  AFTER INSERT ON story_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_story_likes_count();

DROP TRIGGER IF EXISTS trigger_update_likes_on_delete ON story_likes;
CREATE TRIGGER trigger_update_likes_on_delete
  AFTER DELETE ON story_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_story_likes_count();

-- Fonction pour nettoyer automatiquement les stories expirées (optionnel)
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM stories WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

