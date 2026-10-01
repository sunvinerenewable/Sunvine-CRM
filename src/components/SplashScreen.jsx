import React, { useEffect, useState } from 'react';

export default function SplashScreen({ onFinish }) {
  const [fadeState, setFadeState] = useState('in');

  useEffect(() => {
    // Fast 400ms display, then smooth fade out (completed by 650ms)
    const timer = setTimeout(() => {
      setFadeState('out');
    }, 400);

    const finishTimer = setTimeout(() => {
      onFinish();
    }, 650);

    return () => {
      clearTimeout(timer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 w-screen h-screen z-[99999] flex flex-col justify-between items-center bg-[#0F1B2E] text-white overflow-hidden selection:bg-[#6CBF3D] selection:text-[#0F1B2E] transition-opacity duration-300 ${
        fadeState === 'out' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ambient Glow & Subtle Vignette */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full pointer-events-none blur-[40px]"
        style={{
          background: 'radial-gradient(circle, rgba(108, 191, 61, 0.15) 0%, rgba(16, 185, 129, 0.06) 45%, rgba(15, 27, 46, 0) 72%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, transparent 35%, rgba(8, 14, 25, 0.7) 100%)',
        }}
      />

      {/* Top spacer for optical centering */}
      <div className="h-20 w-full"></div>

      {/* Central Composition: Pure Logo & Tagline */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-2xl animate-fade-in">
        {/* Sunvine Official Emblem Graphic */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute w-28 h-28 bg-[#6CBF3D]/20 rounded-full blur-xl pointer-events-none"></div>

          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#132238]/90 border border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.45)] flex items-center justify-center backdrop-blur-md filter drop-shadow-[0_0_28px_rgba(108,191,61,0.35)]">
            <svg className="w-14 h-14 sm:w-16 sm:h-16" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="sunvineGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#84E34F" />
                  <stop offset="100%" stopColor="#58A82C" />
                </linearGradient>
              </defs>
              <path d="M35.5 8L18 34.5H32.5L26.5 56L47 27.5H32L35.5 8Z" fill="url(#sunvineGrad)"/>
              <circle cx="36" cy="9.5" r="3" fill="#FFFFFF" className="drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
            </svg>
          </div>
        </div>

        {/* Official Brand Wordmark */}
        <div className="flex flex-col items-center">
          <h1 className="font-poppins font-extrabold text-4xl sm:text-5xl lg:text-[54px] tracking-[-0.035em] text-white leading-none drop-shadow-sm">
            sunvine
          </h1>
          <div className="mt-2.5 sm:mt-3">
            <span className="font-poppins font-bold text-xs sm:text-sm tracking-[0.42em] uppercase text-[#6CBF3D] pl-[0.42em] drop-shadow-[0_0_12px_rgba(108,191,61,0.4)]">
              RENEWABLE
            </span>
          </div>
        </div>

        {/* Horizontal divider hairline */}
        <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent my-6"></div>

        {/* Brand Tagline */}
        <p className="font-inter font-medium text-xs sm:text-sm tracking-[0.22em] text-slate-300 uppercase max-w-lg leading-relaxed pl-[0.22em]">
          CLEAN ENERGY. SUSTAINABLE FUTURE. BETTER TOMORROW.
        </p>
      </main>

      {/* Minimalist Footer */}
      <footer className="relative z-10 pb-10 sm:pb-12 text-center">
        <p className="font-inter font-medium text-[11px] sm:text-xs tracking-[0.28em] text-slate-500 uppercase pl-[0.28em]">
          POWERING TODAY. PROTECTING TOMORROW.
        </p>
      </footer>
    </div>
  );
}
