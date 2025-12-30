import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader2, Repeat, Check, MapPin, Zap, FlipHorizontal } from './Icon';
import { useLanguage } from '../translations';

interface CreateViewProps {
  onClose: () => void;
  onPostSuccess: (data: { locationName: string; caption: string; hashtags: string[]; media: string; isVideo: boolean; lat: number; lng: number }) => void;
}

type Mode = 'PHOTO' | 'VIDEO';

const CreateView: React.FC<CreateViewProps> = ({ onClose, onPostSuccess }) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode>('PHOTO');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null); 
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment'); // 'user' = front, 'environment' = back
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  
  const [locationName, setLocationName] = useState<string>(t('create.locating'));
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);

  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [permissionError, setPermissionError] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartMsRef = useRef<number | null>(null);

  const isFrontCamera = facingMode === 'user';

  const formatRecordingTime = (totalSeconds: number) => {
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // While recording, show user feedback (REC + timer). This is a UX requirement and
  // does not affect the recorded output.
  useEffect(() => {
    if (!isRecording) {
      recordingStartMsRef.current = null;
      setRecordingSeconds(0);
      return;
    }

    recordingStartMsRef.current = Date.now();
    setRecordingSeconds(0);

    const id = window.setInterval(() => {
      if (!recordingStartMsRef.current) return;
      const elapsed = Math.floor((Date.now() - recordingStartMsRef.current) / 1000);
      setRecordingSeconds(elapsed);
    }, 250);

    return () => {
      window.clearInterval(id);
    };
  }, [isRecording]);

  // 1. Initialize Location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentLat(latitude);
        setCurrentLng(longitude);

        try {
            // Fetch nearest POI/Address using OSM Nominatim
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`);
            const data = await response.json();
            
            // Construct a friendly name
            const name = data.address?.amenity || data.address?.shop || data.address?.road || data.address?.neighbourhood || t('create.nearYou');
            setLocationName(name);
        } catch (e) {
            console.warn("Location fetch failed", e);
            setLocationName(t('create.nearYou'));
        }
      },
      (err) => {
        console.warn("Location error:", err);
        setLocationName("Unknown Location"); 
        // Default generic coords if GPS fails
        setCurrentLat(0);
        setCurrentLng(0);
      },
      { enableHighAccuracy: true }
    );
  }, [t]);

  // 2. Initialize Camera
  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        // Arrêter l'ancien stream s'il existe
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: facingMode, 
            aspectRatio: 9/16,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: mode === 'VIDEO'
        });
        
        if (mounted) {
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            // Attendre que la vidéo soit prête avant de continuer
            await new Promise((resolve) => {
              if (videoRef.current) {
                videoRef.current.onloadedmetadata = () => resolve(undefined);
              } else {
                resolve(undefined);
              }
            });
          }
          setIsSwitchingCamera(false);
        } else {
          // Si le composant est démonté, arrêter le stream
          mediaStream.getTracks().forEach(track => track.stop());
        }
      } catch (err: any) {
        console.error("Camera error:", err);
        setIsSwitchingCamera(false);
        
        // Gestion d'erreurs spécifiques
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionError(true);
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          // Pas de caméra disponible, essayer l'autre caméra
          if (facingMode === 'user') {
            // Si on essayait la caméra avant et qu'elle n'existe pas, revenir à l'arrière
            setFacingMode('environment');
          }
        } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
          // Contrainte non satisfaite (ex: aspectRatio), essayer sans contrainte
          console.warn('Camera constraint not satisfied, trying without constraints');
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: facingMode },
              audio: mode === 'VIDEO'
            });
            if (mounted) {
              setStream(fallbackStream);
              if (videoRef.current) {
                videoRef.current.srcObject = fallbackStream;
              }
              setIsSwitchingCamera(false);
            }
          } catch (fallbackErr) {
            setPermissionError(true);
          }
        } else {
          setPermissionError(true);
        }
      }
    }

    if (!capturedMedia && !isRecording) {
      startCamera();
    }

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mode, capturedMedia, facingMode]);

  const handleCapture = async () => {
    if (mode === 'PHOTO') {
      if (!videoRef.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // IMPORTANT: We mirror ONLY the preview for the front camera (selfie UX).
        // The captured photo must NOT be mirrored in the final output.
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedMedia(base64);
        if (stream) stream.getTracks().forEach(track => track.stop());
      }
    } else {
      if (!stream) return;
      setIsRecording(true);
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // On mobile (especially iOS), forcing an incorrect mimeType (e.g. video/webm)
        // can result in a black preview even though recording succeeded.
        // Use the real recorder/chunk mimeType so the <video> element can decode it.
        const mimeType =
          recorder.mimeType ||
          chunksRef.current[0]?.type ||
          'video/webm';

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setCapturedMedia(url);
        setIsRecording(false);
        if (stream) stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;

      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 15000);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleRetake = () => {
    if (capturedMedia && mode === 'VIDEO') {
      URL.revokeObjectURL(capturedMedia);
    }
    setCapturedMedia(null);
    setStream(null); 
    setCaption('');
    setHashtags('');
  };

  // Basculer entre caméra avant et arrière
  const handleSwitchCamera = async () => {
    if (isSwitchingCamera || isRecording || capturedMedia) return;
    
    setIsSwitchingCamera(true);
    
    // Arrêter l'ancien stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    // Basculer la caméra
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    
    // Le useEffect se chargera de démarrer la nouvelle caméra
  };

  const handlePublish = () => {
    if (!capturedMedia) return;
    setLoading(true);
    setTimeout(() => {
      onPostSuccess({
        locationName,
        caption,
        hashtags: hashtags.split(' ').filter(tag => tag.startsWith('#')),
        media: capturedMedia,
        isVideo: mode === 'VIDEO',
        lat: currentLat || 0,
        lng: currentLng || 0
      });
      setLoading(false);
    }, 1500);
  };

  if (permissionError) {
    return (
      <div className="h-full bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-4 text-red-500">
           <Zap size={32} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{t('create.permission.title')}</h2>
        <p className="text-gray-400 mb-6">{t('create.permission.desc')}</p>
        <button onClick={onClose} className="text-purple-400 font-medium">{t('create.cancel')}</button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black overflow-hidden flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-20 p-4 pt-[calc(1.5rem+env(safe-area-inset-top))] flex items-center justify-between pointer-events-none">
        <button onClick={onClose} className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white pointer-events-auto">
          <X size={24} />
        </button>
        
        <div className="flex items-center space-x-2">
          {!capturedMedia && !isRecording && (
            <button 
              onClick={handleSwitchCamera}
              disabled={isSwitchingCamera}
              className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto border border-white/10"
              title={facingMode === 'user' ? 'Caméra arrière' : 'Caméra avant'}
            >
              {isSwitchingCamera ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <FlipHorizontal size={20} />
              )}
            </button>
          )}
          
          {!capturedMedia && (
            <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
              <MapPin size={14} className="text-purple-400" />
              <span className="text-sm font-semibold text-white">{locationName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative bg-gray-900">
        {!capturedMedia ? (
          <>
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted 
              // Mirror ONLY the live preview for front camera (selfie UX).
              // Do NOT mirror the captured media.
              style={{ transform: isFrontCamera ? 'scaleX(-1)' : undefined, transformOrigin: 'center' }}
              className="absolute inset-0 w-full h-full object-cover"
            />

            {mode === 'VIDEO' && isRecording && (
              <div className="absolute top-4 left-4 z-30 pointer-events-none">
                <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-xs font-black tracking-widest text-white">REC</span>
                  <span className="text-xs font-bold text-white tabular-nums">{formatRecordingTime(recordingSeconds)}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          mode === 'PHOTO' ? (
            <img src={capturedMedia} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <video 
              key={capturedMedia}
              src={capturedMedia} 
              autoPlay 
              playsInline 
              // Mandatory preview screen for video (same flow as photo):
              // user must accept (share) or discard (retake) before posting.
              controls
              muted
              preload="metadata"
              onLoadedMetadata={(e) => {
                // Some mobile browsers require an explicit play() after metadata loads.
                // If autoplay is blocked, the user can still play via controls.
                void (e.currentTarget.play?.());
              }}
              className="absolute inset-0 w-full h-full object-cover" 
            />
          )
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 pb-[env(safe-area-inset-bottom)]">
        {!capturedMedia ? (
          <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent pb-8 pt-12 px-6">
            <div className="flex flex-col items-center space-y-6">
                <div className="flex items-center justify-center space-x-6 bg-black/30 backdrop-blur-lg rounded-full px-6 py-2 border border-white/10">
                <button 
                    onClick={() => setMode('PHOTO')}
                    className={`text-sm font-bold tracking-wider transition-colors ${mode === 'PHOTO' ? 'text-yellow-400' : 'text-gray-400'}`}
                >
                    {t('create.photo')}
                </button>
                <div className="w-px h-4 bg-gray-600"></div>
                <button 
                    onClick={() => setMode('VIDEO')}
                    className={`text-sm font-bold tracking-wider transition-colors ${mode === 'VIDEO' ? 'text-red-500' : 'text-gray-400'}`}
                >
                    {t('create.video')}
                </button>
                </div>

                <div className="flex items-center justify-center w-full relative">
                    {mode === 'PHOTO' ? (
                    <button 
                        onClick={handleCapture}
                        className="w-20 h-20 rounded-full border-4 border-white bg-white/20 active:scale-95 transition-all shadow-lg ring-4 ring-black/20"
                    />
                    ) : (
                    <button 
                        onClick={isRecording ? handleStopRecording : handleCapture}
                        className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all shadow-lg ring-4 ring-black/20 ${isRecording ? 'scale-110' : ''}`}
                    >
                        <div className={`rounded-full transition-all duration-300 ${isRecording ? 'w-8 h-8 bg-red-500 rounded-sm' : 'w-16 h-16 bg-red-500'}`} />
                    </button>
                    )}
                </div>
            </div>
          </div>
        ) : (
          <div className="bg-black/80 backdrop-blur-xl border-t border-white/10 p-6 rounded-t-3xl animate-in slide-in-from-bottom-full duration-300">
            <div className="space-y-4 mb-6">
                <div className="flex items-center space-x-3 bg-gray-800 rounded-xl p-3 border border-gray-700 focus-within:border-purple-500 transition-colors">
                    <MapPin size={18} className="text-purple-400 shrink-0" />
                    <input 
                        value={locationName}
                        onChange={(e) => setLocationName(e.target.value)}
                        className="bg-transparent border-none text-white text-sm font-semibold focus:outline-none w-full placeholder-gray-500"
                        placeholder={t('create.locationPlaceholder')}
                    />
                </div>

                <textarea 
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder={t('create.captionPlaceholder')}
                    rows={2}
                    className="w-full bg-gray-800 rounded-xl p-3 text-white text-sm border border-gray-700 focus:border-purple-500 focus:outline-none resize-none placeholder-gray-500"
                />

                <input 
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    placeholder={t('create.hashtagsPlaceholder')}
                    className="w-full bg-gray-800 rounded-xl p-3 text-white text-sm border border-gray-700 focus:border-purple-500 focus:outline-none placeholder-gray-500"
                />
            </div>

            <div className="flex items-center gap-4">
                <button 
                    onClick={handleRetake}
                    className="flex items-center justify-center w-12 h-12 bg-gray-800 rounded-full text-gray-400 hover:text-white border border-gray-700"
                >
                    <Repeat size={20} />
                </button>

                <button 
                    onClick={handlePublish}
                    disabled={loading}
                    className="flex-1 h-12 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-full font-bold text-sm shadow-lg shadow-purple-900/40 active:scale-95 transition-all flex items-center justify-center space-x-2"
                >
                    {loading ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <>
                            <span>{t('create.share')}</span>
                            <Check size={18} />
                        </>
                    )}
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateView;