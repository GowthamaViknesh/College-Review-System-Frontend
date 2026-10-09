// A waving figure for the dashboard banner, drawn in the same black-and-white line style as the rest of the page
export function WavingFigure({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 170" className={className} fill="none" stroke="#0c0c0d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* raised arm and open hand */}
      <path d="M62 170c-8-30-14-52-20-78" fill="#fff" />
      <path d="M78 170c-4-26-12-50-22-74" />
      <path d="M40 94c-6-10-9-22-8-34 3 6 6 10 9 13-2-10-2-20 1-30 3 9 5 17 8 24 0-9 1-18 5-26 2 9 3 18 4 26 2-7 5-13 9-18 1 10 0 20-3 30l-9 19z" fill="#fff" />
      {/* body */}
      <path d="M70 170c2-34 18-52 46-52s46 18 50 52z" fill="#0c0c0d" />
      {/* neck */}
      <path d="M104 104v18c0 8 24 8 24 0v-18" fill="#fff" />
      {/* head */}
      <path d="M86 66c0-22 13-36 31-36s31 14 31 36c0 24-14 44-31 44s-31-20-31-44z" fill="#fff" />
      {/* hair */}
      <path d="M84 62c-4-24 8-42 30-44 8-8 30-4 34 10 8 4 10 18 4 32-4-10-10-16-18-18-14 6-30 6-42 2-4 4-6 10-8 18z" fill="#0c0c0d" />
      {/* glasses */}
      <circle cx="104" cy="72" r="10" fill="#fff" />
      <circle cx="132" cy="72" r="10" fill="#fff" />
      <path d="M114 72h8M94 70l-8-4M142 70l8-4" />
      <circle cx="105" cy="73" r="2" fill="#0c0c0d" />
      <circle cx="131" cy="73" r="2" fill="#0c0c0d" />
      {/* smile */}
      <path d="M108 92c6 6 14 6 20 0" />
    </svg>
  )
}

// An open book with a star above it, for the call-to-action card
export function BookFigure({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className} fill="none" stroke="#0c0c0d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M60 46c-12-8-26-10-42-8v46c16-2 30 0 42 8 12-8 26-10 42-8V38c-16-2-30 0-42 8z" fill="#fff" />
      <path d="M60 46v46M28 52c8-1 16 0 24 3M28 64c8-1 16 0 24 3M92 52c-8-1-16 0-24 3M92 64c-8-1-16 0-24 3" />
      <path d="M60 6l5 10 11 1.6-8 7.8 1.9 11L60 31.200l-9.900 5.200 1.900-11-8-7.800 11-1.600z" fill="#f5a524" stroke="#0c0c0d" />
      <path d="M32 18l-6-6M88 18l6-6M22 30h-8M98 30h8" />
    </svg>
  )
}
