import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader2, Repeat, Check, MapPin, Zap, FlipHorizontal } from './Icon';
import { useLanguage } from '../translations';
import { mediaService } from '../services/supabaseService';

interface CreateViewProps {
  onClose: () => void;
  onPostSuccess: (data: {
    storyId?: string;
    locationName: string;
    caption: string;
    hashtags: string[];
    media: string;
    /** Optional thumbnail/poster image for videos (data URL) */
    thumbnail?: string | null;
    isVideo: boolean;
    lat: number;
    lng: number;
  }) => void;
}

type Mode = 'PHOTO' | 'VIDEO';

const CreateView: React.FC<CreateViewProps> = ({ onClose, onPostSuccess }) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode>('PHOTO');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null); 
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment'); // 'user' = front, 'environment' = back
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  
  const [locationName, setLocationName] = useState<string>(t('create.locating'));
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);

  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [permissionError, setPermissionError] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartMsRef = useRef<number | null>(null);
  const videoBlobRef = useRef<Blob | null>(null); // Store the original video blob for upload
  const canvasRef = useRef<HTMLCanvasElement | null>(null); // Canvas for processing front camera video
  const animationFrameRef = useRef<number | null>(null); // Track animation frame for canvas recording

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

  // Keep preview controls in sync with the recorded <video> element.
  // Native controls are often obscured by our bottom panel on mobile, so we provide
  // explicit play/pause + scrub UI.
  useEffect(() => {
    if (mode !== 'VIDEO' || !capturedMedia) {
      setPreviewDuration(0);
      setPreviewCurrentTime(0);
      setIsPreviewPlaying(false);
      return;
    }

    const el = previewVideoRef.current;
    if (!el) return;

    const handleLoaded = () => {
      const duration = Number.isFinite(el.duration) ? el.duration : 0;
      setPreviewDuration(duration);
      setPreviewCurrentTime(el.currentTime || 0);
    };

    const handleTimeUpdate = () => {
      setPreviewCurrentTime(el.currentTime || 0);
    };

    const handlePlay = () => setIsPreviewPlaying(true);
    const handlePause = () => setIsPreviewPlaying(false);
    const handleEnded = () => setIsPreviewPlaying(false);

    el.addEventListener('loadedmetadata', handleLoaded);
    el.addEventListener('timeupdate', handleTimeUpdate);
    el.addEventListener('play', handlePlay);
    el.addEventListener('pause', handlePause);
    el.addEventListener('ended', handleEnded);

    // Ensure we're at the start of the preview when opening it.
    try {
      el.currentTime = 0;
    } catch {
      // Ignore if the browser disallows setting currentTime before metadata.
    }

    return () => {
      el.removeEventListener('loadedmetadata', handleLoaded);
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('play', handlePlay);
      el.removeEventListener('pause', handlePause);
      el.removeEventListener('ended', handleEnded);
    };
  }, [mode, capturedMedia]);

  const togglePreviewPlayback = async () => {
    const el = previewVideoRef.current;
    if (!el) return;

    // On mobile, audio playback is generally allowed only after a user gesture.
    // This handler runs on a button press, which satisfies autoplay policies.
    try {
      if (el.paused) {
        await el.play();
      } else {
        el.pause();
      }
    } catch (e) {
      console.warn('Preview play blocked:', e);
    }
  };

  const seekPreviewTo = (nextTimeSeconds: number) => {
    const el = previewVideoRef.current;
    if (!el) return;
    try {
      el.currentTime = nextTimeSeconds;
    } catch {
      // Some browsers can temporarily block seeking until metadata is available.
    }
  };

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
        // IMPORTANT (Instagram/Snapchat style):
        // - The LIVE preview is mirrored via CSS for the front camera (selfie UX).
        // - The FINAL captured photo must NOT be mirrored.
        //
        // Some mobile browsers can effectively provide a mirrored front-camera frame.
        // To guarantee correct output, we explicitly un-mirror the captured image
        // for the front camera by flipping on the canvas draw step.
        if (isFrontCamera) {
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, 0, 0);
          ctx.restore();
        } else {
          ctx.drawImage(videoRef.current, 0, 0);
        }
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedMedia(base64);
        if (stream) stream.getTracks().forEach(track => track.stop());
      }
    } else {
      // VIDEO MODE
      if (!stream || !videoRef.current) return;
      
      setIsRecording(true);
      chunksRef.current = [];
      
      if (isFrontCamera) {
        // ========================================
        // FRONT CAMERA: Record through canvas to un-mirror
        // ========================================
        const video = videoRef.current;
        
        // CRITICAL FIX 1: Wait for video to be fully ready
        if (video.readyState < video.HAVE_ENOUGH_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
          console.log('⏳ Video not ready, waiting for metadata...');
          
          // Wait for video to have valid dimensions
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Video failed to load'));
            }, 5000); // 5 second timeout
            
            const checkReady = () => {
              if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
                clearTimeout(timeout);
                console.log('✅ Video ready:', { width: video.videoWidth, height: video.videoHeight });
                resolve();
              } else {
                requestAnimationFrame(checkReady);
              }
            };
            checkReady();
          }).catch(error => {
            console.error('❌ Video failed to load:', error);
            setIsRecording(false);
            setUploadError('Camera initialization failed. Please try again.');
            return;
          });
        }
        
        // CRITICAL FIX 2: Create canvas with ACTUAL video dimensions
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (!ctx) {
          console.error('❌ Canvas context not available');
          setIsRecording(false);
          setUploadError('Canvas initialization failed.');
          return;
        }
        
        console.log('📹 Canvas created:', { 
          width: canvas.width, 
          height: canvas.height,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight
        });
        
        // Validate canvas dimensions
        if (canvas.width === 0 || canvas.height === 0) {
          console.error('❌ Invalid canvas dimensions');
          setIsRecording(false);
          setUploadError('Invalid video dimensions. Please try again.');
          return;
        }
        
        // CRITICAL FIX 3: Start drawing frames BEFORE creating stream
        let isRecordingActive = true;
        let framesDrawn = 0;
        
        const drawFrame = () => {
          if (!isRecordingActive || !video || !ctx) return;
          
          // Check if video is still playing
          if (video.readyState < video.HAVE_CURRENT_DATA) {
            animationFrameRef.current = requestAnimationFrame(drawFrame);
            return;
          }
          
          try {
            // Save context state
            ctx.save();
            // Flip horizontally to un-mirror the front camera
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            // Draw the video frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // Restore context
            ctx.restore();
            
            framesDrawn++;
          } catch (error) {
            console.error('❌ Error drawing frame:', error);
          }
          
          animationFrameRef.current = requestAnimationFrame(drawFrame);
        };
        
        // Start drawing frames
        animationFrameRef.current = requestAnimationFrame(drawFrame);
        canvasRef.current = canvas;
        
        // CRITICAL FIX 4: Wait for frames to be drawn before creating stream
        await new Promise(resolve => setTimeout(resolve, 200)); // Wait 200ms for frames
        
        console.log('🎬 Frames drawn before stream creation:', framesDrawn);
        
        if (framesDrawn === 0) {
          console.warn('⚠️ No frames drawn yet, but continuing...');
        }
        
        // CRITICAL FIX 5: Create canvas stream with proper frame rate
        const canvasStream = canvas.captureStream(30); // 30 fps
        
        // Validate canvas stream
        if (!canvasStream || canvasStream.getVideoTracks().length === 0) {
          console.error('❌ Canvas stream creation failed');
          isRecordingActive = false;
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          setIsRecording(false);
          setUploadError('Failed to create video stream.');
          return;
        }
        
        console.log('✅ Canvas stream created:', {
          videoTracks: canvasStream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });
        
        // Mix video from canvas + audio from original stream
        const mixedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...stream.getAudioTracks()
        ]);
        
        // Choose MIME type (prefer MP4 for better mobile compatibility)
        const preferredMimeTypes = [
          'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
          'video/mp4',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm'
        ];
        
        const chosenMimeType =
          typeof MediaRecorder !== 'undefined' && (MediaRecorder as any).isTypeSupported
            ? preferredMimeTypes.find((t) => MediaRecorder.isTypeSupported(t))
            : undefined;
        
        console.log('🎥 Using MIME type:', chosenMimeType || 'default');
        
        const recorder = chosenMimeType
          ? new MediaRecorder(mixedStream, { mimeType: chosenMimeType })
          : new MediaRecorder(mixedStream);
        
        // Cleanup function
        const cleanup = () => {
          isRecordingActive = false;
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
        };
        
        // Error handler
        recorder.onerror = (event: any) => {
          console.error('❌ MediaRecorder error:', event.error || event);
          cleanup();
          setIsRecording(false);
          setUploadError('Recording failed. Please try again.');
          if (stream) stream.getTracks().forEach(track => track.stop());
        };
        
        // Data handler
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
            console.log('📦 Data chunk received:', e.data.size, 'bytes');
          }
        };
        
        // Stop handler
        recorder.onstop = () => {
          cleanup();
          canvasRef.current = null;
          
          console.log('🛑 Recording stopped. Total chunks:', chunksRef.current.length);
          
          const mimeType = recorder.mimeType || chunksRef.current[0]?.type || 'video/mp4';
          const blob = new Blob(chunksRef.current, { type: mimeType });
          
          console.log('📹 Video blob created:', {
            size: blob.size,
            type: blob.type,
            sizeMB: (blob.size / 1024 / 1024).toFixed(2)
          });
          
          // Validate blob
          if (blob.size === 0) {
            console.error('❌ Recorded video blob is empty');
            setUploadError('Recording failed: empty video. Please try again.');
            setIsRecording(false);
            if (stream) stream.getTracks().forEach(track => track.stop());
            return;
          }
          
          videoBlobRef.current = blob;
          const url = URL.createObjectURL(blob);
          setCapturedMedia(url);
          setIsRecording(false);
          if (stream) stream.getTracks().forEach(track => track.stop());
        };
        
        // CRITICAL FIX 6: Start recording with timeslice
        try {
          recorder.start(1000); // Request data every second
          mediaRecorderRef.current = recorder;
          console.log('🔴 Recording started (front camera)');
        } catch (error) {
          console.error('❌ Failed to start MediaRecorder:', error);
          cleanup();
          setIsRecording(false);
          setUploadError('Failed to start recording. Please try again.');
        }
        
      } else {
        // ========================================
        // BACK CAMERA: Record directly from stream
        // ========================================
        const recorder = new MediaRecorder(stream);
        
        recorder.onerror = (event: any) => {
          console.error('❌ MediaRecorder error (back camera):', event.error || event);
          setIsRecording(false);
          setUploadError('Recording failed. Please try again.');
          if (stream) stream.getTracks().forEach(track => track.stop());
        };
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
            console.log('📦 Data chunk received (back):', e.data.size, 'bytes');
          }
        };
        
        recorder.onstop = () => {
          console.log('🛑 Recording stopped (back). Total chunks:', chunksRef.current.length);
          
          const mimeType = recorder.mimeType || chunksRef.current[0]?.type || 'video/webm';
          const blob = new Blob(chunksRef.current, { type: mimeType });
          
          console.log('📹 Video blob created (back):', {
            size: blob.size,
            type: blob.type,
            sizeMB: (blob.size / 1024 / 1024).toFixed(2)
          });
          
          if (blob.size === 0) {
            console.error('❌ Recorded video blob is empty (back camera)');
            setUploadError('Recording failed: empty video. Please try again.');
            setIsRecording(false);
            if (stream) stream.getTracks().forEach(track => track.stop());
            return;
          }
          
          videoBlobRef.current = blob;
          const url = URL.createObjectURL(blob);
          setCapturedMedia(url);
          setIsRecording(false);
          if (stream) stream.getTracks().forEach(track => track.stop());
        };
        
        try {
          recorder.start(1000);
          mediaRecorderRef.current = recorder;
          console.log('🔴 Recording started (back camera)');
        } catch (error) {
          console.error('❌ Failed to start MediaRecorder (back camera):', error);
          setIsRecording(false);
          setUploadError('Failed to start recording. Please try again.');
        }
      }

      // Auto-stop after 15 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          console.log('⏰ Auto-stopping after 15 seconds');
          mediaRecorderRef.current.stop();
        }
      }, 15000);
    }
  };

  const handleStopRecording = () => {
    // Stop animation frame loop if recording with front camera
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleRetake = () => {
    // Cleanup animation frame if exists
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    canvasRef.current = null;
    
    if (capturedMedia && mode === 'VIDEO') {
      URL.revokeObjectURL(capturedMedia);
    }
    setCapturedMedia(null);
    setStream(null); 
    setCaption('');
    setHashtags('');
    videoBlobRef.current = null; // Clear stored blob
    setUploadError(null); // Clear any upload errors
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

  const handlePublish = async () => {
    if (!capturedMedia) return;
    
    setLoading(true);
    setUploadError(null);
    
    try {
      let mediaUrl = capturedMedia;
      let thumbnail: string | null | undefined = undefined;
      const storyId = `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // CRITICAL FIX: For videos, DO NOT persist as base64 data URL (often unplayable/too heavy).
      // Upload to Supabase Storage and store a real URL in the story.
      if (mode === 'VIDEO' && videoBlobRef.current) {
        try {
          // CRITICAL FIX: Validate blob before upload
          if (videoBlobRef.current.size === 0) {
            throw new Error('Video blob is empty - recording may have failed');
          }
          
          console.log('Uploading video:', {
            size: videoBlobRef.current.size,
            type: videoBlobRef.current.type,
            storyId
          });
          
          // Generate a lightweight poster thumbnail (stored as data URL in DB).
          // This keeps `image_url` non-null and gives a stable poster frame.
          thumbnail = await mediaService.createVideoThumbnail(videoBlobRef.current);

          // Upload video blob -> Supabase Storage public URL (or null on failure)
          const uploadedUrl = await mediaService.uploadVideo(videoBlobRef.current, storyId);
          if (!uploadedUrl) {
            console.error('Upload returned null URL');
            throw new Error('Video upload failed: no URL returned');
          }
          
          console.log('Video uploaded successfully:', uploadedUrl);
          mediaUrl = uploadedUrl;
        } catch (error) {
          console.error('Error uploading video:', error);
          setUploadError(`Video upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please retry.`);
          setLoading(false);
          return;
        }
      }
      
      // Call onPostSuccess with the processed media URL
      onPostSuccess({
        storyId,
        locationName,
        caption,
        hashtags: hashtags.split(' ').filter(tag => tag.startsWith('#')),
        media: mediaUrl,
        thumbnail,
        isVideo: mode === 'VIDEO',
        lat: currentLat || 0,
        lng: currentLng || 0
      });
      
      // Cleanup: revoke blob URL if it was a video
      if (mode === 'VIDEO' && capturedMedia.startsWith('blob:')) {
        URL.revokeObjectURL(capturedMedia);
      }
    } catch (error) {
      console.error('Error publishing:', error);
      setUploadError('Failed to upload. Please try again.');
      setLoading(false);
    }
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
            <>
              <video 
                key={capturedMedia}
                ref={previewVideoRef}
                src={capturedMedia} 
                playsInline 
                preload="metadata"
                // IMPORTANT:
                // - Do not force autoplay with sound on mobile (often blocked).
                // - Do not set muted=true, otherwise preview will have no sound.
                // Playback is triggered via explicit user interaction (Play button).
                className="absolute inset-0 w-full h-full object-cover" 
              />

              {/* Custom preview controls: native controls are often hidden by the bottom panel on mobile */}
              <div className="absolute left-4 right-4 top-20 z-30">
                <div className="bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 p-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        void togglePreviewPlayback();
                      }}
                      className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center"
                      aria-label={isPreviewPlaying ? 'Pause' : 'Play'}
                    >
                      {isPreviewPlaying ? '❚❚' : '▶'}
                    </button>

                    <div className="flex-1">
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, previewDuration)}
                        step={0.05}
                        value={Math.min(previewCurrentTime, previewDuration || 0)}
                        onChange={(e) => {
                          seekPreviewTo(Number(e.target.value));
                        }}
                        className="w-full"
                      />
                      <div className="flex justify-between text-[10px] text-gray-200 mt-1 tabular-nums">
                        <span>{formatRecordingTime(Math.floor(previewCurrentTime))}</span>
                        <span>{formatRecordingTime(Math.floor(previewDuration))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
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
                {/* Error Message Display */}
                {uploadError && (
                  <div className="bg-red-900/50 border border-red-500/50 rounded-xl p-3 text-red-200 text-sm">
                    {uploadError}
                  </div>
                )}

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

export default CreateView;import { createClient } from '@supabase/supabase-js';