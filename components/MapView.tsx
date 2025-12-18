import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Spot } from '../types';
import { MapPin, Navigation, Plus, Minus, LocateFixed, Zap, Search, X, Loader2 } from './Icon';
import { useLanguage } from '../translations';

interface MapViewProps {
  spots: Spot[];
  onSpotSelect: (spot: Spot) => void;
  userLocation: { lat: number, lng: number } | null;
  cityName: string;
  knownNeighborhoods?: { name: string, lat: number, lon: number }[];
}

const MapView: React.FC<MapViewProps> = ({ spots, onSpotSelect, userLocation, cityName, knownNeighborhoods = [] }) => {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  
  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchedLocation, setSearchedLocation] = useState<{lat: number, lon: number, name: string} | null>(null);
  const justSearched = useRef(false);

  // Viewport State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [mapBounds, setMapBounds] = useState({ minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 });

  // Dragging State
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Calculate Map Bounds to fit all spots + user + searched location
  useEffect(() => {
    if (!userLocation && spots.length === 0 && !searchedLocation) return;

    // Start with User location or first spot or searched location
    let minLat = userLocation ? userLocation.lat : (searchedLocation ? searchedLocation.lat : spots[0].latitude);
    let maxLat = minLat;
    let minLon = userLocation ? userLocation.lng : (searchedLocation ? searchedLocation.lon : spots[0].longitude);
    let maxLon = minLon;

    const points = [...spots];
    if (userLocation) points.push({ latitude: userLocation.lat, longitude: userLocation.lng } as any);
    if (searchedLocation) points.push({ latitude: searchedLocation.lat, longitude: searchedLocation.lon } as any);

    points.forEach(p => {
        if (p.latitude < minLat) minLat = p.latitude;
        if (p.latitude > maxLat) maxLat = p.latitude;
        if (p.longitude < minLon) minLon = p.longitude;
        if (p.longitude > maxLon) maxLon = p.longitude;
    });

    // Add padding (approx 10-20%)
    const latSpan = Math.max(0.01, maxLat - minLat); // Min span to avoid zoom infinite
    const lonSpan = Math.max(0.01, maxLon - minLon);

    setMapBounds({
        minLat: minLat - latSpan * 0.2,
        maxLat: maxLat + latSpan * 0.2,
        minLon: minLon - lonSpan * 0.2,
        maxLon: maxLon + lonSpan * 0.2
    });
  }, [spots, userLocation, searchedLocation]);


  // Normalize lat/long to percentage relative to dynamic bounds
  const getPosition = (lat: number, lon: number) => {
    const { minLat, maxLat, minLon, maxLon } = mapBounds;
    // Prevent division by zero
    const latDiff = maxLat - minLat || 1;
    const lonDiff = maxLon - minLon || 1;

    const top = ((maxLat - lat) / latDiff) * 100;
    const left = ((lon - minLon) / lonDiff) * 100;

    return { 
        topPct: top,
        leftPct: left
    };
  };

  // Auto-focus on searched location when it changes and bounds update
  useEffect(() => {
    if (justSearched.current && searchedLocation && containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        const { topPct, leftPct } = getPosition(searchedLocation.lat, searchedLocation.lon);
        
        const targetScale = 3; 
        
        const spotX = (leftPct / 100) * width;
        const spotY = (topPct / 100) * height;

        const targetX = (width / 2) - (spotX * targetScale);
        const targetY = (height / 2) - (spotY * targetScale);

        setScale(targetScale);
        setOffset({ x: targetX, y: targetY });
        
        justSearched.current = false;
    }
 }, [mapBounds, searchedLocation]); 


  // Calculate Neighborhood Labels (Combining Static Known & Dynamic)
  const neighborhoodLabels = useMemo(() => {
    const labels = [...knownNeighborhoods];
    const knownNames = new Set(knownNeighborhoods.map(k => k.name));
    
    // Dynamic groups for unknown areas (e.g., Paris)
    const groups: Record<string, { latSum: number, lonSum: number, count: number }> = {};
    
    spots.forEach(spot => {
        // Only calculate centroid if we don't already have a static one
        if (!knownNames.has(spot.neighborhood)) {
            if (!groups[spot.neighborhood]) {
                groups[spot.neighborhood] = { latSum: 0, lonSum: 0, count: 0 };
            }
            groups[spot.neighborhood].latSum += spot.latitude;
            groups[spot.neighborhood].lonSum += spot.longitude;
            groups[spot.neighborhood].count += 1;
        }
    });

    Object.keys(groups).forEach(name => {
        labels.push({
            name,
            lat: groups[name].latSum / groups[name].count,
            lon: groups[name].lonSum / groups[name].count
        });
    });

    return labels;
  }, [spots, knownNeighborhoods]);

  // --- Search Logic ---
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data);
    } catch(e) {
        console.error(e);
    } finally {
        setIsSearching(false);
    }
  };

  const selectResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setSearchedLocation({ lat, lon, name: result.display_name.split(',')[0] });
    setSearchResults([]);
    setIsSearchOpen(false);
    setSearchQuery('');
    justSearched.current = true;
  };

  // --- Interaction Handlers ---

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const ZOOM_SPEED = 0.001;
    const newScale = Math.max(0.5, Math.min(8, scale - e.deltaY * ZOOM_SPEED));
    setScale(newScale);
  };

  const zoomIn = () => setScale(s => Math.min(8, s * 1.2));
  const zoomOut = () => setScale(s => Math.max(0.5, s / 1.2));
  
  const centerMap = () => {
      setOffset({ x: 0, y: 0 });
      setScale(1);
      setSelectedSpotId(null);
  };

  const focusOnSpot = (spot: Spot) => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const { topPct, leftPct } = getPosition(spot.latitude, spot.longitude);
    const targetScale = 3; 
    
    const spotX = (leftPct / 100) * width;
    const spotY = (topPct / 100) * height;

    const targetX = (width / 2) - (spotX * targetScale);
    const targetY = (height / 2) - (spotY * targetScale);

    setSelectedSpotId(spot.id);
    setScale(targetScale);
    setOffset({ x: targetX, y: targetY });
  };

  const getSpotActivityLevel = (score: number) => {
    if (score >= 40) return 'HOT'; // e.g. 2 stories (20pts) + 10 likes (20pts)
    if (score > 10) return 'ACTIVE';
    return 'CALM';
  };

  return (
    <div 
        ref={containerRef}
        className="relative w-full h-full bg-[#0a0a0f] overflow-hidden touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
    >
      {/* Decorative Map Background (Transform Layer) */}
      <div 
        className="w-full h-full origin-top-left transition-transform duration-500 ease-out will-change-transform"
        style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
            width: '100%',
            height: '100%'
        }}
      >
        {/* Abstract Global Map Grid */}
        <div className="absolute inset-[-50%] w-[200%] h-[200%] pointer-events-none opacity-40">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1f2937" strokeWidth="0.5"/>
                        <circle cx="0" cy="0" r="1" fill="#374151" />
                    </pattern>
                    <radialGradient id="worldGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#1f2937" stopOpacity="0.3"/>
                        <stop offset="100%" stopColor="#0a0a0f" stopOpacity="0"/>
                    </radialGradient>
                </defs>
                
                <rect width="100%" height="100%" fill="#050505" />
                <rect width="100%" height="100%" fill="url(#worldGlow)" />
                <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
        </div>

        {/* Neighborhood Labels (Merged Static & Dynamic) */}
        {neighborhoodLabels.map(hood => {
            const { topPct, leftPct } = getPosition(hood.lat, hood.lon);
            const isVisible = scale > 0.7;
            
            // Only render if roughly within bounds (with generous padding) to avoid rendering global list
            if (topPct < -50 || topPct > 150 || leftPct < -50 || leftPct > 150) return null;

            return (
                <div 
                    key={hood.name}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-500 z-10 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                    style={{ top: `${topPct}%`, left: `${leftPct}%` }}
                >
                     <div style={{ transform: `scale(${1/scale})` }}>
                        <span className="text-4xl font-black tracking-widest text-white/30 select-none uppercase drop-shadow-sm whitespace-nowrap">
                            {hood.name}
                        </span>
                     </div>
                </div>
            );
        })}

        {/* User Location Marker */}
        {userLocation && (
            <div 
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
                style={{ 
                    top: `${getPosition(userLocation.lat, userLocation.lng).topPct}%`, 
                    left: `${getPosition(userLocation.lat, userLocation.lng).leftPct}%` 
                }}
            >
                <div style={{ transform: `scale(${1/scale})` }} className="relative flex flex-col items-center">
                    <div className="absolute w-16 h-16 bg-blue-500/20 rounded-full animate-[ping_3s_ease-in-out_infinite]"></div>
                    <div className="absolute w-12 h-12 bg-blue-500/30 rounded-full animate-[pulse_2s_ease-in-out_infinite]"></div>
                    <div className="w-5 h-5 bg-blue-500 rounded-full border-[3px] border-[#0a0a0f] shadow-[0_0_15px_rgba(59,130,246,0.6)] z-10"></div>
                    <div className="absolute -bottom-7 bg-blue-900/80 backdrop-blur px-2 py-0.5 rounded-full border border-blue-500/30 text-[10px] font-bold text-blue-200 whitespace-nowrap shadow-lg">
                        {t('map.you')}
                    </div>
                </div>
            </div>
        )}

        {/* Searched Location Marker */}
        {searchedLocation && (
            <div 
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
                style={{ 
                    top: `${getPosition(searchedLocation.lat, searchedLocation.lon).topPct}%`, 
                    left: `${getPosition(searchedLocation.lat, searchedLocation.lon).leftPct}%` 
                }}
            >
                <div style={{ transform: `scale(${1/scale})` }} className="relative flex flex-col items-center">
                    <MapPin size={32} className="text-red-500 drop-shadow-lg fill-red-500/20" />
                    <div className="absolute -bottom-6 bg-red-900/80 backdrop-blur px-2 py-0.5 rounded-full border border-red-500/30 text-[10px] font-bold text-red-200 whitespace-nowrap shadow-lg">
                        {searchedLocation.name}
                    </div>
                </div>
            </div>
        )}

        {/* Spots */}
        {spots.map((spot) => {
            const { topPct, leftPct } = getPosition(spot.latitude, spot.longitude);
            const isSelected = selectedSpotId === spot.id;
            const storyCount = spot.activeStories.length;
            const activity = getSpotActivityLevel(spot.vibeScore);
            
            let sizeClass = "w-8 h-8";
            let colorClass = "bg-gray-800 border-gray-600";
            let glowColor = "";
            
            if (activity === 'HOT') {
                sizeClass = "w-14 h-14";
                colorClass = "bg-gradient-to-br from-orange-500 to-red-600 border-white";
                glowColor = "shadow-[0_0_30px_rgba(249,115,22,0.6)]";
            } else if (activity === 'ACTIVE') {
                sizeClass = "w-11 h-11";
                colorClass = "bg-purple-600 border-purple-300";
                glowColor = "shadow-[0_0_20px_rgba(147,51,234,0.5)]";
            }

            return (
            <div 
                key={spot.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer z-20 group"
                style={{ top: `${topPct}%`, left: `${leftPct}%` }}
                onClick={(e) => {
                    e.stopPropagation(); 
                    focusOnSpot(spot);
                }}
            >
                <div style={{ transform: `scale(${1/scale})` }} className="relative flex flex-col items-center justify-center">
                    
                    {activity === 'HOT' && (
                        <>
                             <div className="absolute w-28 h-28 rounded-full border-2 border-orange-500/30 opacity-0 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
                             <div className="absolute w-20 h-20 rounded-full bg-orange-600/20 blur-md animate-pulse" />
                        </>
                    )}

                    <div className={`
                        relative flex items-center justify-center rounded-full border-[3px] transition-all duration-500
                        ${sizeClass} ${colorClass} ${glowColor} ${isSelected ? 'scale-110 ring-4 ring-white/20' : ''}
                        shadow-xl
                    `}>
                        {activity === 'HOT' ? (
                            <div className="text-white font-black text-xl tracking-tighter shadow-sm">+{storyCount}</div>
                        ) : activity === 'ACTIVE' ? (
                            <div className="text-white font-bold text-lg shadow-sm">+{storyCount}</div>
                        ) : (
                            <div className="w-2 h-2 rounded-full bg-gray-500" />
                        )}
                    </div>

                    {(isSelected || activity === 'HOT') && (
                        <div className={`absolute top-[110%] px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-gray-800 whitespace-nowrap z-30 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-1 ${activity === 'HOT' ? 'border-orange-500/50' : ''}`}>
                             <span className={`text-xs font-bold ${activity === 'HOT' ? 'text-orange-400' : 'text-white'}`}>{spot.name}</span>
                        </div>
                    )}

                    {isSelected && (
                        <div className="absolute bottom-20 bg-gray-900/95 backdrop-blur-xl text-white p-4 rounded-3xl border border-gray-700 shadow-2xl flex flex-col items-center w-56 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50 mb-[env(safe-area-inset-bottom)]">
                            <div className="flex items-center space-x-2 mb-2 w-full">
                                <div className={`w-2.5 h-2.5 rounded-full ${activity === 'HOT' ? 'bg-orange-500 animate-pulse' : (activity === 'ACTIVE' ? 'bg-purple-500' : 'bg-gray-500')}`}></div>
                                <span className="font-bold text-base truncate flex-1">{spot.name}</span>
                            </div>
                            
                            <p className="text-xs text-gray-400 w-full text-left mb-4 line-clamp-2 leading-relaxed">
                                {spot.description}
                            </p>

                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSpotSelect(spot);
                                }}
                                className="w-full flex items-center justify-center py-3 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30 active:scale-95 transition-all"
                            >
                                <Navigation size={14} className="mr-2"/>
                                {storyCount > 0 ? (storyCount === 1 ? 'View 1 Story' : `View ${storyCount} Stories`) : t('map.checkIn')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            );
        })}
      </div>
      
      {/* Controls Overlay */}
      <div className="absolute bottom-24 right-4 flex flex-col space-y-3 z-30 mb-[env(safe-area-inset-bottom)]">
        <div className="flex flex-col bg-gray-800/90 backdrop-blur-md rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
            <button onClick={zoomIn} className="p-3 text-white hover:bg-gray-700 active:bg-gray-600 transition-colors">
                <Plus size={20} />
            </button>
            <div className="h-px bg-gray-700 w-full"></div>
            <button onClick={zoomOut} className="p-3 text-white hover:bg-gray-700 active:bg-gray-600 transition-colors">
                <Minus size={20} />
            </button>
        </div>

        <button 
            onClick={centerMap} 
            className="p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-full shadow-xl shadow-purple-900/40 active:scale-95 transition-all flex items-center justify-center"
        >
            <LocateFixed size={20} />
        </button>
      </div>

      {/* Top HUD with Search */}
      <div className="absolute top-0 left-0 right-0 p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] z-40">
        {!isSearchOpen ? (
            <div className="flex justify-between items-start pointer-events-none">
                <div className="pointer-events-auto">
                    <h2 className="text-3xl font-black text-white tracking-tighter drop-shadow-2xl">
                        <span className="text-purple-500">Spot</span>Live
                    </h2>
                    <div className="flex items-center space-x-2 mt-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-gray-300 text-xs font-medium tracking-wide uppercase">
                            {cityName} {t('map.realtime').replace('Conakry ', '').replace('Real-time', 'Real-time')}
                        </span>
                    </div>
                </div>
                <button 
                    onClick={() => setIsSearchOpen(true)} 
                    className="pointer-events-auto p-2.5 bg-gray-900/50 hover:bg-gray-800/80 rounded-full backdrop-blur-md text-white border border-white/10 shadow-lg transition-all active:scale-95"
                >
                    <Search size={22} />
                </button>
            </div>
        ) : (
            <div className="bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700 p-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
                <form onSubmit={handleSearch} className="flex items-center space-x-2 border-b border-gray-700 pb-2 mb-2 px-2">
                    <Search size={18} className="text-gray-400" />
                    <input 
                        className="bg-transparent border-none text-white w-full focus:outline-none text-sm h-10 placeholder-gray-500"
                        placeholder="Search city or place..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                    <button type="button" onClick={() => setIsSearchOpen(false)} className="p-1 hover:bg-gray-800 rounded-full"><X size={18} className="text-gray-400" /></button>
                </form>
                {/* Results List */}
                {searchResults.length > 0 && (
                    <ul className="max-h-48 overflow-y-auto no-scrollbar space-y-1">
                        {searchResults.map((r, i) => (
                            <li key={i}>
                                <button onClick={() => selectResult(r)} className="w-full text-left p-3 hover:bg-white/10 rounded-xl text-sm text-gray-300 truncate transition-colors">
                                <span className="font-bold text-white block">{r.display_name.split(',')[0]}</span>
                                <span className="text-xs text-gray-500">{r.display_name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {isSearching && <div className="p-4 text-center text-gray-400 text-xs flex items-center justify-center"><Loader2 className="animate-spin mr-2" size={16} /> Searching...</div>}
                {!isSearching && searchResults.length === 0 && searchQuery && (
                    <div className="p-4 text-center text-gray-500 text-xs">Press enter to search</div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default MapView;