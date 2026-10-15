import React from 'react';

/**
 * Enterprise Sunvine Card Component
 * Rule 6: Dark console theme (#0D1527 card background, subtle border, shadow)
 */

export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`
        bg-[#0D1527] border border-slate-800/80 rounded-2xl shadow-xl shadow-black/20
        backdrop-blur-sm flex flex-col relative
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div
      className={`
        p-5 sm:p-6 border-b border-slate-800/60 rounded-t-2xl flex items-center justify-between gap-4
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3
      className={`
        text-base sm:text-lg font-bold text-slate-100 font-sans tracking-tight flex items-center gap-2.5
        ${className}
      `}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p className={`text-xs sm:text-sm text-slate-400 font-sans mt-0.5 ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`p-5 sm:p-6 flex-1 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div
      className={`
        p-4 sm:p-5 bg-slate-900/40 border-t border-slate-800/60 rounded-b-2xl flex items-center justify-between gap-4
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
