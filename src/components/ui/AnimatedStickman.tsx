'use client';

import React from 'react';

/**
 * AnimatedStickman Component
 * 
 * Renders an animated stick figure that walks across the screen.
 * The animation includes walking movement, arm swinging, and leg stepping.
 */
const AnimatedStickman: React.FC = () => {
  return (
    <div className="absolute bottom-0 left-0 w-full h-8 overflow-hidden pointer-events-none">
      <div className="animate-walk absolute bottom-0 h-8 w-6">
        <svg
          viewBox="0 0 24 32"
          className="w-full h-full text-[var(--foreground)] opacity-60"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          role="presentation"
        >
          {/* Head */}
          <circle cx={12} cy={4} r={3} />

          {/* Body */}
          <line x1={12} y1={7} x2={12} y2={20} />

          {/* Arms */}
          <line
            x1={8}
            y1={12}
            x2={16}
            y2={12}
            className="animate-swing"
          />

          {/* Legs */}
          <line
            x1={12}
            y1={20}
            x2={8}
            y2={28}
            className="animate-step-left"
          />
          <line
            x1={12}
            y1={20}
            x2={16}
            y2={28}
            className="animate-step-right"
          />
        </svg>
      </div>
    </div>
  );
};

export default AnimatedStickman;
