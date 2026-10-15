import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * HeightFrame:
 * Automatically measures its content height using ResizeObserver.
 * When `busy` (loading) toggles, it smoothly springs from the old height
 * to the new height, and then returns to `auto` so passive reflows and responsive
 * layouts follow instantly without clipping focus rings.
 */
function HeightFrame({ className, busy, children }) {
  const frameRef = useRef(null);
  const contentRef = useRef(null);
  const lastHeightRef = useRef(null);
  const changedAtRef = useRef(0);

  useLayoutEffect(() => {
    changedAtRef.current = performance.now();
  }, [busy]);

  useEffect(() => {
    const node = contentRef.current;
    const frame = frameRef.current;
    if (!node || !frame || typeof ResizeObserver === 'undefined') return;

    let animControl = null;
    const settle = () => {
      frame.style.height = 'auto';
      frame.style.overflow = '';
    };

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const next = entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight;
      const from = lastHeightRef.current;
      lastHeightRef.current = next;

      if (animControl) {
        try { animControl.cancel(); } catch { /* ignore */ }
      }

      const prefersReduced = typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

      if (prefersReduced || from === undefined || from === null || from === next || performance.now() - changedAtRef.current > 250) {
        return settle();
      }

      frame.style.overflow = 'hidden';
      try {
        animControl = frame.animate([
          { height: `${from}px` },
          { height: `${next}px` }
        ], {
          duration: 300,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'forwards'
        });
        animControl.onfinish = settle;
      } catch {
        settle();
      }
    });

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (animControl) {
        try { animControl.cancel(); } catch { /* ignore */ }
      }
    };
  }, [busy]);

  return (
    <div ref={frameRef} className={cn("w-full transition-[height]", className)} aria-busy={busy}>
      <div ref={contentRef} className="w-full">
        {children}
      </div>
    </div>
  );
}

/**
 * Fluid, Wave-Pulsing Skeleton with Crossfade & Height-Morphing:
 * - Standalone mode: `<Skeleton className="h-6 w-24 rounded" />`
 * - Wave line mode: `<Skeleton lines={3} avatar={true} />`
 * - Wrapper mode: `<Skeleton loading={isLoading}>{content}</Skeleton>`
 */
export function Skeleton({
  label = "Loading content",
  lines,
  avatar = false,
  className,
  children,
  loading = true,
  style,
  ...props
}) {
  // If lines or avatar are explicitly requested
  const hasWavePreset = lines !== undefined || avatar;
  const lineCount = Math.min(Math.max(Math.floor(lines || 3), 1), 6);

  const placeholder = (extraClasses) => {
    if (hasWavePreset) {
      return (
        <div
          className={cn("flex items-start gap-3 w-full", extraClasses)}
          role="status"
          aria-label={label}
          aria-busy="true"
        >
          {avatar && (
            <div
              className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0"
              style={{ animationDelay: '0ms' }}
              aria-hidden="true"
            />
          )}
          <div className="flex flex-col gap-2 flex-1 min-w-0" aria-hidden="true">
            {Array.from({ length: lineCount }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-4 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse",
                  index === lineCount - 1 && lineCount > 1 ? "w-3/4" : "w-full"
                )}
                style={{
                  animationDelay: `${(index + (avatar ? 1 : 0)) * 120}ms`
                }}
              />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "animate-pulse rounded-md bg-slate-200 dark:bg-slate-700",
          className
        )}
        style={style}
        role="status"
        aria-label={label}
        aria-busy="true"
        {...props}
      />
    );
  };

  // 1. Standalone placeholder mode (direct replacement for shadcn Skeleton)
  if (children === undefined) {
    return placeholder(className);
  }

  // 2. Wrapper mode: smoothly height-morphs and crossfades from placeholder into children
  return (
    <HeightFrame className={className} busy={loading}>
      {loading ? (
        <div key="placeholder" className="animate-fade-in w-full">
          {placeholder()}
        </div>
      ) : (
        <div key="content" className="animate-stagger-fade w-full">
          {children}
        </div>
      )}
    </HeightFrame>
  );
}

export default Skeleton;
