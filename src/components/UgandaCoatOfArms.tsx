/** Official seal line for plain-text document exports */
export const UGANDA_COAT_OF_ARMS_TEXT = 'Republic of Uganda — Coat of Arms';

const UgandaCoatOfArms = ({ width = 120, height = 80, className = '', size }: { width?: number; height?: number; className?: string; size?: number }) => {
  const svgWidth = size ?? width;
  const svgHeight = size ? Math.round(size * (80 / 120)) : height;

  return (
    <svg
      viewBox="0 0 300 200"
      width={svgWidth}
      height={svgHeight}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Uganda Flag"
    >
      {/* Uganda flag - 6 equal horizontal stripes */}
      {/* Stripe 1 - Black */}
      <rect x="0" y="0" width="300" height="33" fill="#1a1a1a" />
      {/* Stripe 2 - Yellow */}
      <rect x="0" y="33" width="300" height="34" fill="#FCDD09" />
      {/* Stripe 3 - Red */}
      <rect x="0" y="67" width="300" height="33" fill="#C8102E" />
      {/* Stripe 4 - Black */}
      <rect x="0" y="100" width="300" height="33" fill="#1a1a1a" />
      {/* Stripe 5 - Yellow */}
      <rect x="0" y="133" width="300" height="34" fill="#FCDD09" />
      {/* Stripe 6 - Red */}
      <rect x="0" y="167" width="300" height="33" fill="#C8102E" />

      {/* White circle in center */}
      <circle cx="150" cy="100" r="45" fill="white" />

      {/* Grey Crowned Crane - simplified inside circle */}
      {/* Body */}
      <ellipse cx="150" cy="112" rx="14" ry="18" fill="#808080" />
      {/* Wing highlight */}
      <ellipse cx="150" cy="112" rx="10" ry="14" fill="#A9A9A9" />
      {/* Red chest */}
      <ellipse cx="150" cy="118" rx="7" ry="6" fill="#C8102E" />
      {/* Neck */}
      <rect x="146" y="85" width="8" height="20" rx="4" fill="#C0C0C0" />
      {/* Head */}
      <circle cx="150" cy="82" r="9" fill="#C0C0C0" />
      {/* Red face patch */}
      <ellipse cx="146" cy="83" rx="5" ry="4" fill="#C8102E" />
      {/* Eye */}
      <circle cx="144" cy="81" r="2.5" fill="#C8102E" />
      <circle cx="144" cy="81" r="1.2" fill="#1a1a1a" />
      {/* Beak */}
      <polygon points="140,82 134,84 140,86" fill="#1a1a1a" />
      {/* Golden crown */}
      <line x1="144" y1="72" x2="141" y2="60" stroke="#FCDD09" strokeWidth="2.5" />
      <line x1="147" y1="71" x2="145" y2="58" stroke="#FCDD09" strokeWidth="2.5" />
      <line x1="150" y1="71" x2="150" y2="57" stroke="#FCDD09" strokeWidth="2.5" />
      <line x1="153" y1="71" x2="155" y2="58" stroke="#FCDD09" strokeWidth="2.5" />
      <line x1="156" y1="72" x2="159" y2="60" stroke="#FCDD09" strokeWidth="2.5" />
      {/* Crown gold tips */}
      <circle cx="141" cy="59" r="2.5" fill="#FCDD09" />
      <circle cx="145" cy="57" r="2.5" fill="#FCDD09" />
      <circle cx="150" cy="56" r="2.5" fill="#FCDD09" />
      <circle cx="155" cy="57" r="2.5" fill="#FCDD09" />
      <circle cx="159" cy="59" r="2.5" fill="#FCDD09" />
      {/* Legs */}
      <rect x="144" y="128" width="4" height="16" rx="2" fill="#808080" />
      <rect x="152" y="128" width="4" height="16" rx="2" fill="#808080" />
      {/* Feet */}
      <line x1="140" y1="144" x2="152" y2="144" stroke="#808080" strokeWidth="2" />
      <line x1="148" y1="144" x2="160" y2="144" stroke="#808080" strokeWidth="2" />
    </svg>
  );
};

export default UgandaCoatOfArms;
export { UgandaCoatOfArms };
