import { useMemo } from 'react';

const COLORS = ['#6366f1', '#a855f7', '#ec4899'];

export default function Particles({ count = 24 }) {
  const dots = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      w: 1 + Math.random() * 2.5,
      color: COLORS[i % 3],
      left: `${Math.random() * 100}vw`,
      opacity: Math.random() * 0.3 + 0.08,
      duration: `${2.5 + Math.random() * 4}s`,
      delay: `${Math.random() * 6}s`,
    })),
    [count]
  );

  return (
    <>
      {dots.map(d => (
        <div
          key={d.id}
          className="fixed rounded-full pointer-events-none z-0"
          style={{
            width: d.w,
            height: d.w,
            background: d.color,
            left: d.left,
            top: -10,
            opacity: d.opacity,
            animation: `fall ${d.duration} linear infinite`,
            animationDelay: d.delay,
          }}
        />
      ))}
    </>
  );
}
