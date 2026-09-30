import React from 'react';
import { useLoading } from '../../context/LoadingContext';

/**
 * UiverseLoader - 9-Square Animated Brand Loader from Uiverse.io by JkHuger
 * Modified to Sunvine primary brand green (#6CBF3D)
 */
export function UiverseLoader({ className = '' }) {
  return (
    <div className={`loader ${className}`} aria-hidden="true">
      <div className="square" id="sq1"></div>
      <div className="square" id="sq2"></div>
      <div className="square" id="sq3"></div>
      <div className="square" id="sq4"></div>
      <div className="square" id="sq5"></div>
      <div className="square" id="sq6"></div>
      <div className="square" id="sq7"></div>
      <div className="square" id="sq8"></div>
      <div className="square" id="sq9"></div>
    </div>
  );
}

/**
 * GlobalActionLoader
 * High-visibility full-screen blurred backdrop overlay.
 * Bound strictly to explicit user actions (form submissions, button clicks, saving data).
 */
export default function GlobalActionLoader() {
  const { isLoading, message } = useLoading();

  if (!isLoading) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message || 'Processing, please wait...'}
      className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#070D18]/70 backdrop-blur-md transition-all duration-200 select-none animate-fade-in"
    >
      <div className="relative flex flex-col items-center justify-center px-10 py-8 rounded-3xl bg-[#0D1527]/85 border border-[#6CBF3D]/25 shadow-[0_25px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl">
        {/* Glow halo behind loader */}
        <div className="absolute w-24 h-24 bg-[#6CBF3D]/20 rounded-full blur-2xl pointer-events-none -translate-y-4"></div>

        {/* 9-Square Animated Grid Loader */}
        <div className="relative flex items-center justify-center my-2">
          <UiverseLoader />
        </div>

        {/* Dynamic Contextual Action Status */}
        <div className="mt-8 text-center max-w-[260px]">
          <p className="font-mono text-xs font-bold tracking-[0.14em] uppercase text-[#A1F96F]">
            {message || 'Processing Request...'}
          </p>
          <p className="text-[11px] text-slate-400 font-sans mt-1.5 leading-tight">
            Securing data with Sunvine Cloud
          </p>
        </div>
      </div>
    </div>
  );
}
