"use client"

import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react"

// Reveal enhances an already-visible default. SSR / no-JS / reduced-motion all
// render content fully visible; the entrance only arms on the client when motion
// is allowed, and never for elements already in view (so above-the-fold doesn't
// flash). ponytail: CSS + one IntersectionObserver, no motion library.
export function Reveal({
  children,
  className,
  delay = 0,
  ...rest
}: ComponentPropsWithoutRef<"div"> & { delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const rect = el.getBoundingClientRect()
    const alreadyInView = rect.top < window.innerHeight && rect.bottom > 0
    if (alreadyInView) return

    setShown(false)
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            io.disconnect()
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out-quint ${
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      } ${className ?? ""}`}
      {...rest}
    >
      {children}
    </div>
  )
}
