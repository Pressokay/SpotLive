// Remplacez toute la partie VIDEO dans handleCapture (lignes ~200-400)
// Cherchez "} else {" après le bloc PHOTO MODE

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