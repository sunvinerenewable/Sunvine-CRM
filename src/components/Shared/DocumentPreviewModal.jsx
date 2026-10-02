import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function DocumentPreviewModal({ doc, onClose }) {
  if (!doc) return null;

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isPdf = Boolean(
    doc.url?.toLowerCase().includes('.pdf') ||
    doc.filename?.toLowerCase().endsWith('.pdf') ||
    doc.fileType === 'application/pdf'
  );

  // Reset zoom/rotation when doc changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, [doc]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (!isPdf) {
        if (e.key === '+' || e.key === '=') setZoom(prev => Math.min(prev + 0.25, 4));
        if (e.key === '-') setZoom(prev => Math.max(prev - 0.25, 0.5));
        if (e.key === 'r' || e.key === 'R') setRotation(prev => (prev + 90) % 360);
        if (e.key === '0') {
          setZoom(1);
          setPosition({ x: 0, y: 0 });
          setRotation(0);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isPdf]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e) => {
    if (isPdf) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev + 0.15, 4));
    } else {
      setZoom(prev => Math.max(prev - 0.15, 0.5));
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = (e) => {
    if (e) e.preventDefault();
    if (!doc.url || isDownloading) return;

    setIsDownloading(true);
    try {
      const downloadName = doc.filename || (isPdf ? 'document.pdf' : 'document.jpg');
      const downloadEndpoint = `/api/storage-download?url=${encodeURIComponent(doc.url)}&filename=${encodeURIComponent(downloadName)}`;

      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadEndpoint;
      a.setAttribute('download', downloadName);
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        setIsDownloading(false);
      }, 1000);
    } catch (err) {
      console.error('[DocumentPreview] Download trigger failed:', err);
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-[#0D1527] border border-slate-700/80 rounded-2xl flex flex-col shadow-2xl overflow-hidden transition-all duration-200 ${
          isFullscreen
            ? 'w-[98vw] h-[96vh]'
            : 'w-full max-w-5xl h-[88vh]'
        }`}
      >
        {/* HEADER TOOLBAR */}
        <div className="bg-[#070D18] border-b border-slate-800 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 shrink-0">
          {/* Left: Document Info */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] sm:text-[22px] leading-none">
                {isPdf ? 'picture_as_pdf' : 'image'}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                  {doc.title || doc.label || 'Document Inspection'}
                </h3>
                <span className="hidden sm:inline-block text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-mono font-semibold bg-slate-800 text-emerald-400 border border-emerald-500/20 uppercase shrink-0">
                  {isPdf ? 'PDF Document' : 'Photo'}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-mono truncate mt-0.5">
                {doc.filename || 'document.pdf'} {doc.size ? `• ${doc.size}` : ''}
              </p>
            </div>
          </div>

          {/* Center (Desktop only >= md): Zoom, Scale & Rotate Controls Pill */}
          {!isPdf && doc.url && (
            <div className="hidden md:flex items-center justify-center shrink-0">
              <div className="h-9 flex items-center bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 gap-1 shadow-inner">
                <button
                  onClick={handleZoomOut}
                  className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                  title="Zoom Out (-)"
                >
                  <span className="material-symbols-outlined text-[18px] leading-none">zoom_out</span>
                </button>
                <span className="text-xs font-mono text-slate-200 px-1 min-w-[42px] text-center select-none font-semibold">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                  title="Zoom In (+)"
                >
                  <span className="material-symbols-outlined text-[18px] leading-none">zoom_in</span>
                </button>
                <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />
                <button
                  onClick={handleRotate}
                  className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                  title="Rotate 90° (R)"
                >
                  <span className="material-symbols-outlined text-[18px] leading-none">rotate_right</span>
                </button>
                <button
                  onClick={handleReset}
                  className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors text-[11px] font-semibold"
                  title="Reset View (0)"
                >
                  <span className="material-symbols-outlined text-[18px] leading-none">restart_alt</span>
                </button>
              </div>
            </div>
          )}

          {/* Right: Actions (Fullscreen, Download, Close) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(prev => !prev)}
              className="hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/70 cursor-pointer transition-colors text-xs"
              title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[18px] leading-none">
                {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
            </button>

            {/* Direct Save / Download */}
            {doc.url && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="h-8 sm:h-9 px-2.5 sm:px-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/60 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer shadow-md disabled:cursor-not-allowed shrink-0"
                title="Download document directly to device"
              >
                <span className={`material-symbols-outlined text-[16px] leading-none ${isDownloading ? 'animate-spin' : ''}`}>
                  {isDownloading ? 'progress_activity' : 'download'}
                </span>
                <span className="hidden sm:inline">{isDownloading ? 'Downloading...' : 'Download File'}</span>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-slate-800 hover:bg-rose-900/60 hover:border-rose-700 text-slate-400 hover:text-rose-200 rounded-xl border border-slate-700 cursor-pointer transition-colors shrink-0"
              title="Close (Esc)"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">close</span>
            </button>
          </div>
        </div>

        {/* MAIN VIEWPORT FRAME */}
        <div
          className="flex-1 bg-[#050A14] relative overflow-hidden flex items-center justify-center select-none"
          onWheel={handleWheel}
        >
          {doc.url ? (
            isPdf ? (
              /* PDF VIEWER */
              <div className="w-full h-full bg-slate-900">
                <iframe
                  src={`${doc.url}#toolbar=1&view=FitH`}
                  className="w-full h-full border-0"
                  title={doc.title || doc.filename || 'PDF Viewer'}
                />
              </div>
            ) : (
              /* INTERACTIVE IMAGE VIEWER WITH ZOOM & ROTATE */
              <div
                className="w-full h-full flex items-center justify-center overflow-hidden relative cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Mobile Floating Zoom & Rotate Controls Pill */}
                <div className="md:hidden absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center bg-slate-900/90 border border-slate-700/80 rounded-full p-1 gap-1 shadow-2xl backdrop-blur-md">
                  <button
                    onClick={handleZoomOut}
                    className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white active:bg-slate-800 rounded-full cursor-pointer"
                    title="Zoom Out (-)"
                  >
                    <span className="material-symbols-outlined text-[16px] leading-none">zoom_out</span>
                  </button>
                  <span className="text-[11px] font-mono text-slate-200 px-1 min-w-[36px] text-center select-none font-semibold">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white active:bg-slate-800 rounded-full cursor-pointer"
                    title="Zoom In (+)"
                  >
                    <span className="material-symbols-outlined text-[16px] leading-none">zoom_in</span>
                  </button>
                  <div className="w-[1px] h-3.5 bg-slate-700 mx-0.5" />
                  <button
                    onClick={handleRotate}
                    className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white active:bg-slate-800 rounded-full cursor-pointer"
                    title="Rotate 90°"
                  >
                    <span className="material-symbols-outlined text-[16px] leading-none">rotate_right</span>
                  </button>
                  <button
                    onClick={handleReset}
                    className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white active:bg-slate-800 rounded-full cursor-pointer"
                    title="Reset"
                  >
                    <span className="material-symbols-outlined text-[16px] leading-none">restart_alt</span>
                  </button>
                </div>

                <div
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${zoom})`,
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                    transformOrigin: 'center center'
                  }}
                  className="flex items-center justify-center max-w-full max-h-full p-4"
                >
                  <img
                    src={doc.url}
                    alt={doc.title || doc.filename || 'Document Preview'}
                    className="max-h-[75vh] max-w-[90vw] object-contain rounded-lg shadow-2xl ring-1 ring-slate-800/80 pointer-events-none"
                    draggable={false}
                  />
                </div>

                {/* Floating Zoom Indicator Pill */}
                {zoom !== 1 && (
                  <div className="hidden md:block absolute bottom-4 right-4 bg-slate-900/90 text-emerald-400 border border-slate-700/80 px-3 py-1.5 rounded-full text-xs font-mono font-bold shadow-lg pointer-events-none backdrop-blur-md">
                    {Math.round(zoom * 100)}% • {rotation}°
                  </div>
                )}
              </div>
            )
          ) : (
            /* EMPTY / OFFLINE FALLBACK */
            <div className="p-12 text-center space-y-3 max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-emerald-400">
                <span className="material-symbols-outlined text-3xl">verified_user</span>
              </div>
              <h4 className="text-base font-bold text-slate-200">{doc.filename || 'Document Verified'}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Document is logged in Supabase records. Upload a new copy to view high-resolution Cloudflare R2 preview.
              </p>
            </div>
          )}
        </div>

        {/* BOTTOM STATUS FOOTER */}
        <div className="bg-[#070D18] border-t border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
              <span className="material-symbols-outlined text-[14px]">verified_user</span>
              Sunvine Secure Document Vault
            </span>
            {!isPdf && doc.url && (
              <span className="hidden sm:inline text-slate-500 text-[11px]">
                Tip: Scroll or use +/- to zoom, drag to pan, R to rotate
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
