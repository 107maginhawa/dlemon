import Link from "next/link"

// App Router 404. Its presence also stops Next falling back to the Pages-Router
// `_error` page (which crashes the production prerender with a null React
// context), so this is both the brand 404 and the build fix.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-center">
      <p className="text-sm font-semibold text-lemon-deep">404</p>
      <h1 className="mt-3 text-[clamp(2rem,5vw,3.25rem)] font-bold leading-tight text-ink">
        This page moved on.
      </h1>
      <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">
        The link is broken or the page no longer exists. Your practice, though,
        is yours forever.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-[44px] items-center rounded-full bg-ink px-7 py-3 text-sm font-semibold text-paper transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
      >
        Back home
      </Link>
    </main>
  )
}
