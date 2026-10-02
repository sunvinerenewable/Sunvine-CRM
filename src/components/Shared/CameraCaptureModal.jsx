import React, { useState, useRef, useEffect } from 'react';
import { compressImage, formatFileSize } from '../../utils/mediaOptimizer';

export default function CameraCaptureModal({ isOpen, onClose, onCapture, mode = 'photo', documentLabel = 'Document Photo' }) {
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (selfie)
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [captureStats, setCaptureStats] = useState(null);

  // Video recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordTimer, setRecordTimer] = useState(0);
  const mediaRecorderRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCapturedPreview(null);
      setCaptureStats(null);
      setIsRecording(false);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    stopCamera();
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera hardware access is not supported by this browser.');
      }

      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: mode === 'video'
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStreamActive(true);
    } catch (err) {
      console.warn('[CameraCaptureModal] Camera initialization error:', err);
      setCameraError(err.message || 'Unable to access camera. Please allow camera permissions or upload an image file.');
      setStreamActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setStreamActive(false);
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture Photo
  const handleTakePhoto = async () => {
    if (!videoRef.current) return;
    setIsProcessing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsProcessing(false);
          return;
        }

        const rawFile = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        // Compress client-side
        const compressedResult = await compressImage(rawFile, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });

        setCapturedPreview(compressedResult.dataUrl);
        setCaptureStats(compressedResult);
        setIsProcessing(false);
      }, 'image/jpeg', 0.95);
    } catch (e) {
      console.error('Capture photo error:', e);
      setIsProcessing(false);
    }
  };

  // Video Recording handlers
  const handleStartRecording = () => {
    if (!mediaStreamRef.current) return;
    setRecordedChunks([]);
    setRecordTimer(0);

    try {
      const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType: 'video/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          setRecordedChunks(prev => [...prev, e.data]);
        }
      };

      recorder.onstop = () => {
        clearInterval(timerIntervalRef.current);
      };

      recorder.start(500); // 500ms chunk timeslice
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordTimer(t => t + 1);
      }, 1000);
    } catch (e) {
      console.error('Error starting video recorder:', e);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);

      setTimeout(() => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const videoFile = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(blob);
        setCapturedPreview(videoUrl);
        setCaptureStats({
          file: videoFile,
          originalSize: blob.size,
          compressedSize: blob.size,
          originalFormatted: formatFileSize(blob.size),
          compressedFormatted: formatFileSize(blob.size),
          reduction: '0%',
          isVideo: true
        });
      }, 300);
    }
  };

  const handleRetake = () => {
    setCapturedPreview(null);
    setCaptureStats(null);
    setRecordedChunks([]);
    setRecordTimer(0);
    startCamera();
  };

  const handleConfirm = () => {
    if (!captureStats) return;
    onCapture(captureStats);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative bg-surface-container-lowest border border-surface-container-high rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-on-surface">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-container-high bg-surface-container-low/60">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              {mode === 'video' ? 'videocam' : 'photo_camera'}
            </span>
            <span className="font-bold text-sm text-on-surface">{documentLabel} — Camera Capture</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Viewfinder / Preview Body */}
        <div className="relative bg-black aspect-4/3 flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center text-secondary space-y-3">
              <span className="material-symbols-outlined text-error text-4xl">no_photography</span>
              <p className="text-xs text-on-surface max-w-xs">{cameraError}</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg cursor-pointer hover:bg-primary/90">
                <span className="material-symbols-outlined text-sm">upload_file</span>
                <span>Select from Device</span>
                <input
                  type="file"
                  accept={mode === 'video' ? 'video/*' : 'image/*'}
                  capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const res = await compressImage(f);
                      onCapture(res);
                      onClose();
                    }
                  }}
                />
              </label>
            </div>
          ) : capturedPreview ? (
            captureStats?.isVideo ? (
              <video src={capturedPreview} controls autoPlay className="w-full h-full object-contain" />
            ) : (
              <img src={capturedPreview} alt="Captured Preview" className="w-full h-full object-contain" />
            )
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Camera Framing Grid */}
              <div className="absolute inset-0 pointer-events-none border border-white/20 grid grid-cols-3 grid-rows-3">
                <div className="border-r border-b border-white/10"></div>
                <div className="border-r border-b border-white/10"></div>
                <div className="border-b border-white/10"></div>
                <div className="border-r border-b border-white/10"></div>
                <div className="border-r border-b border-white/10"></div>
                <div className="border-b border-white/10"></div>
              </div>

              {/* Facing mode switch toggle */}
              <button
                type="button"
                onClick={toggleFacingMode}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 backdrop-blur-xs transition-colors cursor-pointer"
                title="Switch Camera (Front/Back)"
              >
                <span className="material-symbols-outlined text-lg">flip_camera_ios</span>
              </button>

              {isRecording && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/90 text-white text-xs font-mono font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white"></span>
                  <span>REC {Math.floor(recordTimer / 60)}:{(recordTimer % 60).toString().padStart(2, '0')}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Compression Statistics Banner (Post-capture) */}
        {captureStats && (
          <div className="px-4 py-2 bg-emerald-500/10 border-t border-b border-emerald-500/20 text-xs flex items-center justify-between text-emerald-400">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="material-symbols-outlined text-sm">speed</span>
              <span>Compressed: {captureStats.originalFormatted} → <strong>{captureStats.compressedFormatted}</strong></span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[10px] font-bold">
              {captureStats.reduction} Size Saved
            </span>
          </div>
        )}

        {/* Control Footer */}
        <div className="p-4 bg-surface-container-low/50 flex items-center justify-between gap-3">
          {capturedPreview ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2.5 rounded-xl border border-surface-container-highest text-secondary hover:text-on-surface text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span>Retake</span>
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">done_all</span>
                <span>Use Optimized Media</span>
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-center relative">
              {mode === 'video' ? (
                isRecording ? (
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer"
                  >
                    <div className="w-5 h-5 rounded-xs bg-white"></div>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer ring-4 ring-red-500/30"
                  >
                    <span className="material-symbols-outlined text-2xl">videocam</span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  disabled={isProcessing || !streamActive}
                  className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-on-primary flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer ring-4 ring-primary/30 disabled:opacity-50"
                  title="Capture Photo"
                >
                  <span className="material-symbols-outlined text-2xl">photo_camera</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
