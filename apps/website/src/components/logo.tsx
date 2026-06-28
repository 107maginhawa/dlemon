// Real Dentalemon lemon mark (transparent PNG, works on any background) + wordmark.
import Image from "next/image"

export function LemonMark({ className }: { className?: string }) {
  return (
    <Image
      src="/images/dentalemon-logo.png"
      alt=""
      aria-hidden
      width={32}
      height={32}
      className={className}
    />
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LemonMark className="h-7 w-7" />
      <span className="font-display text-xl font-semibold tracking-tight text-ink">Dentalemon</span>
    </span>
  )
}
