"use client";

import { useMemo } from "react";

const DISH_SVGS = [
  {
    name: "plate",
    size: 40,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h18" />
        <path d="M5 12a4 4 0 0 0 0 8h14a4 4 0 0 0 0-8" />
        <path d="M12 12a3 3 0 0 1 0 6" />
      </svg>
    ),
  },
  {
    name: "coffee",
    size: 36,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a4 4 0 0 1 4-4Z" />
        <path d="M6 3v4" />
        <path d="M10 3v4" />
        <path d="M14 12v8" />
        <path d="M18 12v8" />
      </svg>
    ),
  },
  {
    name: "pizza",
    size: 38,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a18 18 0 0 0 0 18" />
        <path d="M8 8l4 4" />
        <path d="M12 8v4" />
        <path d="M16 8l-4 4" />
      </svg>
    ),
  },
  {
    name: "burger",
    size: 36,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h16" />
        <path d="M4 16h16" />
        <path d="M10 8c0-2 2-4 4-4s4 2 4 4" />
        <path d="M8 12v4" />
        <path d="M16 12v4" />
      </svg>
    ),
  },
  {
    name: "sushi",
    size: 38,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 16a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1.5" />
        <path d="M4 12h16" />
        <path d="M8 16v-4" />
        <path d="M12 16v-4" />
        <path d="M16 16v-4" />
      </svg>
    ),
  },
  {
    name: "salad",
    size: 36,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20a7 7 0 0 1-7-7h14a7 7 0 0 1-7 7Z" />
        <path d="M8 16h8" />
        <path d="M12 12v4" />
        <path d="M10 14h4" />
      </svg>
    ),
  },
  {
    name: "steak",
    size: 38,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 12a4 4 0 0 0 0 8h12a4 4 0 0 0 0-8Z" />
        <path d="M8 12v8" />
        <path d="M12 12v8" />
        <path d="M16 12v8" />
      </svg>
    ),
  },
  {
    name: "noodles",
    size: 36,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 16a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
        <path d="M6 12c0-4 4-4 8-4s8 4 8 4" />
        <path d="M6 14c0-4 4-4 8-4s8 4 8 4" />
      </svg>
    ),
  },
  {
    name: "dumpling",
    size: 34,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4a2 2 0 0 1 2 2c0 1.5-2.5 4-2.5 4s-2.5-2.5-2.5-4a2 2 0 0 1 2-2Z" />
        <path d="M8 16c0-3 4-4 8-4s8 1 8 4" />
        <path d="M12 12v4" />
      </svg>
    ),
  },
  {
    name: "icecream",
    size: 36,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16a6 6 0 0 1 0-12h4a6 6 0 0 1 0 12Z" />
        <path d="M10 16V8" />
        <path d="M14 16V8" />
        <path d="M18 16a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8h4" />
      </svg>
    ),
  },
  {
    name: "drink",
    size: 36,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3v18" />
        <path d="M18 3v18" />
        <path d="M6 3h12" />
        <path d="M6 21h12" />
        <path d="M9 3v4" />
        <path d="M15 3v4" />
      </svg>
    ),
  },
  {
    name: "cupcake",
    size: 34,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 16a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-4Z" />
        <path d="M12 12c0-3 2.5-4 4-4s4 1 4 4" />
        <path d="M10 16h4" />
      </svg>
    ),
  },
  {
    name: "smoothie",
    size: 36,
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3v18" />
        <path d="M19 3v18" />
        <path d="M5 3h14" />
        <path d="M5 21h14" />
        <path d="M9 3v4" />
        <path d="M15 3v4" />
        <path d="M12 10v6" />
      </svg>
    ),
  },
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
      const dish = DISH_SVGS[i % DISH_SVGS.length];
      const x = rand() * 95 + 2;
      const duration = rand() * 10 + 12;
      const delay = rand() * 14;
      const variant = rand() > 0.5 ? "animate-food-drift" : "animate-food-drift-alt";
      const opacity = rand() * 0.25 + 0.15;
      return { ...dish, x, duration, delay, variant, opacity, id: i };
    });
  }, [count]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Floating dish illustrations */}
      {items.map((item) => (
        <span
          key={item.id}
          className={`absolute select-none ${item.variant}`}
          style={{
            left: `${item.x}%`,
            bottom: "0%",
            width: `${item.size}px`,
            height: `${item.size}px`,
            "--food-duration": `${item.duration}s`,
            "--food-delay": `${item.delay}s`,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
            opacity: item.opacity,
          } as React.CSSProperties}
        >
          {item.svg}
        </span>
      ))}

      {/* Subtle pulsing dishes in the background */}
      {DISH_SVGS.slice(0, 6).map((dish, i) => (
        <span
          key={`pulse-${i}`}
          className="absolute select-none animate-food-pulse"
          style={{
            left: `${15 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
            width: `${dish.size * 1.5}px`,
            height: `${dish.size * 1.5}px`,
            "--food-delay": `${i * 0.8}s`,
            opacity: 0.06,
          } as React.CSSProperties}
        >
          {dish.svg}
        </span>
      ))}
    </div>
  );
}