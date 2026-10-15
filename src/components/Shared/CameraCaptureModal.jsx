import React, { useState, useRef, useEffect } from 'react';
import { compressToMaxSize, formatFileSize } from '../../utils/mediaOptimizer';

// ─── Upload Progress Bar ─────────────────────────────────────────────────────

function ProgressBar({ progress }) {
  return (
    <div className="space-y-1.5 py-1">
      <div className="flex items-center justify-between text-[11px] text-white/60">
        <span className="flex items-center gap-1.5 font-medium">
          <span
            className="material-symbols-outlined text-[14px] text-emerald-400"
            style={{ animation: 'spin 1.2s linear infinite' }}
          >
            progress_activity
          </span>
          Uploading to Cloudflare R2 Vault…
        </span>
        <span className="font-mono font-bold text-emerald-400">{progress}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Modal Component ────────────────────────────────────────────────────

export default function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  documentLabel = 'Document Photo',
  maxPhotos = 5,
  isUploading = false,
  uploadProgress = 0,
  // Legacy aliases
  docLabel,
  docKey,
}) {
  const label = documentLabel || docLabel || 'Document Photo';
  const galleryInputRef = useRef(null);
  const docInputRef = useRef(null);

  const [fileItems, setFileItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Reset state when modal is opened or closed
  useEffect(() => {
    if (!isOpen) {
      setFileItems([]);
      setIsProcessing(false);
      setProcessingStatus('');
      setIsDragging(false);
      setErrorMessage('');
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isUploading && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isUploading, onClose]);

  if (!isOpen) return null;

  // Process incoming files (Images compressed, PDFs validated)
  const processFiles = async (rawFiles) => {
    if (!rawFiles || rawFiles.length === 0) return;
    setErrorMessage('');
    setIsProcessing(true);

    const availableSlots = Math.max(0, maxPhotos - fileItems.length);
    if (availableSlots <= 0) {
      setErrorMessage(`Maximum limit of ${maxPhotos} files reached.`);
      setIsProcessing(false);
      return;
    }

    const filesToProcess = Array.from(rawFiles).slice(0, availableSlots);
    const newItems = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name);

      if (!isPdf && !isImage) {
        setErrorMessage(`"${file.name}" ignored. Only Images (JPG, PNG, WebP) and PDFs are allowed.`);
        continue;
      }

      setProcessingStatus(`Optimizing ${i + 1} of ${filesToProcess.length}: ${file.name}`);

      if (isPdf) {
        // Enforce 2 MB limit for PDFs
        if (file.size > 2 * 1024 * 1024) {
          setErrorMessage(`PDF "${file.name}" exceeds 2 MB limit (${formatFileSize(file.size)}). Please compress before upload.`);
          continue;
        }
        newItems.push({
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          name: file.name,
          isPdf: true,
          previewUrl: null,
          originalSize: file.size,
          originalFormatted: formatFileSize(file.size),
          compressedSize: file.size,
          compressedFormatted: formatFileSize(file.size),
          reduction: '0%',
          dataUrl: null,
        });
      } else {
        // Image: client-side compression to ≤ 2MB, EXIF stripped
        try {
          const stats = await compressToMaxSize(file, 2 * 1024 * 1024);
          newItems.push({
            id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            file: stats.file || file,
            name: file.name,
            isPdf: false,
            previewUrl: stats.dataUrl || URL.createObjectURL(file),
            originalSize: stats.originalSize,
            originalFormatted: stats.originalFormatted,
            compressedSize: stats.compressedSize,
            compressedFormatted: stats.compressedFormatted,
            reduction: stats.reduction,
            dataUrl: stats.dataUrl,
          });
        } catch (err) {
          console.warn('[MediaUploadModal] Compression error, using raw image:', err);
          newItems.push({
            id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            file,
            name: file.name,
            isPdf: false,
            previewUrl: URL.createObjectURL(file),
            originalSize: file.size,
            originalFormatted: formatFileSize(file.size),
            compressedSize: file.size,
            compressedFormatted: formatFileSize(file.size),
            reduction: '0%',
            dataUrl: null,
          });
        }
      }
    }

    setFileItems(prev => [...prev, ...newItems]);
    setIsProcessing(false);
    setProcessingStatus('');
  };

  const handleFileInputChange = (e) => {
    if (e.target.files?.length) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleRemoveItem = (idToRemove) => {
    setFileItems(prev => {
      const target = prev.find(item => item.id === idToRemove);
      if (target?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(item => item.id !== idToRemove);
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Confirm and deliver files to parent
  const handleConfirmUpload = () => {
    if (fileItems.length === 0) return;

    // Backward-compatible payload: emit single stats object if 1 item, or array if multiple
    if (fileItems.length === 1) {
      onCapture(fileItems[0]);
    } else {
      onCapture(fileItems);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.15s ease' }}
    >
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div
        className="relative bg-[#0D1527] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-white"
        style={{ maxHeight: '94dvh' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-emerald-400 text-[18px]">upload_file</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm text-white truncate font-space">{label}</h2>
              <p className="text-[10px] text-white/50">Upload KYC Media &amp; Documents</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto overscroll-contain p-5 space-y-4 flex-1">
          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-rose-400 shrink-0">error</span>
              <span className="flex-1">{errorMessage}</span>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="py-6 px-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-2.5 text-center">
              <div
                className="w-8 h-8 rounded-full border-3 border-emerald-500/20 border-t-emerald-400"
                style={{ animation: 'spin 0.8s linear infinite' }}
              />
              <p className="text-xs text-emerald-400 font-semibold">{processingStatus || 'Optimizing media…'}</p>
              <p className="text-[10px] text-white/40">Compressing images to ≤ 2 MB · Stripping EXIF metadata</p>
            </div>
          )}

          {/* Action Buttons: 1. Device Gallery Media Picker (Direct Photos) & 2. Browse Documents (PDF) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Direct Device Gallery / Media Picker */}
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-sm min-h-[46px]"
            >
              <span className="material-symbols-outlined text-lg">photo_library</span>
              <span>Choose from Gallery / Photos</span>
            </button>

            {/* Document / PDF File Picker */}
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 min-h-[46px]"
            >
              <span className="material-symbols-outlined text-lg text-emerald-400">drive_folder_upload</span>
              <span>Browse Documents &amp; PDF</span>
            </button>

            {/* Hidden native input 1: pure image/* to trigger native Android Gallery */}
            <input
              ref={galleryInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {/* Hidden native input 2: PDF and documents */}
            <input
              ref={docInputRef}
              type="file"
              multiple
              accept="application/pdf,.pdf,image/*"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => galleryInputRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed p-5 sm:p-7 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-emerald-400 bg-emerald-500/15 scale-[0.99]'
                : 'border-white/15 bg-white/5 hover:bg-white/[0.07] hover:border-emerald-500/40'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-sm">
              <span className="material-symbols-outlined text-2xl">cloud_upload</span>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white">
                {isDragging ? 'Drop files here' : 'Or Drag & Drop files here'}
              </p>
              <p className="text-[11px] text-white/50 mt-0.5">
                Drop multiple images or PDF documents
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-[9px] font-mono text-white/60">JPG</span>
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-[9px] font-mono text-white/60">PNG</span>
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-[9px] font-mono text-white/60">WEBP</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-[9px] font-mono font-bold text-emerald-300">PDF</span>
              <span className="text-[9px] text-white/40">· Max {maxPhotos} files · ≤ 2 MB each</span>
            </div>
          </div>

          {/* Selected Files Preview List */}
          {fileItems.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/80 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-400 text-[16px]">check_circle</span>
                  <span>Attached Files ({fileItems.length} of {maxPhotos})</span>
                </span>
                {fileItems.length < maxPhotos && (
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">add_photo_alternate</span>
                      <span>+ Photos</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => docInputRef.current?.click()}
                      className="text-[11px] font-semibold text-white/60 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">note_add</span>
                      <span>+ PDF</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {fileItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/[0.08] border border-white/10 flex items-center gap-3 transition-colors"
                  >
                    {/* Thumbnail / Icon */}
                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                      {item.isPdf ? (
                        <span className="material-symbols-outlined text-rose-400 text-2xl">picture_as_pdf</span>
                      ) : item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-emerald-400 text-2xl">image</span>
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                        {item.isPdf ? (
                          <span className="text-rose-300 font-mono font-medium">PDF · {item.compressedFormatted}</span>
                        ) : (
                          <span className="text-white/50 font-mono">
                            {item.originalFormatted} → <strong className="text-emerald-400">{item.compressedFormatted}</strong>
                          </span>
                        )}
                        {!item.isPdf && item.reduction && item.reduction !== '0%' && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[9px]">
                            {item.reduction} saved
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                      title="Remove file"
                      aria-label="Remove file"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress Bar (when driven by parent) */}
          {isUploading && <ProgressBar progress={uploadProgress} />}

          {/* Info footnote */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-white/40 text-[10px]">
            <span className="material-symbols-outlined text-[13px] text-emerald-400 shrink-0">verified_user</span>
            <span>Files are encrypted &amp; stored securely in Cloudflare R2 Vault. GPS EXIF stripped for privacy.</span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="flex-1 py-2.5 px-4 rounded-xl border border-white/15 text-white/70 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40"
          >
            <span>Cancel</span>
          </button>
          <button
            type="button"
            onClick={handleConfirmUpload}
            disabled={fileItems.length === 0 || isUploading || isProcessing}
            className="flex-[2] py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
            style={{ boxShadow: fileItems.length > 0 ? '0 4px 20px rgba(16,185,129,0.25)' : 'none' }}
          >
            <span className="material-symbols-outlined text-base">cloud_upload</span>
            <span>
              {fileItems.length === 0
                ? 'Select Files to Upload'
                : `Upload ${fileItems.length} File${fileItems.length > 1 ? 's' : ''} to Vault`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
