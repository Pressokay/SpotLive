import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PullToRefresh } from './components/PullToRefresh';
import { ViewState, Spot, Story, User } from './types';
import { INITIAL_STORIES, FILTERS, KNOWN_NEIGHBORHOODS } from './constants';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import StoryCard from './components/StoryCard';
import CreateView from './components/CreateView';
import AuthView from './components/AuthView';
import ProfileView from './components/ProfileView';
import CountrySelector from './components/CountrySelector';
import ReportModal from './components/ReportModal';
import { MapPin, RefreshCw } from './components/Icon';
import { useLanguage } from './translations';
import { storiesService, usersService, supabase } from './services/supabaseService';
import { detectCountryFromCoordinates, getCountryName, getCountryFlag } from './services/countryService';

// Default lifetime: 24 hours
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

// Formater le temps écoulé depuis la dernière mise à jour
const formatTimeAgo = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `Il y a ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
};

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
  
  // Country State
  const [userCountryCode, setUserCountryCode] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);

  // Master state: List of active stories. 
  const [activeStories, setActiveStories] = useState<Story[]>(INITIAL_STORIES);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastRefreshTime = useRef<Date>(new Date());
  
  // State for liked stories (IDs)
  const [likedStoryIds, setLikedStoryIds] = useState<Set<string>>(new Set());
  const [isLoadingLikes, setIsLoadingLikes] = useState(true);
  
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [showWelcome, setShowWelcome] = useState(true);
  const [pendingView, setPendingView] = useState<ViewState | null>(null);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [reportingStoryId, setReportingStoryId] = useState<string | null>(null);

  // Charger les likes de l'utilisateur
  const loadUserLikes = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoadingLikes(true);
    try {
      const likes = await storiesService.getUserLikes(user.id);
      setLikedStoryIds(likes);
    } catch (error) {
      console.error('Failed to load user likes:', error);
    } finally {
      setIsLoadingLikes(false);
    }
  }, [user?.id]);

  // Charger les likes au chargement et quand l'utilisateur change
  useEffect(() => {
    loadUserLikes();
  }, [loadUserLikes]);

  // --- 0. Load user and country preferences from localStorage on startup ---
  useEffect(() => {
    const savedUserId = localStorage.getItem('spotlive_user_id');
    const savedUsername = localStorage.getItem('spotlive_username');
    const savedCountryCode = localStorage.getItem('spotlive_country_code');
    
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
    
    // Restaurer le pays sélectionné
    if (savedCountryCode) {
      setSelectedCountryCode(savedCountryCode);
    }
  }, []);

  // --- 1. Geolocation & Country Detection ---
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
          
          // Détecter le pays
          const countryCode = data.address?.country_code?.toUpperCase();
          if (countryCode && countryCode.length === 2) {
            setUserCountryCode(countryCode);
            
            // Si aucun pays n'est sélectionné, utiliser le pays de l'utilisateur par défaut
            if (!selectedCountryCode && !localStorage.getItem('spotlive_country_code')) {
              setSelectedCountryCode(countryCode);
              localStorage.setItem('spotlive_country_code', countryCode);
            }
          }
        } catch (e) {
          console.warn("Could not fetch location data", e);
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
  }, [selectedCountryCode]);

  // --- 0.5. Load stories from Supabase on startup (filtrées par pays) ---
  const loadStories = useCallback(async () => {
    try {
      // Utiliser le pays sélectionné, ou le pays de l'utilisateur par défaut
      const countryToFilter = selectedCountryCode || userCountryCode;
      const stories = await storiesService.getActiveStories(countryToFilter || null);
      setActiveStories(stories);
      const now = new Date();
      lastRefreshTime.current = now;
      setLastUpdateTime(now);
      return true;
    } catch (error) {
      console.error('Error loading stories:', error);
      return false;
    }
  }, [selectedCountryCode, userCountryCode]);

  // Chargement initial des stories
  useEffect(() => {
    loadStories();
  }, [loadStories]);

  // Fonction de rafraîchissement
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Recharger les stories et les likes
      await Promise.all([
        loadStories(),
        user?.id ? loadUserLikes() : Promise.resolve()
      ]);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Abonnement aux mises à jour en temps réel (avec debounce)
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout | null = null;
    
    const channel = supabase
      .channel('stories-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stories'
        },
        (payload) => {
          console.log('Change received!', payload);
          // Debounce: rafraîchir seulement si la dernière mise à jour date de plus de 5 secondes
          const now = new Date();
          const timeSinceLastRefresh = (now.getTime() - lastRefreshTime.current.getTime()) / 1000;
          
          if (timeSinceLastRefresh > 5) {
            // Annuler le timeout précédent si existe
            if (refreshTimeout) {
              clearTimeout(refreshTimeout);
            }
            
            // Attendre 1 seconde avant de rafraîchir (debounce)
            refreshTimeout = setTimeout(() => {
              if (!isRefreshing) {
                loadStories();
              }
            }, 1000);
          }
        }
      )
      .subscribe();

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      supabase.removeChannel(channel);
    };
  }, [loadStories, isRefreshing]); 

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

  // Calculer displayedSpots pour MapView
  const { displayedSpots, spotByStoryId } = useMemo(() => {
    const byKey = new Map<
      string,
      {
        key: string;
        stories: Story[];
        latSum: number;
        lonSum: number;
        locationName: string;
      }
    >();

    for (const story of activeStories) {
      const latKey = Math.round(story.latitude * 1000) / 1000;
      const lonKey = Math.round(story.longitude * 1000) / 1000;
      const key = `${story.locationName}|${latKey}|${lonKey}`;

      const existing = byKey.get(key);
      if (existing) {
        existing.stories.push(story);
        existing.latSum += story.latitude;
        existing.lonSum += story.longitude;
      } else {
        byKey.set(key, {
          key,
          stories: [story],
          latSum: story.latitude,
          lonSum: story.longitude,
          locationName: story.locationName
        });
      }
    }

    const spots: Spot[] = [];
    const storyToSpot: Record<string, Spot> = {};

    for (const group of byKey.values()) {
      const latitude = group.latSum / group.stories.length;
      const longitude = group.lonSum / group.stories.length;
      const neighborhood = getNeighborhoodName(latitude, longitude, cityName);
      const totalLikes = group.stories.reduce((sum, s) => sum + (s.likes || 0), 0);
      const vibeScore = group.stories.length * 20 + totalLikes * 2;

      const spot: Spot = {
        id: `spot_${group.key}`,
        name: group.locationName,
        neighborhood,
        latitude,
        longitude,
        description: '',
        activeStories: group.stories,
        vibeScore
      };

      spots.push(spot);
      for (const story of group.stories) {
        storyToSpot[story.id] = spot;
      }
    }

    return { displayedSpots: spots, spotByStoryId: storyToSpot };
  }, [activeStories, cityName]);

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

    // Détecter le pays depuis les coordonnées
    let countryCode = 'XX'; // Fallback
    try {
      const detectedCountry = await detectCountryFromCoordinates(data.lat, data.lng);
      if (detectedCountry) {
        countryCode = detectedCountry;
      }
    } catch (error) {
      console.warn('Could not detect country for story:', error);
    }

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
      countryCode: countryCode,
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
    if (!user?.id) return;
    
    const isLiking = !likedStoryIds.has(storyId);
    
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
    
    // Sauvegarder l'ancien nombre de likes pour le rollback si nécessaire
    const previousLikes = activeStories.find(s => s.id === storyId)?.likes || 0;
    
    setActiveStories(stories => 
      stories.map(s => 
        s.id === storyId 
          ? { ...s, likes: isLiking ? previousLikes + 1 : Math.max(0, previousLikes - 1) } 
          : s
      )
    );
    
    // Synchroniser avec Supabase
    try {
      const result = await storiesService.toggleLike(storyId, user.id);
      
      if (result) {
        // Mettre à jour avec les données du serveur
        setActiveStories(stories => 
          stories.map(s => 
            s.id === storyId ? { ...s, likes: result.likes } : s
          )
        );
        
        setLikedStoryIds(prev => {
          const next = new Set(prev);
          if (result.hasLiked) {
            next.add(storyId);
          } else {
            next.delete(storyId);
          }
          return next;
        });
      }
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
      
      setActiveStories(stories => 
        stories.map(s => 
          s.id === storyId ? { ...s, likes: previousLikes } : s
        )
      );
    }
  };

  const handleLogout = () => {
      localStorage.removeItem('spotlive_user_id');
      localStorage.removeItem('spotlive_username');
      setUser(null);
      setCurrentView(ViewState.FEED);
  };

  const handleReportStory = (storyId: string) => {
    if (!user) {
      // Rediriger vers l'auth si pas connecté
      setPendingView(ViewState.FEED);
      setCurrentView(ViewState.AUTH);
      return;
    }
    setReportingStoryId(storyId);
  };

  const handleReportSuccess = (message: string) => {
    alert(message);
    // Optionnel : recharger les stories pour masquer celle qui a été signalée
    loadStories();
  };

  // Filtrer les stories affichées
  const filteredStories = useMemo(() => {
    if (selectedFilter === 'All') return activeStories;
    return activeStories.filter(story => 
      story.vibeTags.some(tag => tag.toLowerCase().includes(selectedFilter.toLowerCase()))
    );
  }, [activeStories, selectedFilter]);

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
                onDeleteStory={(id) => {
                  void handleDeleteStory(id);
                }}
                likedStoryIds={likedStoryIds}
                onToggleLikeStory={(storyId) => {
                  void handleToggleLikeStory(storyId);
                }}
            />
        );

      case ViewState.FEED:
      default:
        return (
          <div className="pb-24 pt-4 px-4 overflow-y-auto h-full no-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-white">{t('app.feed.title')}</h1>
                    <div className="flex items-center space-x-2 mt-1 flex-wrap gap-2">
                        <p className="text-xs text-gray-400 flex items-center">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                            {activeStories.length} {t('app.feed.activeStories')} • {cityName}
                        </p>
                        {/* Last Update Indicator */}
                        {lastUpdateTime && (
                            <p className="text-xs text-gray-500">
                                {formatTimeAgo(lastUpdateTime)}
                            </p>
                        )}
                        {/* Country Selector Button */}
                        <button
                            onClick={() => setShowCountrySelector(true)}
                            className="flex items-center space-x-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded-full border border-gray-700 transition-colors"
                        >
                            <span className="text-sm">
                                {selectedCountryCode ? getCountryFlag(selectedCountryCode) : '🌍'}
                            </span>
                            <span className="text-xs text-gray-300">
                                {selectedCountryCode ? getCountryName(selectedCountryCode) : 'Tous'}
                            </span>
                        </button>
                        {/* Refresh Button */}
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className={`p-1.5 rounded-full transition-all ${
                                isRefreshing
                                    ? 'bg-purple-600 text-white cursor-wait'
                                    : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white'
                            }`}
                            title="Rafraîchir"
                        >
                            <RefreshCw 
                                size={14} 
                                className={isRefreshing ? 'animate-spin' : ''}
                            />
                        </button>
                    </div>
                </div>
                {!user ? (
                     <button 
                        onClick={() => handleNavigation(ViewState.AUTH)}
                        className="text-xs text-purple-400 font-bold px-3 py-1 bg-purple-900/30 rounded-full border border-purple-500/30 ml-2"
                     >
                        {t('app.feed.login')}
                     </button>
                ) : (
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-700 ml-2">
                         <img src={user.avatarUrl} alt="Me" className="w-full h-full object-cover" />
                    </div>
                )}
            </div>

            {/* Global Filters */}
            <div className="flex space-x-3 overflow-x-auto pb-4 mb-2 no-scrollbar">
                {FILTERS.map(filter => (
                    <button
                        key={filter}
                        onClick={() => setSelectedFilter(filter)}
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

            {/* Stories List */}
            <div className="space-y-4">
                {filteredStories.length > 0 ? (
                    filteredStories.map(story => (
                        <StoryCard 
                            key={story.id} 
                            story={story}
                            spot={spotByStoryId[story.id]}
                            currentUser={user}
                            onClick={() => {}}
                            onDelete={(id) => {
                              void handleDeleteStory(id);
                            }}
                            hasLiked={likedStoryIds.has(story.id)}
                            onToggleLike={() => {
                              void handleToggleLikeStory(story.id);
                            }}
                            onReport={handleReportStory}
                        />
                    ))
                ) : (
                    <div className="text-center py-16">
                        <p className="text-gray-500 mb-4">{t('app.feed.noStories')}</p>
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

  const handleCountryChange = (countryCode: string | null) => {
    setSelectedCountryCode(countryCode);
    if (countryCode) {
      localStorage.setItem('spotlive_country_code', countryCode);
    } else {
      localStorage.removeItem('spotlive_country_code');
    }
    // Recharger les stories avec le nouveau filtre
    loadStories();
  };

  return (
    <div className="h-full w-full bg-gray-950 relative max-w-md mx-auto shadow-2xl overflow-hidden flex flex-col">
        <main className="flex-1 overflow-hidden">
          {currentView === ViewState.FEED ? (
            <PullToRefresh 
              className="h-full"
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              pullDownText="Tirez pour rafraîchir"
              releaseText="Relâchez pour actualiser"
              refreshingText="Mise à jour..."
            >
              {renderContent()}
            </PullToRefresh>
          ) : (
            renderContent()
          )}
        </main>
        {currentView !== ViewState.POST && currentView !== ViewState.AUTH && (
            <Navbar currentView={currentView} onChangeView={handleNavigation} />
        )}
        {showCountrySelector && (
          <CountrySelector
            currentCountryCode={selectedCountryCode}
            userCountryCode={userCountryCode}
            onCountryChange={handleCountryChange}
            onClose={() => setShowCountrySelector(false)}
          />
        )}
        {reportingStoryId && user && (
          <ReportModal
            storyId={reportingStoryId}
            userId={user.id}
            onClose={() => setReportingStoryId(null)}
            onReportSuccess={handleReportSuccess}
          />
        )}
    </div>
  );
};

export default App;