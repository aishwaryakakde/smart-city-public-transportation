export function BusArt({ className = '', id = 'bus' }) {
  return (
    <svg className={className} viewBox="0 0 520 320" role="img" aria-label="Smart city bus">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38a0ff" />
          <stop offset="1" stopColor="#0a58d0" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f9ff" />
          <stop offset="1" stopColor="#bcd8ff" />
        </linearGradient>
      </defs>

      <circle cx="430" cy="62" r="34" fill="#ffe9a8" opacity=".9" />

      <g fill="#ffffff" opacity=".22">
        <rect x="20" y="130" width="50" height="140" rx="4" />
        <rect x="78" y="90" width="44" height="180" rx="4" />
        <rect x="130" y="150" width="56" height="120" rx="4" />
        <rect x="330" y="110" width="52" height="160" rx="4" />
        <rect x="390" y="150" width="46" height="120" rx="4" />
        <rect x="444" y="100" width="60" height="170" rx="4" />
      </g>

      <rect x="0" y="266" width="520" height="40" rx="6" fill="#0b2a5e" />
      <line x1="10" y1="286" x2="510" y2="286" stroke="#ffffff" strokeOpacity=".7" strokeWidth="4" strokeDasharray="26 20" />

      <rect x="70" y="140" width="330" height="122" rx="26" fill={`url(#${id}-body)`} />
      <rect x="70" y="214" width="330" height="14" fill="#ffffff" opacity=".28" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={90 + i * 50} y="158" width="40" height="44" rx="9" fill={`url(#${id}-glass)`} />
      ))}
      <rect x="338" y="158" width="34" height="88" rx="7" fill={`url(#${id}-glass)`} />
      <text x="96" y="248" fontSize="15" fontWeight="700" fill="#ffffff" fontFamily="sans-serif">SmartTransport</text>
      <circle cx="392" cy="232" r="7" fill="#ffe9a8" />
      <circle cx="78" cy="232" r="5" fill="#ff7a7a" />

      <circle cx="140" cy="264" r="25" fill="#0a1f45" />
      <circle cx="140" cy="264" r="11" fill="#d6e6ff" />
      <circle cx="330" cy="264" r="25" fill="#0a1f45" />
      <circle cx="330" cy="264" r="11" fill="#d6e6ff" />
    </svg>
  );
}

export function SkylineStrip({ className = '' }) {
  const heights = [28, 42, 24, 50, 32, 40, 22, 46, 28, 38, 26, 48, 30, 40, 24, 44, 28, 36, 22, 46, 30, 42, 26, 38];
  return (
    <svg className={className} viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
      {heights.map((h, i) => (
        <rect key={i} x={i * 50} y={60 - h} width="44" height={h} rx="3" fill="#ffffff" />
      ))}
    </svg>
  );
}