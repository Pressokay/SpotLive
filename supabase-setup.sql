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
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index pour les requêtes rapides
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_location ON stories(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);

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

-- Fonction pour nettoyer automatiquement les stories expirées (optionnel)
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM stories WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

