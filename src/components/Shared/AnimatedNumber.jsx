import React, { useEffect, useState } from 'react';

/**
 * AnimatedNumber:
 * Smoothly counts up from 0 to the target metric when data finishes loading.
 * Uses requestAnimationFrame with easeOutExpo curve for silky 60fps deceleration.
 * Adheres to Ponytail Protocol (zero external libraries, native standard JS).
 */
export default function AnimatedNumber({
  value = 0,
  duration = 600,
  delay = 0,
  formatter = (v) => v,
  className = '',
  decimals = 0
}) {
  const numericTarget = typeof value === 'number'
    ? value
    : parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;

  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Respect OS reduced motion preference
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      setDisplayValue(numericTarget);
      return;
    }

    let startTimestamp = null;
    let animId = null;

    const timer = setTimeout(() => {
      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = timestamp - startTimestamp;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutExpo: 1 - 2^(-10t)
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = numericTarget * ease;

        setDisplayValue(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.round(current));

        if (progress < 1) {
          animId = requestAnimationFrame(step);
        } else {
          setDisplayValue(numericTarget);
        }
      };
      animId = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [numericTarget, duration, delay, decimals]);

  return <span className={className}>{formatter(displayValue)}</span>;
}
