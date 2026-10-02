import React, { useState, useRef } from 'react';

/**
 * SwipeableMetricCard - Interactive Executive Metric Card with multi-slide breakdown
 * Supports:
 * - Next / Prev navigation buttons with 44px touch targets
 * - Touch swipe gestures (left / right)
 * - Keyboard navigation (ArrowLeft / ArrowRight) when focused
 * - Slide indicators (dots)
 */
export default function SwipeableMetricCard({
  title,
  icon,
  badgeText,
  slides = [],
  colorScheme = 'primary' // 'primary' | 'emerald' | 'purple' | 'amber' | 'blue'
}) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const touchStartXRef = useRef(null);
  const cardRef = useRef(null);

  const totalSlides = slides.length;
  if (totalSlides === 0) return null;

  const currentSlide = slides[currentSlideIndex] || slides[0];

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    setCurrentSlideIndex(prev => (prev > 0 ? prev - 1 : totalSlides - 1));
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    setCurrentSlideIndex(prev => (prev < totalSlides - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation when card is focused
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    }
  };

  // Touch swipe handling
  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    if (e.changedTouches && e.changedTouches.length === 1) {
      const touchEndX = e.changedTouches[0].clientX;
      const diffX = touchEndX - touchStartXRef.current;
      if (Math.abs(diffX) > 40) {
        if (diffX < 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    }
    touchStartXRef.current = null;
  };

  const colorStyles = {
    primary: {
      bgIcon: 'bg-primary/10 text-primary',
      badge: 'bg-primary-container/15 text-primary',
      borderHover: 'hover:border-primary/50'
    },
    emerald: {
      bgIcon: 'bg-emerald-500/10 text-emerald-600',
      badge: 'bg-emerald-500/15 text-emerald-700',
      borderHover: 'hover:border-emerald-500/50'
    },
    purple: {
      bgIcon: 'bg-purple-500/10 text-purple-600',
      badge: 'bg-purple-500/15 text-purple-700',
      borderHover: 'hover:border-purple-500/50'
    },
    amber: {
      bgIcon: 'bg-amber-500/10 text-amber-600',
      badge: 'bg-amber-500/15 text-amber-700',
      borderHover: 'hover:border-amber-500/50'
    },
    blue: {
      bgIcon: 'bg-blue-500/10 text-blue-600',
      badge: 'bg-blue-500/15 text-blue-700',
      borderHover: 'hover:border-blue-500/50'
    }
  }[colorScheme] || {
    bgIcon: 'bg-primary/10 text-primary',
    badge: 'bg-primary-container/15 text-primary',
    borderHover: 'hover:border-primary/50'
  };

  return (
    <div
      ref={cardRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label={`${title} Metric Card, slide ${currentSlideIndex + 1} of ${totalSlides}`}
      className={`kpi-card relative bg-surface-container-lowest rounded-xl border border-surface-container-highest p-4 sm:p-5 shadow-sm flex flex-col justify-between group transition-all duration-200 outline-none focus:ring-2 focus:ring-primary/40 ${colorStyles.borderHover}`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorStyles.bgIcon}`}>
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
          </div>
          <div className="min-w-0">
            <span className="font-label-sm text-xs text-secondary font-semibold uppercase tracking-wider block truncate">
              {title}
            </span>
            <span className="text-[11px] text-secondary font-medium block truncate">
              {currentSlide.slideTitle || `View ${currentSlideIndex + 1} of ${totalSlides}`}
            </span>
          </div>
        </div>

        {/* Carousel Navigation Arrows */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous breakdown"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-surface-container-low hover:bg-surface-container text-secondary hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
            title="Previous view (or Press ← key)"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next breakdown"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-surface-container-low hover:bg-surface-container text-secondary hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
            title="Next view (or Press → key)"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Main Slide Content Area */}
      <div className="my-3 min-h-[70px] flex flex-col justify-center">
        {currentSlide.renderContent ? (
          currentSlide.renderContent()
        ) : (
          <div>
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className="font-headline-xl text-2xl sm:text-3xl font-black text-on-surface tracking-tight font-mono">
                {currentSlide.mainValue}
              </span>
              {currentSlide.badge && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${colorStyles.badge}`}>
                  {currentSlide.badge}
                </span>
              )}
            </div>
            {currentSlide.subValue && (
              <p className="font-label-sm text-xs text-secondary font-medium mt-1">
                {currentSlide.subValue}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer Breakdown Row + Slide Dots */}
      <div className="pt-3 border-t border-surface-container-high flex items-center justify-between text-secondary font-body-sm text-xs">
        <div className="min-w-0 truncate pr-2">
          {currentSlide.footerText || badgeText || 'Interactive data'}
        </div>

        {/* Slide Indicators */}
        <div className="flex items-center gap-1.5 shrink-0">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentSlideIndex(idx);
              }}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentSlideIndex
                  ? 'w-4 bg-primary'
                  : 'w-1.5 bg-surface-container-highest hover:bg-secondary'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
