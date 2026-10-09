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
