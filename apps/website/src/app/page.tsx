import Image from "next/image"
import {
  ArrowRight,
  Sun,
  IdentificationCard,
  Receipt,
  CalendarDots,
  HardDrives,
  WifiSlash,
  DownloadSimple,
  Infinity as InfinityIcon,
  Check,
  X,
  CloudCheck,
} from "@phosphor-icons/react/dist/ssr"
import { Logo, LemonMark } from "@/components/logo"
import { Reveal } from "@/components/reveal"
import { SunDemo } from "@/components/sun-demo"
import { CutCord } from "@/components/cut-cord"

const pillars = [
  {
    icon: Sun,
    name: "SUN",
    tag: "The unified timeline",
    body: "Every visit, chart, and treatment a patient has ever had, browsed as one continuous story. Scrub through their history like a film reel. Compare any two charts side by side.",
  },
  {
    icon: IdentificationCard,
    name: "Records",
    tag: "Charts, plans, and notes",
    body: "The full odontogram, per tooth, per visit, always current. Treatment plans and clinical notes that stay attached to the patient, not locked in a vendor's cloud.",
  },
  {
    icon: Receipt,
    name: "Billing",
    tag: "Invoices and receivables",
    body: "Built for the long arc of braces and staged treatment, not just one-off receipts. Payment plans, running balances, and statements your front desk can actually read.",
  },
  {
    icon: CalendarDots,
    name: "Scheduling",
    tag: "The day at a glance",
    body: "Multi-chair, multi-provider, drag to rebook. The whole clinic's day on one screen, fast enough to run from the front desk at 9am.",
  },
]

const proofs = [
  {
    icon: HardDrives,
    title: "On your machine",
    body: "Your patient data lives on your own computer, not on a server you rent access to month after month.",
  },
  {
    icon: WifiSlash,
    title: "Works offline",
    body: "No internet, no problem. The clinic keeps running through outages, brownouts, and bad provincial signal.",
  },
  {
    icon: DownloadSimple,
    title: "Yours to export",
    body: "Open formats. Your data walks out the door with you. No ransom, no migration fee, no permission needed.",
  },
  {
    icon: InfinityIcon,
    title: "Outlives the company",
    body: "If Dentalemon disappeared tomorrow, your copy keeps working exactly as it does today. That is the whole point.",
  },
]

const renting = [
  "A bill that arrives every month, forever",
  "A price they can raise whenever they like",
  "Records that live on someone else's server",
  "Access that ends the day you stop paying",
  "Software that vanishes if the company is sold",
]

const owning = [
  "One price, paid one time",
  "A number that never changes again",
  "Records that live on your own machine",
  "Software that works whether we exist or not",
  "A tool that is yours to keep, for good",
]

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
            <a href="#product" className="transition-colors hover:text-ink">The product</a>
            <a href="#own" className="transition-colors hover:text-ink">Ownership</a>
            <a href="#pricing" className="transition-colors hover:text-ink">Pricing</a>
            <a href="#manifesto" className="transition-colors hover:text-ink">Manifesto</a>
          </nav>
          <a
            href="#request"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-transform duration-200 ease-out-quint hover:-translate-y-0.5"
          >
            Request access
          </a>
        </div>
      </header>

      <main>
        {/* ---- Hero ---- */}
        {/* Two-column on a white field: copy left, the white-background
            illustration right (it bleeds to the viewport edge on lg+ and blends
            seamlessly into the page, so no scrim or crop is needed). Stacks on
            narrow widths. No overlap by construction — the art sits beside the
            copy, never behind it. */}
        <section className="overflow-hidden bg-white">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 sm:py-16 lg:grid-cols-2 lg:gap-10 lg:py-20">
            <Reveal className="order-1 max-w-xl">
              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-lemon/50 bg-lemon/15 px-3.5 py-1.5 text-sm font-semibold text-ink">
                <LemonMark className="h-4 w-4" />
                Buy once. Own forever.
              </span>
              <h1 className="text-[clamp(2.5rem,5.2vw,4rem)] font-bold leading-[1.04] text-ink">
                You built the clinic. Own the software that runs it.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/75">
                Dentalemon is local-first, buy-once practice software. Records,
                billing, scheduling, and one unified patient timeline. No
                subscription. No lock-in. It keeps working even if we disappear.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#request"
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 font-semibold text-paper transition-transform duration-200 ease-out-quint hover:-translate-y-0.5"
                >
                  Request Founding Access
                  <ArrowRight weight="bold" size={16} />
                </a>
                <a
                  href="#product"
                  className="inline-flex items-center rounded-full border border-line px-6 py-3.5 font-semibold text-ink transition-colors hover:border-ink"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-6 text-sm text-muted">
                One dentist, unlimited staff. A founding cohort for independent practices.
              </p>
            </Reveal>

            {/* Right side: illustration painted as a background on the column so
                it fills the panel rather than sitting as an inline image. White
                art blends into the white section, so no scrim/crop needed. */}
            <Reveal
              delay={120}
              role="img"
              aria-label="An owner-dentist in her bright clinic reviewing a patient's unified timeline on Dentalemon, running on her iPad."
              className="order-2 mx-auto aspect-[764/693] w-full max-w-md bg-[url('/images/hero-dentist.png')] bg-contain bg-center bg-no-repeat lg:max-w-none"
            />

            {/* Previous layout (inline image) — kept for easy revert:
            <Reveal delay={120} className="order-2">
              <Image
                src="/images/hero-2.png"
                alt="An owner-dentist in her bright clinic reviewing a patient's unified timeline on Dentalemon, running on her iPad."
                width={867}
                height={773}
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="mx-auto h-auto w-full max-w-md lg:max-w-none"
              />
            </Reveal>
            */}
          </div>
        </section>

        {/* ---- Problem beat (provoke) ---- */}
        <section className="border-y border-line bg-paper">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:py-28 lg:grid-cols-2 lg:gap-14">
            <div className="order-1 lg:order-2">
              <Reveal>
                <h2 className="max-w-2xl text-[clamp(1.9rem,4vw,3rem)] font-bold leading-tight text-ink">
                  You own every chair in your clinic. You don&rsquo;t own a single tool that runs it.
                </h2>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                  The chairs are yours. The instruments are yours. The lease, the
                  lights, the people. But the software holding every patient
                  record, every schedule, every peso owed? You rent it. Every
                  month. And the day you stop paying, it all locks behind a wall
                  you do not control.
                </p>
              </Reveal>
              <Reveal delay={120}>
                <ul className="mt-10 max-w-md divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
                  {["Patient records", "The schedule", "Billing and balances", "Every chart you've ever drawn"].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-3.5 px-4 py-3.5">
                        <span className="inline-flex w-[4.75rem] flex-shrink-0 justify-center rounded-md bg-[#B23A2E] px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">
                          Rented
                        </span>
                        <span className="text-[0.975rem] font-medium text-ink">{item}</span>
                      </li>
                    ),
                  )}
                </ul>
              </Reveal>
            </div>
            <Reveal delay={120} className="order-2 lg:order-1">
              <Image
                src="/images/rent.png"
                alt="A dental operatory where the chair and instruments are tagged 'Owned', but the laptop runs a monthly software subscription marked 'Rent' — printing an endless receipt of monthly charges."
                width={1448}
                height={1086}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="mx-auto h-auto w-full max-w-lg lg:max-w-none"
              />
            </Reveal>
          </div>
        </section>

        {/* ---- The villain: anti-subscription lemon-wash band (soft wash, neutral panels) ---- */}
        <section id="manifesto" className="overflow-hidden border-y border-lemon/25 bg-lemon-wash text-ink">
          {/* Full-bleed "cut the cord" topper — the Unsubscribe gesture, literal.
              Hidden on phones, where it scales too small to read. */}
          <div className="hidden pt-12 sm:pt-16 md:block">
            <CutCord />
          </div>
          <div className="mx-auto max-w-6xl px-5 pb-24 pt-14 sm:pb-32 md:pt-8">
            <Reveal>
              <p className="flex items-center gap-2 text-base font-semibold text-ink/65">
                <LemonMark className="h-4 w-4" />
                Buy once. Own forever.
              </p>
              <h2 className="mt-4 max-w-4xl text-[clamp(2.5rem,7vw,5rem)] font-bold leading-[0.98] text-ink">
                Unsubscribe from dental software.
              </h2>
              <p className="mt-7 max-w-2xl text-lg leading-relaxed text-ink/75">
                For thirty years the only way to run a clinic was to rent the
                software that ran it. Pay forever, own nothing, and hope the
                vendor stays in business. We think that is backwards.
              </p>
            </Reveal>

            {/* Not two matching cards: the argument lives in the asymmetry.
                Renting recedes (flat, tinted, crossed out); owning is the
                chosen, elevated surface. */}
            <Reveal delay={140}>
              <div className="mt-16 grid items-start gap-5 md:grid-cols-2 md:gap-6">
                {/* Renting — the rejected option, visually diminished */}
                <div className="rounded-3xl border border-ink/10 bg-ink/[0.035] p-8 sm:p-9 md:mt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    What renting buys you
                  </h3>
                  <ul className="mt-6 space-y-3.5">
                    {renting.map((line) => (
                      <li key={line} className="flex items-start gap-3 text-ink/75">
                        <X
                          weight="bold"
                          size={16}
                          className="mt-0.5 flex-shrink-0 text-[#B23A2E]/70"
                          aria-hidden
                        />
                        <span className="text-[0.975rem] leading-snug">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Owning — the chosen option, elevated and lemon-blessed */}
                <div className="relative rounded-3xl bg-white p-8 shadow-[0_24px_60px_-24px_rgba(244,196,48,0.55)] ring-1 ring-lemon/60 sm:p-9">
                  <h3 className="flex items-center gap-2 text-xl font-bold text-ink">
                    <LemonMark className="h-5 w-5" />
                    What owning buys you
                  </h3>
                  <ul className="mt-6 space-y-3.5">
                    {owning.map((line) => (
                      <li key={line} className="flex items-start gap-3 text-ink">
                        <span className="mt-0.5 flex-shrink-0 text-sage">
                          <Check weight="bold" size={18} />
                        </span>
                        <span className="text-[1.0625rem] font-medium leading-snug">{line}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-7 border-t border-line pt-5 text-sm font-semibold text-ink/70">
                    Buy once. Own forever.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---- SUN product section (prove) ---- */}
        <section id="product" className="overflow-hidden bg-paper">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:py-32">
            <Reveal className="max-w-2xl">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#C99A12]">
                <Sun weight="fill" size={18} />
                SUN
              </span>
              <h2 className="mt-4 text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-tight text-ink">
                One patient. One story. Every visit.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-muted">
                SUN is the unified timeline at the heart of Dentalemon. A
                patient&rsquo;s entire history, visit by visit, in one place you
                can scroll through like a reel. No more digging through folders
                to remember what you did last March.
              </p>
            </Reveal>

            <Reveal delay={120}>
              <div className="mt-16">
                <SunDemo />
              </div>
            </Reveal>
            <Reveal delay={60}>
              <p className="mt-6 text-center text-sm text-muted">
                The SUN timeline: a patient&rsquo;s charts, one focused visit centred, the full history a swipe away.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---- Four pillars (rows, not a card grid) ---- */}
        <section className="border-t border-line bg-paper">
          <div className="mx-auto max-w-5xl px-5 py-24 sm:py-28">
            <Reveal className="max-w-3xl">
              <h2 className="text-[clamp(1.9rem,4vw,2.75rem)] font-bold leading-tight text-ink">
                Everything the front desk and the chair need. Nothing you have to rent.
              </h2>
            </Reveal>

            <div className="mt-14 divide-y divide-line border-y border-line">
              {pillars.map((p, i) => {
                const Icon = p.icon
                return (
                  <Reveal key={p.name} delay={i * 80}>
                    <article className="grid grid-cols-1 gap-4 py-9 sm:grid-cols-[auto_1fr] sm:gap-8">
                      <div className="flex items-start gap-4 sm:w-56">
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-lemon/15 text-ink ring-1 ring-lemon/30">
                          <Icon weight="duotone" size={22} />
                        </span>
                        <div className="pt-0.5">
                          <h3 className="text-xl font-semibold text-ink">{p.name}</h3>
                          <p className="text-sm text-muted">{p.tag}</p>
                        </div>
                      </div>
                      <p className="max-w-2xl text-[1.0625rem] leading-relaxed text-muted sm:pt-1.5">
                        {p.body}
                      </p>
                    </article>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        {/* ---- Ownership proof (local-first) ---- */}
        <section id="own" className="bg-paper">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:py-32 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <Reveal>
              <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-tight text-ink">
                Local-first means it is actually yours.
              </h2>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
                &ldquo;Own your data&rdquo; is a line every SaaS uses. Local-first
                is the only thing that makes it true. Your practice runs on your
                machine, by default, on purpose.
              </p>
              <a
                href="#pricing"
                className="mt-8 inline-flex items-center gap-2 text-base font-semibold text-ink underline-offset-4 hover:underline"
              >
                See what it costs
                <ArrowRight weight="bold" size={16} />
              </a>
            </Reveal>

            <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
              {proofs.map((p, i) => {
                const Icon = p.icon
                return (
                  <Reveal key={p.title} delay={i * 90} className="h-full">
                    <div className="flex h-full flex-col gap-3 bg-white p-7">
                      <span className="text-sage">
                        <Icon weight="duotone" size={26} />
                      </span>
                      <h3 className="text-lg font-semibold text-ink">{p.title}</h3>
                      <p className="text-[0.95rem] leading-relaxed text-muted">{p.body}</p>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        {/* ---- Pricing teaser (one-time, not per-month) ---- */}
        <section id="pricing" className="border-y border-line bg-paper">
          <div className="mx-auto max-w-4xl px-5 py-24 text-center sm:py-32">
            <Reveal>
              <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-tight text-ink">
                One price. Paid once. Yours.
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
                No monthly bill. No per-seat fees. No renewal you have to
                remember to cancel. You buy Dentalemon the way you bought your
                chairs: once, and then it is yours.
              </p>
            </Reveal>

            <Reveal delay={120}>
              <div className="mx-auto mt-12 max-w-2xl rounded-3xl border border-line bg-white p-8 sm:p-12">
                <dl className="grid gap-8 sm:grid-cols-3">
                  <div>
                    <dt className="text-sm font-medium text-muted">What you pay</dt>
                    <dd className="mt-1 text-2xl font-bold text-ink">Once</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted">Renewal cost</dt>
                    <dd className="mt-1 text-2xl font-bold text-ink">Nothing</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted">What&rsquo;s inside</dt>
                    <dd className="mt-1 text-2xl font-bold text-ink">All of it</dd>
                  </div>
                </dl>
                <p className="mt-8 border-t border-line pt-6 text-[0.95rem] text-muted">
                  SUN, Records, Billing, and Scheduling. One dentist, unlimited
                  staff. Founding access is opening to a first cohort of
                  independent practices.
                </p>
                <a
                  href="#request"
                  className="mt-7 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 font-semibold text-paper transition-transform duration-200 ease-out-quint hover:-translate-y-0.5"
                >
                  Request Founding Access
                  <ArrowRight weight="bold" size={16} />
                </a>
              </div>
            </Reveal>

            {/* Optional cloud add-on, the iCloud model: the app is fully yours
                offline; cloud is a separate, optional convenience. */}
            <Reveal delay={60}>
              <div className="mx-auto mt-6 flex max-w-2xl flex-col items-start gap-3 rounded-2xl border border-line px-6 py-5 text-left sm:flex-row sm:items-center sm:gap-5">
                <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-sage/15 px-3 py-1 text-xs font-semibold text-[#566B3C]">
                  <CloudCheck weight="fill" size={14} />
                  Optional
                </span>
                <p className="text-[0.95rem] leading-relaxed text-muted">
                  <span className="font-semibold text-ink">Dentalemon Cloud</span> adds
                  encrypted backup and sync across your iPad and Mac, the way
                  iCloud works. Always optional. The app is fully yours and runs
                  without it.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---- Manifesto CTA (affirm) ---- */}
        <section id="request" className="bg-ink text-paper">
          <div className="mx-auto max-w-4xl px-5 py-28 text-center sm:py-36">
            <Reveal>
              <p className="text-base font-medium text-lemon">Own your practice.</p>
              <h2 className="mt-5 text-[clamp(3rem,9vw,6rem)] font-bold leading-[0.95] text-paper">
                Unsubscribe.
              </h2>
              <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-paper/70">
                Stop renting your practice. Own the software that runs it, the
                same way you own everything else under your roof.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href="mailto:founders@dentalemon.com?subject=Founding%20Access"
                  className="inline-flex items-center gap-2 rounded-full bg-lemon px-7 py-3.5 font-semibold text-ink transition-transform duration-200 ease-out-quint hover:-translate-y-0.5"
                >
                  Request Founding Access
                  <ArrowRight weight="bold" size={16} />
                </a>
                <span className="text-sm text-paper/55">Buy once. Own forever.</span>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="bg-ink text-paper/70">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 border-t border-white/10 px-5 py-12 text-sm sm:flex-row sm:items-center">
          <div className="flex flex-col gap-3">
            <Logo className="[&_span]:text-paper" />
            <p className="text-paper/55">Local-first, buy-once dental software for independent practices.</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <nav className="flex flex-wrap gap-x-6 gap-y-2">
              <a href="#product" className="transition-colors hover:text-paper">The product</a>
              <a href="#own" className="transition-colors hover:text-paper">Ownership</a>
              <a href="#pricing" className="transition-colors hover:text-paper">Pricing</a>
              <a href="#manifesto" className="transition-colors hover:text-paper">Manifesto</a>
            </nav>
            <p className="text-paper/45">&copy; {new Date().getFullYear()} Dentalemon. Buy once. Own forever.</p>
          </div>
        </div>
      </footer>
    </>
  )
}
