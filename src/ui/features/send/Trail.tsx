import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export interface TrailHandle {
  fire: () => void;
}

interface Shot {
  id: number;
  d: string;
  len: number;
}

/**
 * The send confirmation and the app's one piece of ambient motion: a tracer
 * leaves the Send button, glances off the right edge and flies out the top.
 */
export const Trail = forwardRef<TrailHandle>(function Trail(_, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [shot, setShot] = useState<Shot | null>(null);

  useImperativeHandle(ref, () => ({
    fire() {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const el = box.current;
      if (!el) return;
      const { width: w, height: h } = el.getBoundingClientRect();
      const start: [number, number] = [w * 0.42, h - 32];
      const wall: [number, number] = [w - 4, h * 0.4];
      const end: [number, number] = [w * 0.16, -24];
      const d = `M${start} L${wall} L${end}`;
      const len = Math.hypot(wall[0] - start[0], wall[1] - start[1]) + Math.hypot(end[0] - wall[0], end[1] - wall[1]);
      setShot({ id: Date.now(), d, len });
      setTimeout(() => setShot(null), 720);
    },
  }));

  return (
    <div ref={box} aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[460px]">
      {shot && (
        <svg key={shot.id} className="absolute inset-0 h-full w-full overflow-visible">
          <path
            d={shot.d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`70 ${shot.len}`}
            strokeDashoffset={70}
          >
            <animate
              attributeName="stroke-dashoffset"
              from="70"
              to={-shot.len}
              dur="580ms"
              fill="freeze"
              calcMode="spline"
              keySplines="0.3 0 0.2 1"
              keyTimes="0;1"
            />
          </path>
          <circle r="5" fill="var(--accent)">
            <animateMotion dur="580ms" path={shot.d} fill="freeze" calcMode="spline" keySplines="0.3 0 0.2 1" keyTimes="0;1" />
            <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.8;1" dur="580ms" fill="freeze" />
          </circle>
        </svg>
      )}
    </div>
  );
});
