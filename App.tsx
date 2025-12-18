import React, { useState, useEffect, useMemo } from 'react';
import { ViewState, Spot, Story, User } from './types';
import { INITIAL_STORIES, FILTERS, KNOWN_NEIGHBORHOODS } from './constants';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import StoryCard from './components/StoryCard';
import CreateView from './components/CreateView';
import AuthView from './components/AuthView';
import ProfileView from './components/ProfileView';
import { MapPin } from './components/Icon';
import { useLanguage } from './translations';
import { storiesService, usersService } from './services/supabaseService';

// Default lifetime: 24 hours
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000; 

const getNeighborhoodName = (lat: number, lon: number, defaultCity: string): string => {
    // Check if near any known neighborhood (approx 2.5km radius)
    for (const n of KNOWN_NEIGHBORHOODS) {
        const dist = Math.sqrt(Math.pow(n.lat - lat, 2) + Math.pow(n.lon - lon, 2));
        if (dist < 0.025) {
            return n.name;
        }
    }
    return defaultCity;
};

const App: React.FC = () => {
  const { t } = useLanguage();
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.FEED);
  const [user, setUser] = useState<User | null>(null);
  
  // Location State
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [cityName, setCityName] = useState<string>('World');
  const [isLocating, setIsLocating] = useState(true);

  // Master state: List of active stories. 
  const [activeStories, setActiveStories] = useState<Story[]>(INITIAL_STORIES);
  
  // State for liked stories (IDs)
  const [likedStoryIds, setLikedStoryIds] = useState<Set<string>>(new Set());
  
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [showWelcome, setShowWelcome] = useState(true);
  const [pendingView, setPendingView] = useState<ViewState | null>(null);

  // --- 0. Load user from localStorage on startup ---
  useEffect(() => {
    const savedUserId = localStorage.getItem('spotlive_user_id');
    const savedUsername = localStorage.getItem('spotlive_username');
    
    if (savedUserId && savedUsername) {
      usersService.getUser(savedUserId).then(user => {
        if (user) {
          setUser(user);
        }
      }).catch(() => {
        // Si erreur, nettoyer localStorage
        localStorage.removeItem('spotlive_user_id');
        localStorage.removeItem('spotlive_username');
      });
    }
  }, []);

  // --- 0.5. Load stories from Supabase on startup ---
  useEffect(() => {
    const loadStories = async () => {
      try {
        const stories = await storiesService.getActiveStories();
        setActiveStories(stories);
      } catch (error) {
        console.error('Error loading stories:', error);
      }
    };
    
    loadStories();
    
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(loadStories, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- 1. Geolocation & City Name Logic ---
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setIsLocating(false);

        // Fetch City Name (Reverse Geocoding via OSM Nominatim)
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || 'Local';
          setCityName(city);
        } catch (e) {
          console.warn("Could not fetch city name", e);
          setCityName('Local');
        }
      },
      (err) => {
        console.warn("Location permission denied or error", err);
        setIsLocating(false);
        setCityName('Global');
      },
      { enableHighAccuracy: true }
    );
  }, []);

  // --- 2. Dynamic Spot Calculation (Clustering) ---
  const calculatedSpots = useMemo(() => {
    const clusters: Story[][] = [];
    const THRESHOLD = 0.0015; // Approx 150m-200m

    activeStories.forEach(story => {
      let added = false;
      for (const cluster of clusters) {
        // Simple distance to first element of cluster
        const center = cluster[0];
        const dist = Math.sqrt(
            Math.pow(story.latitude - center.latitude, 2) + 
            Math.pow(story.longitude - center.longitude, 2)
        );
        if (dist < THRESHOLD) {
          cluster.push(story);
          added = true;
          break;
        }
      }
      if (!added) {
        clusters.push([story]);
      }
    });

    return clusters.map((cluster, index) => {
      const centerStory = cluster[0];
      const sanitizedLoc = centerStory.locationName.replace(/[^a-zA-Z0-9]/g, '');
      const spotId = `spot-${sanitizedLoc}`; 
      
      // Determine neighborhood
      const hood = getNeighborhoodName(centerStory.latitude, centerStory.longitude, cityName);
      
      // Calculate total likes for the spot
      const totalLikes = cluster.reduce((sum, s) => sum + (s.likes || 0), 0);
      
      // Vibe Score: weighted by stories count and likes.
      // E.g. 1 story = 10 pts, 1 like = 2 pts.
      const rawScore = (cluster.length * 10) + (totalLikes * 2);

      return {
        id: spotId,
        name: centerStory.locationName,
        neighborhood: hood,
        latitude: centerStory.latitude,
        longitude: centerStory.longitude,
        description: `${cluster.length} active stories`,
        activeStories: cluster.sort((a,b) => (b.likes - a.likes) || (b.timestamp - a.timestamp)), // Sort by likes then time
        vibeScore: Math.min(100, rawScore)
      } as Spot;
    });
  }, [activeStories, cityName]);

  // --- 3. Filter Logic ---
  const displayedSpots = useMemo(() => {
    let spots = [...calculatedSpots];

    if (selectedFilter === 'Near Me' && userLocation) {
        // Sort by distance
        spots.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.latitude - userLocation.lat, 2) + Math.pow(a.longitude - userLocation.lng, 2));
            const distB = Math.sqrt(Math.pow(b.latitude - userLocation.lat, 2) + Math.pow(b.longitude - userLocation.lng, 2));
            return distA - distB;
        });
    } else if (selectedFilter === 'Trending') {
        // Sort by Vibe Score (Activity + Likes)
        spots.sort((a, b) => b.vibeScore - a.vibeScore);
    }
    
    return spots;
  }, [calculatedSpots, selectedFilter, userLocation]);
  

  // Cleanup Loop: Automatically remove expired stories
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveStories(current => {
        const valid = current.filter(s => s.expiresAt > now);
        return valid.length !== current.length ? valid : current;
      });
    }, 10000); 

    return () => clearInterval(interval);
  }, []);

  const handleSpotSelectFromMap = (spot: Spot) => {
    setCurrentView(ViewState.FEED);
    // Optionally auto-scroll to spot
  };

  const handleNavigation = (view: ViewState) => {
    if ((view === ViewState.POST || view === ViewState.PROFILE) && !user) {
        setPendingView(view);
        setCurrentView(ViewState.AUTH);
    } else {
        setCurrentView(view);
    }
  };

  const handleLoginSuccess = (loggedInUser: User) => {
      setUser(loggedInUser);
      if (pendingView) {
          setCurrentView(pendingView);
          setPendingView(null);
      } else {
          setCurrentView(ViewState.FEED);
      }
  };

  const handleUpdateProfile = (updatedUser: User) => {
    setUser(updatedUser);
    setActiveStories(prev => prev.map(s => 
        s.userId === updatedUser.id 
            ? { ...s, username: updatedUser.username, userAvatar: updatedUser.avatarUrl }
            : s
    ));
  };

  const handlePostSuccess = async (data: { locationName: string; caption: string; hashtags: string[]; media: string; isVideo: boolean; lat: number; lng: number }) => {
    if (!user) return;

    const newStory: Story = {
      id: `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      username: user.username,
      userAvatar: user.avatarUrl,
      imageUrl: data.media, 
      timestamp: Date.now(),
      caption: data.caption || 'Just vibing',
      vibeTags: data.hashtags.length > 0 ? data.hashtags : ['#SpotLive'],
      expiresAt: Date.now() + STORY_LIFETIME_MS,
      latitude: data.lat,
      longitude: data.lng,
      locationName: data.locationName,
      likes: 0
    };

    // Sauvegarder dans Supabase
    try {
      const savedStory = await storiesService.createStory(newStory);
      
      if (savedStory) {
        setActiveStories(prev => [savedStory, ...prev]);
      } else {
        // Fallback: ajouter localement si Supabase échoue
        setActiveStories(prev => [newStory, ...prev]);
      }
    } catch (error) {
      console.error('Error saving story:', error);
      // Fallback: ajouter localement
      setActiveStories(prev => [newStory, ...prev]);
    }
    
    setCurrentView(ViewState.FEED);
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!user) return;
    
    try {
      const success = await storiesService.deleteStory(storyId, user.id);
      if (success) {
        setActiveStories(prev => prev.filter(s => s.id !== storyId));
      } else {
        // Fallback: supprimer localement même si Supabase échoue
        setActiveStories(prev => prev.filter(s => s.id !== storyId));
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      // Fallback: supprimer localement
      setActiveStories(prev => prev.filter(s => s.id !== storyId));
    }
  };

  const handleToggleLikeStory = async (storyId: string) => {
    const isLiking = !likedStoryIds.has(storyId);
    const increment = isLiking ? 1 : -1;
    
    // Mettre à jour l'état local immédiatement (optimistic update)
    setLikedStoryIds(prev => {
      const next = new Set(prev);
      if (isLiking) {
        next.add(storyId);
      } else {
        next.delete(storyId);
      }
      return next;
    });
    
    setActiveStories(stories => stories.map(s => {
      if (s.id === storyId) {
        return { ...s, likes: (s.likes || 0) + increment };
      }
      return s;
    }));
    
    // Synchroniser avec Supabase
    try {
      await storiesService.toggleLike(storyId, increment);
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert en cas d'erreur
      setLikedStoryIds(prev => {
        const next = new Set(prev);
        if (isLiking) {
          next.delete(storyId);
        } else {
          next.add(storyId);
        }
        return next;
      });
      
      setActiveStories(stories => stories.map(s => {
        if (s.id === storyId) {
          return { ...s, likes: (s.likes || 0) - increment };
        }
        return s;
      }));
    }
  };

  const handleLogout = () => {
      localStorage.removeItem('spotlive_user_id');
      localStorage.removeItem('spotlive_username');
      setUser(null);
      setCurrentView(ViewState.FEED);
  };

  if (showWelcome) {
     return (
        <div className="h-full w-full bg-gray-950 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-64 h-64 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
             <div className="absolute bottom-0 right-0 w-64 h-64 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

             <div className="relative z-10 space-y-6">
                <div className="inline-block p-4 rounded-3xl bg-gray-900 border border-gray-800 shadow-2xl mb-4">
                    <MapPin size={48} className="text-purple-500" />
                </div>
                <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-500 tracking-tight">
                    {t('app.welcome.title')}
                </h1>
                <p className="text-gray-400 text-lg max-w-xs mx-auto leading-relaxed">
                    {t('app.welcome.subtitle')}
                </p>
                <button 
                    onClick={() => setShowWelcome(false)}
                    className="w-full py-4 bg-white text-black font-bold rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 transition-transform active:scale-95"
                >
                    {t('app.welcome.button')}
                </button>
                <p className="text-xs text-gray-600 mt-8">{t('app.welcome.note')}</p>
             </div>
        </div>
     );
  }

  // Render content based on view
  const renderContent = () => {
    switch (currentView) {
      case ViewState.AUTH:
          return (
            <AuthView 
                onLoginSuccess={handleLoginSuccess}
                onCancel={() => setCurrentView(ViewState.FEED)}
                targetAction={pendingView === ViewState.POST ? t('auth.action.post') : t('auth.action.profile')}
            />
          );

      case ViewState.MAP:
        return (
          <MapView 
            spots={displayedSpots} 
            onSpotSelect={handleSpotSelectFromMap} 
            userLocation={userLocation} 
            cityName={cityName} 
            knownNeighborhoods={KNOWN_NEIGHBORHOODS}
          />
        );
      
      case ViewState.POST:
        return <CreateView onClose={() => setCurrentView(ViewState.FEED)} onPostSuccess={handlePostSuccess} />;
      
      case ViewState.PROFILE:
        if (!user) return null; 
        const myStories = activeStories.filter(s => s.userId === user.id);
        return (
            <ProfileView 
                user={user} 
                storyCount={myStories.length} 
                onLogout={handleLogout} 
                onUpdateProfile={handleUpdateProfile}
                myStories={myStories}
                onDeleteStory={handleDeleteStory}
                likedStoryIds={likedStoryIds}
                onToggleLikeStory={handleToggleLikeStory}
            />
        );

      case ViewState.FEED:
      default:
        return (
          <div className="pb-24 pt-4 px-4 overflow-y-auto h-full no-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('app.feed.title')}</h1>
                    <p className="text-xs text-gray-400 flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                        {activeStories.length} {t('app.feed.activeStories')} • {cityName}
                    </p>
                </div>
                {!user ? (
                     <button 
                        onClick={() => handleNavigation(ViewState.AUTH)}
                        className="text-xs text-purple-400 font-bold px-3 py-1 bg-purple-900/30 rounded-full border border-purple-500/30"
                     >
                        {t('app.feed.login')}
                     </button>
                ) : (
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-700">
                         <img src={user.avatarUrl} alt="Me" className="w-full h-full object-cover" />
                    </div>
                )}
            </div>

            {/* Global Filters */}
            <div className="flex space-x-3 overflow-x-auto pb-4 mb-2 no-scrollbar">
                {FILTERS.map(filter => (
                    <button
                        key={filter}
                        onClick={() => {
                            setSelectedFilter(filter);
                        }}
                        className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                            selectedFilter === filter 
                            ? 'bg-white text-black font-bold shadow-lg' 
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                        {filter}
                    </button>
                ))}
            </div>

            {/* Feed */}
            <div className="space-y-6">
                {displayedSpots.map(spot => (
                    spot.activeStories.map(story => (
                        <StoryCard 
                            key={story.id} 
                            story={story} 
                            spot={spot}
                            currentUser={user}
                            onDelete={handleDeleteStory}
                            onClick={() => {}} 
                            hasLiked={likedStoryIds.has(story.id)}
                            onToggleLike={() => handleToggleLikeStory(story.id)}
                        />
                    ))
                ))}
                {displayedSpots.length === 0 && (
                    <div className="text-center py-20 text-gray-500">
                        <p>{t('app.feed.noStories')}</p>
                        <button 
                            onClick={() => handleNavigation(ViewState.POST)}
                            className="mt-4 text-purple-400 font-medium"
                        >
                            {t('app.feed.beFirst')}
                        </button>
                    </div>
                )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full w-full bg-gray-950 relative max-w-md mx-auto shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden relative">
             {renderContent()}
        </div>
        {currentView !== ViewState.POST && currentView !== ViewState.AUTH && (
            <Navbar currentView={currentView} onChangeView={handleNavigation} />
        )}
    </div>
  );
};

export default App;