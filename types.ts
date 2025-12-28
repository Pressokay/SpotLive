export enum ViewState {
  MAP = 'MAP',
  FEED = 'FEED',
  POST = 'POST',
  PROFILE = 'PROFILE',
  AUTH = 'AUTH'
}

export interface User {
  id: string;
  username: string;
  avatarUrl: string;
  isGuest: boolean;
}

export interface Story {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  imageUrl: string;
  videoUrl?: string; // Optional for MVP
  timestamp: number;
  caption: string;
  vibeTags: string[];
  expiresAt: number;
  
  // Dynamic Location Data
  latitude: number;
  longitude: number;
  locationName: string; // "Le Petit Bateau" or custom
  countryCode?: string; // ISO 3166-1 alpha-2 (ex: 'FR', 'GN', 'US')
  
  // Social
  likes: number;
}

export interface Spot {
  id: string; // Generated ID (e.g. cluster center)
  name: string; // Derived from most common locationName or first story
  neighborhood: string; // Derived from lat/long
  latitude: number;
  longitude: number;
  description: string;
  activeStories: Story[];
  vibeScore: number; // Calculated based on activity
}

export interface GeminiAnalysisResult {
  caption: string;
  tags: string[];
  vibeDescription: string;
}