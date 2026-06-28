"use client"

// App Router top-level error boundary. Must render its own <html>/<body>.
// Also part of the build fix: it keeps Next from prerendering the Pages-Router
// 500 page (which crashes on a null React context).
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-center font-sans">
        <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-bold leading-tight text-ink">
          Something went wrong.
        </h1>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">
          An unexpected error occurred. Try again, and if it keeps happening,
          let us know.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 inline-flex min-h-[44px] items-center rounded-full bg-ink px-7 py-3 text-sm font-semibold text-paper transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </body>
    </html>
  )
}
