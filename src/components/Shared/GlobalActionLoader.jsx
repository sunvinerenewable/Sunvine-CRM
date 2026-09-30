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
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading..."
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/45 backdrop-blur-md transition-all duration-200 select-none animate-fade-in"
    >
      <UiverseLoader />
    </div>
  );
}
