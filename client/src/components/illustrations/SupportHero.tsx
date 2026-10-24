/** Original flat illustration: a support specialist at a laptop with a chat bubble. */
export function SupportHero({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 170" className={className} aria-hidden>
      {/* soft backdrop */}
      <ellipse cx="150" cy="150" rx="105" ry="12" fill="#e3e7ff" />
      {/* plants */}
      <g fill="#7dd3c8">
        <path d="M40 150c-6-22-2-44 10-58 4 18 2 40-10 58z" />
        <path d="M44 150c4-18 16-32 32-38-4 16-16 30-32 38z" opacity=".8" />
        <path d="M38 150c-12-12-18-28-16-44 12 10 18 26 16 44z" opacity=".7" />
      </g>
      <g fill="#a5b4fc">
        <path d="M236 150c4-20 0-40-10-54-4 16-2 36 10 54z" />
        <path d="M232 150c-4-16-14-28-28-34 4 14 14 28 28 34z" opacity=".8" />
      </g>
      {/* chat bubble */}
      <g>
        <rect x="58" y="20" width="58" height="38" rx="9" fill="#fff" stroke="#c6d0fe" />
        <path d="M74 58l-6 10 14-10z" fill="#fff" stroke="#c6d0fe" strokeLinejoin="round" />
        <rect x="68" y="31" width="38" height="4" rx="2" fill="#c6d0fe" />
        <rect x="68" y="41" width="26" height="4" rx="2" fill="#e0e6ff" />
      </g>
      {/* person: hair back */}
      <path
        d="M150 34c-20 0-32 16-30 36 1 14-4 26-10 34 18 4 40 0 52-12 10-10 12-30 6-42-4-10-10-16-18-16z"
        fill="#1e2a4f"
      />
      {/* neck + face */}
      <rect x="146" y="70" width="12" height="14" rx="5" fill="#f4b9a0" />
      <ellipse cx="152" cy="56" rx="15" ry="18" fill="#f8c7b0" />
      {/* hair front */}
      <path
        d="M136 52c2-14 12-22 24-20 8 2 12 8 12 16-10-2-20-6-26-12-2 8-6 12-10 16z"
        fill="#1e2a4f"
      />
      {/* body */}
      <path d="M118 150c0-34 12-66 34-66s34 30 34 66z" fill="#8b7cf6" />
      <path d="M150 84h6l-3 10z" fill="#f4b9a0" />
      {/* arm */}
      <path d="M132 104c-10 14-12 30-6 40l30-4-4-8-16 2c2-10 2-20 0-28z" fill="#7c6cf0" />
      {/* laptop */}
      <path d="M150 112l58-2-12 40-58 2z" fill="#2a3560" />
      <path d="M138 152l58-2 2 6-62 2z" fill="#3b4677" />
      <circle cx="173" cy="131" r="3" fill="#8b9be8" />
    </svg>
  )
}
