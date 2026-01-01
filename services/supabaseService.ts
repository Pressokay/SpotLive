import { createClient } from '@supabase/supabase-js';
import { Story, User } from '../types';
import { getCountryName } from './countryService';

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
  country_code: string; // ISO 3166-1 alpha-2
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
  country_code: story.countryCode || 'XX', // Fallback si non défini
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
  countryCode: sb.country_code,
  likes: sb.likes,
});

// Fonction pour incrémenter les likes de manière atomique
const incrementStoryLikes = async (storyId: string, increment: number) => {
  const { data, error } = await supabase.rpc('increment_story_likes', {
    story_id: storyId,
    increment
  });
  
  if (error) throw error;
  return data;
};

// Fonctions API pour les stories
export const storiesService = {
  // Récupérer les stories actives, filtrées par pays (optionnel) et non masquées
  async getActiveStories(countryCode?: string | null): Promise<Story[]> {
    try {
      const now = new Date().toISOString();
      let query = supabase
        .from('stories')
        .select('*')
        .gt('expires_at', now)
        .eq('is_hidden', false); // Exclure les stories masquées
      
      // Filtrer par pays si spécifié
      if (countryCode && countryCode !== 'ALL') {
        query = query.eq('country_code', countryCode);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
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

  // Récupérer la liste des pays disponibles (avec compteur de stories)
  async getAvailableCountries(): Promise<Array<{ code: string; name: string; count: number }>> {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('stories')
        .select('country_code')
        .gt('expires_at', now);
      
      if (error) {
        console.error('Error fetching countries:', error);
        return [];
      }
      
      // Compter les stories par pays
      const countryCounts: Record<string, number> = {};
      data?.forEach(story => {
        if (story.country_code) {
          countryCounts[story.country_code] = (countryCounts[story.country_code] || 0) + 1;
        }
      });
      
      // Convertir en array avec noms de pays
      return Object.entries(countryCounts)
        .map(([code, count]) => ({
          code,
          name: getCountryName(code),
          count
        }))
        .sort((a, b) => b.count - a.count); // Trier par nombre de stories
    } catch (error) {
      console.error('Error fetching countries:', error);
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

  // Liker/Unliker une story (avec contrainte d'unicité en base)
  async toggleLike(storyId: string, userId: string): Promise<{ likes: number; hasLiked: boolean } | null> {
    try {
      // Vérifier si l'utilisateur a déjà liké cette story
      const { data: existingLike, error: checkError } = await supabase
        .from('story_likes')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking like:', checkError);
        return null;
      }
      
      let hasLiked = false;
      
      if (existingLike) {
        // Supprimer le like existant (unlike)
        // Le trigger mettra à jour automatiquement le compteur
        const { error: deleteError } = await supabase
          .from('story_likes')
          .delete()
          .eq('id', existingLike.id);
        
        if (deleteError) {
          console.error('Error deleting like:', deleteError);
          return null;
        }
        hasLiked = false;
      } else {
        // Ajouter un nouveau like
        // La contrainte UNIQUE empêche les doublons même en cas de race condition
        // Le trigger mettra à jour automatiquement le compteur
        const { error: insertError } = await supabase
          .from('story_likes')
          .insert({
            story_id: storyId,
            user_id: userId
          });
        
        if (insertError) {
          // Si erreur d'unicité (23505), c'est qu'un like existe déjà (race condition)
          if (insertError.code === '23505') {
            // Récupérer l'état actuel depuis la base
            const { data: story } = await supabase
              .from('stories')
              .select('likes')
              .eq('id', storyId)
              .single();
            
            // Vérifier que le like existe bien
            const { data: likeCheck } = await supabase
              .from('story_likes')
              .select('id')
              .eq('story_id', storyId)
              .eq('user_id', userId)
              .maybeSingle();
            
            return story ? { likes: story.likes, hasLiked: !!likeCheck } : null;
          }
          console.error('Error inserting like:', insertError);
          return null;
        }
        hasLiked = true;
      }
      
      // Récupérer le nombre de likes mis à jour (via trigger automatique)
      const { data: story, error: storyError } = await supabase
        .from('stories')
        .select('likes')
        .eq('id', storyId)
        .single();
      
      if (storyError || !story) {
        console.error('Error fetching story:', storyError);
        return null;
      }
      
      return {
        likes: story.likes,
        hasLiked
      };
    } catch (error) {
      console.error('Error toggling like:', error);
      return null;
    }
  },

  // Récupérer les likes d'un utilisateur
  async getUserLikes(userId: string): Promise<Set<string>> {
    try {
      const { data } = await supabase
        .from('story_likes')
        .select('story_id')
        .eq('user_id', userId);

      return new Set(data?.map(like => like.story_id) || []);
    } catch (error) {
      console.error('Error fetching user likes:', error);
      return new Set();
    }
  },

  // Récupérer le nombre de likes pour plusieurs stories
  async getStoriesLikeCounts(storyIds: string[]): Promise<Record<string, number>> {
    if (storyIds.length === 0) return {};
    
    try {
      const { data } = await supabase
        .from('stories')
        .select('id, likes')
        .in('id', storyIds);
      
      return data?.reduce((acc, story) => ({
        ...acc,
        [story.id]: story.likes || 0
      }), {}) || {};
    } catch (error) {
      console.error('Error fetching stories like counts:', error);
      return {};
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

// Service pour la modération
export const moderationService = {
  // Signaler une story
  async reportStory(
    storyId: string, 
    userId: string, 
    reason: 'spam' | 'inappropriate' | 'off_topic' | 'harassment' | 'other',
    details?: string
  ): Promise<{ success: boolean; message: string; reportsCount?: number; isHidden?: boolean }> {
    try {
      const { data, error } = await supabase.rpc('report_story', {
        p_story_id: storyId,
        p_user_id: userId,
        p_reason: reason,
        p_details: details || null
      });

      if (error) {
        console.error('Error reporting story:', error);
        return {
          success: false,
          message: 'Erreur lors du signalement'
        };
      }

      if (data && typeof data === 'object' && 'success' in data) {
        const result = data as any;
        return {
          success: result.success,
          message: result.message || 'Signalement enregistré',
          reportsCount: result.reports_count,
          isHidden: result.is_hidden
        };
      }

      return {
        success: false,
        message: 'Réponse inattendue du serveur'
      };
    } catch (error) {
      console.error('Error reporting story:', error);
      return {
        success: false,
        message: 'Erreur lors du signalement'
      };
    }
  },

  // Obtenir les raisons de signalement disponibles
  async getReportReasons(): Promise<Array<{ value: string; label: string }>> {
    try {
      const { data, error } = await supabase.rpc('get_report_reasons');

      if (error) {
        console.error('Error fetching report reasons:', error);
        return [
          { value: 'spam', label: 'Spam' },
          { value: 'inappropriate', label: 'Contenu inapproprié' },
          { value: 'off_topic', label: 'Hors sujet' },
          { value: 'harassment', label: 'Harcèlement' },
          { value: 'other', label: 'Autre' }
        ];
      }

      return (data as Array<{ value: string; label: string }>) || [];
    } catch (error) {
      console.error('Error fetching report reasons:', error);
      return [
        { value: 'spam', label: 'Spam' },
        { value: 'inappropriate', label: 'Contenu inapproprié' },
        { value: 'off_topic', label: 'Hors sujet' },
        { value: 'harassment', label: 'Harcèlement' },
        { value: 'other', label: 'Autre' }
      ];
    }
  }
};

// Service pour l'upload de fichiers média
export const mediaService = {
  /**
   * Convertit un Blob en base64 data URL
   * Cette approche fonctionne immédiatement mais a des limitations de taille
   * Pour la production, migrez vers Supabase Storage
   */
  async blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to data URL'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  /**
   * Upload une vidéo vers Supabase Storage
   * TODO: Configurez un bucket 'stories' dans Supabase Storage pour utiliser cette fonction
   */
  async uploadVideo(blob: Blob, storyId: string): Promise<string | null> {
    try {
      // Pour l'instant, convertissons en base64 data URL
      // En production, utilisez Supabase Storage:
      // const fileExt = blob.type.split('/')[1] || 'webm';
      // const fileName = `${storyId}.${fileExt}`;
      // const { data, error } = await supabase.storage
      //   .from('stories')
      //   .upload(fileName, blob, { contentType: blob.type });
      // if (error) throw error;
      // const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(fileName);
      // return publicUrl;
      
      return await this.blobToDataURL(blob);
    } catch (error) {
      console.error('Error uploading video:', error);
      return null;
    }
  },

  /**
   * Crée une thumbnail à partir d'une vidéo
   */
  async createVideoThumbnail(videoBlob: Blob): Promise<string | null> {
    try {
      const videoUrl = URL.createObjectURL(videoBlob);
      const video = document.createElement('video');
      video.src = videoUrl;
      video.currentTime = 0.5; // Prendre une frame après 0.5 secondes
      
      return new Promise((resolve) => {
        video.addEventListener('loadeddata', async () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            URL.revokeObjectURL(videoUrl);
            resolve(thumbnailDataUrl);
          } else {
            URL.revokeObjectURL(videoUrl);
            resolve(null);
          }
        });
        
        video.addEventListener('error', () => {
          URL.revokeObjectURL(videoUrl);
          resolve(null);
        });
      });
    } catch (error) {
      console.error('Error creating video thumbnail:', error);
      return null;
    }
  },
};

