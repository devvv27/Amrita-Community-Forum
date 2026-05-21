import React from 'react';

export default function Badge({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'signal-badge',
    neon: 'signal-badge neon',
    pink: 'signal-badge pink',
  };

  return <span className={`${tones[tone] || tones.neutral} ${className}`}>{children}</span>;
}
