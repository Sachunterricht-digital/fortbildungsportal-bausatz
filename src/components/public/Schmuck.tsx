/**
 * Handgezeichneter Schmuck
 * (eigene Linien-Grafiken), als Linie in currentColor.
 * Bewusst sparsam: Umriss statt Fläche, kein Gelb.
 */

/** Notizzettel mit Eselsohr (01 Rahmen/rahmen-notizzettel.svg) hinter dem Datum. */
export function Notizzettel({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 260"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      <path d="M4 4 L396 4 L396 214 L350 256 L4 256 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d="M396 214 L350 214 L350 256" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.55" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
