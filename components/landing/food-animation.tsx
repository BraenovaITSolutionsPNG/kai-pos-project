"use client";

import { useMemo } from "react";

const FOOD_EMOJI = [
  { emoji: "🍛", size: 40 },
  { emoji: "🍖", size: 36 },
  { emoji: "🍳", size: 34 },
  { emoji: "🍝", size: 38 },
  { emoji: "🍱", size: 36 },
  { emoji: "🍕", size: 40 },
  { emoji: "🍤", size: 32 },
  { emoji: "🥗", size: 36 },
  { emoji: "🍲", size: 38 },
  { emoji: "🍰", size: 34 },
  { emoji: "🥩", size: 36 },
  { emoji: "🍜", size: 38 },
  { emoji: "🥟", size: 32 },
  { emoji: "☕", size: 34 },
  { emoji: "🧁", size: 32 },
  { emoji: "🥤", size: 36 },
];

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

export function FoodAnimation({ count = 18 }: { count?: number }) {
  const items = useMemo(() => {
    const rand = seededRandom(42);
    return Array.from({ length: count }, (_, i) => {
      const food = FOOD_EMOJI[i % FOOD_EMOJI.length];
      const x = rand() * 95 + 2;
      const duration = rand() * 10 + 12;
      const delay = rand() * 14;
      const variant = rand() > 0.5 ? "animate-food-drift" : "animate-food-drift-alt";
      const opacity = rand() * 0.25 + 0.15;
      return { ...food, x, duration, delay, variant, opacity, id: i };
    });
  }, [count]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >

      {/* Floating food emoji */}
      {items.map((item) => (
        <span
          key={item.id}
          className={`absolute select-none ${item.variant}`}
          style={{
            left: `${item.x}%`,
            bottom: "0%",
            fontSize: `${item.size}px`,
            "--food-duration": `${item.duration}s`,
            "--food-delay": `${item.delay}s`,
            filter: "blur(0.3px)",
            opacity: item.opacity,
          } as React.CSSProperties}
        >
          {item.emoji}
        </span>
      ))}

      {/* Subtle pulsing food emoji in the background */}
      {FOOD_EMOJI.slice(0, 6).map((food, i) => (
        <span
          key={`pulse-${i}`}
          className="absolute select-none animate-food-pulse"
          style={{
            left: `${15 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
            fontSize: `${food.size * 1.5}px`,
            "--food-delay": `${i * 0.8}s`,
            opacity: 0.08,
          } as React.CSSProperties}
        >
          {food.emoji}
        </span>
      ))}
    </div>
  );
}