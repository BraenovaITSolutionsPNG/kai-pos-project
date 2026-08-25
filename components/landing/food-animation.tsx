"use client";

import { useMemo } from "react";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function FoodAnimation({ count = 5 }: { count?: number }) {
  const waves = useMemo(() => {
    const rand = seededRandom(42);
    return Array.from({ length: count }, (_, i) => ({
      x: rand() * 100,
      y: rand() * 100,
      scale: rand() * 0.5 + 0.8,
      duration: rand() * 15 + 20,
      delay: rand() * 10,
      opacity: rand() * 0.15 + 0.08,
      rotation: rand() * 360,
      id: i,
    }));
  }, [count]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Gradient wave blobs */}
      {waves.map((wave) => (
        <div
          key={wave.id}
          className="absolute animate-gradient-wave"
          style={{
            left: `${wave.x}%`,
            top: `${wave.y}%`,
            width: `${180 * wave.scale}px`,
            height: `${180 * wave.scale}px`,
            "--wave-duration": `${wave.duration}s`,
            "--wave-delay": `${wave.delay}s`,
            "--wave-rotation": `${wave.rotation}deg`,
            opacity: wave.opacity,
          } as React.CSSProperties}
        />
      ))}

      {/* Subtle color shift overlay */}
      <div className="absolute inset-0 animate-gradient-shift" />
    </div>
  );
}