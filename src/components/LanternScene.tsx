/**
 * The welcome illustration: a lantern's light travels down a faint timeline,
 * and each memory sharpens as the light reaches it. This is the app's one
 * orchestrated animation; with reduced motion it shows the lit end state.
 */

const MEMORIES: { y: number; r: number; label: string; side: 'left' | 'right' }[] = [
  { y: 92, r: 7, label: 'Age 4', side: 'right' },
  { y: 150, r: 9, label: 'Summer ’95', side: 'left' },
  { y: 206, r: 6, label: 'Around 1997', side: 'right' },
  { y: 262, r: 10, label: 'June 14, 2001', side: 'left' },
  { y: 318, r: 7, label: 'High school', side: 'right' },
];

export function LanternScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 360"
      className={className}
      style={{ overflow: 'visible' }}
      role="img"
      aria-label="A lantern lighting up memories along a timeline"
    >
      <defs>
        <radialGradient id="ls-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#F5C26B" stopOpacity=".55" />
          <stop offset=".5" stopColor="#E9A23B" stopOpacity=".18" />
          <stop offset="1" stopColor="#E9A23B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The light, sweeping down the spine. */}
      <g className="ls-sweep">
        <circle cx="160" cy="60" r="150" fill="url(#ls-glow)" />
      </g>

      {/* Spine: faint dashes, with a solid line drawn in behind the light. */}
      <line x1="160" y1="70" x2="160" y2="350" stroke="var(--faint-ink)" strokeOpacity=".5" strokeWidth="2" strokeDasharray="3 7" />
      <line className="ls-spine" x1="160" y1="70" x2="160" y2="350" stroke="var(--tide)" strokeWidth="2.5" strokeLinecap="round" pathLength={1} />

      {MEMORIES.map((m, i) => {
        const x = m.side === 'right' ? 178 : 142;
        return (
          <g key={m.y} className="ls-memory" style={{ animationDelay: `${0.55 + i * 0.42}s` }}>
            <circle cx="160" cy={m.y} r={m.r + 5} fill="var(--mist)" />
            <circle className="ls-faint" cx="160" cy={m.y} r={m.r} fill="none" stroke="var(--faint-ink)" strokeWidth="1.5" strokeDasharray="2.5 3" />
            <circle className="ls-vivid" cx="160" cy={m.y} r={m.r} fill="var(--tide)" />
            <text
              className="ls-label"
              x={x}
              y={m.y + 4}
              textAnchor={m.side === 'right' ? 'start' : 'end'}
              fontSize="12.5"
              fontFamily="var(--font-sans)"
              fill="var(--graphite)"
            >
              {m.label}
            </text>
          </g>
        );
      })}

      {/* The lantern itself. */}
      <g transform="translate(136 6)">
        <circle cx="24" cy="6" r="5" fill="none" stroke="var(--ink)" strokeWidth="2.5" />
        <path d="M24 11 V17" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M15 17 h18 l3.5 6 h-25 z" fill="var(--ink)" />
        <rect x="10" y="23" width="28" height="30" rx="6" fill="var(--ink)" />
        <rect x="14" y="27" width="20" height="22" rx="4" fill="#F7D9A0" />
        <path className="ls-flame" d="M24 31 C28 36 29 40 27 43.5 C25.5 46 22.5 46 21 43.5 C19 40 20 36 24 31 Z" fill="#E9A23B" />
        <path d="M12 53 h24 l-2.5 6 h-19 z" fill="var(--ink)" />
      </g>
    </svg>
  );
}
