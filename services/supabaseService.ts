import { createClient } from '@supabase/supabase-js';
import { Story, User } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types pour Supabase
export interface SupabaseStory {
  id: string;
  user_id: string;
  username: string;
  user_avatar: string;
  image_url: string;
  video_url?: string;
  caption: string;
  vibe_tags: string[];
  latitude: number;
  longitude: number;
  location_name: string;
  likes: number;
  created_at: string;
  expires_at: string;
}

export interface SupabaseUser {
  id: string;
  username: string;
  avatar_url: string;
  created_at: string;
}

// Convertir Story (app) vers SupabaseStory
export const storyToSupabase = (story: Story): SupabaseStory => ({
  id: story.id,
  user_id: story.userId,
  username: story.username,
  user_avatar: story.userAvatar,
  image_url: story.imageUrl,
  video_url: story.videoUrl,
  caption: story.caption,
  vibe_tags: story.vibeTags,
  latitude: story.latitude,
  longitude: story.longitude,
  location_name: story.locationName,
  likes: story.likes || 0,
  created_at: new Date(story.timestamp).toISOString(),
  expires_at: new Date(story.expiresAt).toISOString(),
});

// Convertir SupabaseStory vers Story (app)
export const supabaseToStory = (sb: SupabaseStory): Story => ({
  id: sb.id,
  userId: sb.user_id,
  username: sb.username,
  userAvatar: sb.user_avatar,
  imageUrl: sb.image_url,
  videoUrl: sb.video_url,
  timestamp: new Date(sb.created_at).getTime(),
  caption: sb.caption,
  vibeTags: sb.vibe_tags,
  expiresAt: new Date(sb.expires_at).getTime(),
  latitude: sb.latitude,
  longitude: sb.longitude,
  locationName: sb.location_name,
  likes: sb.likes,
});

// Fonctions API pour les stories
export const storiesService = {
  // Récupérer toutes les stories actives
  async getActiveStories(): Promise<Story[]> {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .gt('expires_at', now)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching stories:', error);
        return [];
      }
      
      return (data || []).map(supabaseToStory);
    } catch (error) {
      console.error('Error fetching stories:', error);
      return [];
    }
  },

  // Créer une nouvelle story
  async createStory(story: Story): Promise<Story | null> {
    try {
      const sbStory = storyToSupabase(story);
      const { data, error } = await supabase
        .from('stories')
        .insert([sbStory])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating story:', error);
        return null;
      }
      
      return supabaseToStory(data);
    } catch (error) {
      console.error('Error creating story:', error);
      return null;
    }
  },

  // Supprimer une story
  async deleteStory(storyId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId)
        .eq('user_id', userId);
      
      return !error;
    } catch (error) {
      console.error('Error deleting story:', error);
      return false;
    }
  },

  // Liker/Unliker une story
  async toggleLike(storyId: string, increment: number): Promise<boolean> {
    try {
      // Récupérer le nombre de likes actuel
      const { data: story } = await supabase
        .from('stories')
        .select('likes')
        .eq('id', storyId)
        .single();
      
      if (!story) return false;
      
      // Mettre à jour les likes
      const { error } = await supabase
        .from('stories')
        .update({ likes: story.likes + increment })
        .eq('id', storyId);
      
      return !error;
    } catch (error) {
      console.error('Error toggling like:', error);
      return false;
    }
  },
};

// Service pour les users anonymes
export const usersService = {
  // Créer un user anonyme
  async createAnonymousUser(username: string, avatarUrl: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([{ username, avatar_url: avatarUrl }])
        .select('id')
        .single();
      
      if (error) {
        console.error('Error creating user:', error);
        return null;
      }
      
      return data.id;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  },

  // Récupérer un user
  async getUser(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error || !data) return null;
      
      return {
        id: data.id,
        username: data.username,
        avatarUrl: data.avatar_url,
        isGuest: false,
      };
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  },
};

