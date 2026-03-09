import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  ArrowRight,
  FileText,
  Users,
  PieChart,
  Lock,
  LayoutDashboard,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Prima Nota Digitale",
    desc: "Registra entrate e uscite in modo rapido e organizzato con categorie personalizzabili.",
  },
  {
    icon: Users,
    title: "Gestione Soci",
    desc: "Gestisci quote, ruoli e permessi di ogni socio della tua SRL in un unico pannello.",
  },
  {
    icon: PieChart,
    title: "Report Automatici",
    desc: "Genera report finanziari e analisi in tempo reale con grafici interattivi.",
  },
  {
    icon: Lock,
    title: "Sicurezza Totale",
    desc: "Autenticazione OTP, ruoli granulari e protezione dei dati sensibili.",
  },
];

const steps = [
  {
    num: "01",
    title: "Registrati",
    desc: "Crea il tuo account in pochi minuti con verifica email sicura.",
  },
  {
    num: "02",
    title: "Configura la Società",
    desc: "Inserisci i dati della tua SRL, aggiungi i soci e personalizza le categorie.",
  },
  {
    num: "03",
    title: "Gestisci Tutto",
    desc: "Registra operazioni, genera report e tieni la contabilità sempre aggiornata.",
  },
];

const marqueeWords = [
  "Prima Nota",
  "Contabilità",
  "Gestione Soci",
  "Report",
  "Bilancio",
  "Fatture",
  "SRL",
  "Categorie",
];

export default async function LandingPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden">
      {/* ── Ambient glows ── */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-32 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-red-600/[0.06] blur-[140px]" />
        <div className="absolute -bottom-40 -right-20 h-[500px] w-[500px] rounded-full bg-red-600/[0.04] blur-[120px]" />
      </div>

      {/* ── Navbar ── */}
      <nav className="relative z-50 border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-10">
            <Link href="/" className="text-xl font-bold tracking-tight">
              Prima<span className="text-red-500">Nota</span>
            </Link>
            <div className="hidden items-center gap-7 text-[0.84rem] text-zinc-400 md:flex">
              <a
                href="#funzionalita"
                className="transition-colors hover:text-white"
              >
                Funzionalità
              </a>
              <a
                href="#come-funziona"
                className="transition-colors hover:text-white"
              >
                Come funziona
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-white"
                >
                  Accedi
                </Link>
                <Link
                  href="/registrazione"
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
                >
                  Registrati
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-24 md:pb-24 md:pt-32">
        <div className="max-w-4xl">
          <h1 className="text-5xl font-bold leading-[0.95] tracking-tight md:text-7xl lg:text-[5.5rem]">
            La contabilità
            <br />
            della tua <span className="text-red-500">SRL</span>,
            <br />
            sotto controllo.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
            Gestisci prima nota, soci e report in un&apos;unica piattaforma
            semplice e sicura. Progettata per le piccole e medie imprese
            italiane.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/registrazione"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-8 py-3.5 text-base font-medium text-white transition-all hover:bg-red-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.25)]"
            >
              Inizia Gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-8 py-3.5 text-base font-medium text-white transition-all hover:border-white/20 hover:bg-white/[0.04]"
            >
              Accedi
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 grid max-w-2xl grid-cols-3 gap-8">
          <div>
            <div className="text-3xl font-bold text-red-500 md:text-4xl">
              100%
            </div>
            <div className="mt-1 text-sm text-zinc-500">Sicuro e protetto</div>
          </div>
          <div>
            <div className="text-3xl font-bold md:text-4xl">Multi</div>
            <div className="mt-1 text-sm text-zinc-500">Soci e utenti</div>
          </div>
          <div>
            <div className="text-3xl font-bold md:text-4xl">Real-time</div>
            <div className="mt-1 text-sm text-zinc-500">Report istantanei</div>
          </div>
        </div>
      </section>

      {/* ── Marquee ── */}
      <div className="relative z-10 overflow-hidden border-y border-white/[0.06] py-5">
        <div className="marquee-track flex whitespace-nowrap text-2xl font-bold uppercase tracking-[0.2em] text-white/[0.06] md:text-3xl">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {marqueeWords.map((word, j) => (
                <span key={j} className="flex items-center">
                  <span className="px-6">{word}</span>
                  <span className="text-red-500/20">&#x2022;</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section
        id="funzionalita"
        className="relative z-10 mx-auto max-w-7xl px-6 py-24 md:py-32"
      >
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Tutto ciò che ti serve
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
            Strumenti pensati per semplificare la gestione contabile della tua
            società.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div
              key={i}
              className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:border-red-500/20 hover:bg-white/[0.04]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 transition-colors group-hover:bg-red-500/20">
                <f.icon className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Come funziona ── */}
      <section
        id="come-funziona"
        className="relative z-10 mx-auto max-w-7xl px-6 py-24 md:py-32"
      >
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Come funziona
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
            Tre semplici passi per iniziare a gestire la contabilità della tua
            SRL.
          </p>
        </div>

        <div className="relative mx-auto grid max-w-4xl gap-12 md:grid-cols-3 md:gap-8">
          {/* Connecting line (desktop) */}
          <div className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-8 hidden h-px bg-gradient-to-r from-transparent via-red-500/25 to-transparent md:block" />

          {steps.map((s, i) => (
            <div key={i} className="relative text-center">
              <div className="relative z-10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500/25 bg-red-500/[0.08]">
                <span className="text-lg font-bold text-red-500">{s.num}</span>
              </div>
              <h3 className="mb-2 text-xl font-semibold">{s.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-red-500/[0.07] to-transparent p-12 text-center md:p-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.07),transparent_70%)]" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
              Pronto a semplificare
              <br />
              la tua contabilità?
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-lg text-zinc-400">
              Unisciti alle aziende che hanno scelto Prima Nota per gestire la
              contabilità in modo semplice e professionale.
            </p>
            <div className="mt-9">
              <Link
                href="/registrazione"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-8 py-3.5 text-base font-medium text-white transition-all hover:bg-red-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.25)]"
              >
                Registrati Ora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="text-xl font-bold tracking-tight">
              Prima<span className="text-red-500">Nota</span>
            </div>
            <div className="flex gap-6 text-sm text-zinc-500">
              <a
                href="#funzionalita"
                className="transition-colors hover:text-zinc-300"
              >
                Funzionalità
              </a>
              <a
                href="#come-funziona"
                className="transition-colors hover:text-zinc-300"
              >
                Come funziona
              </a>
              <Link
                href="/login"
                className="transition-colors hover:text-zinc-300"
              >
                Accedi
              </Link>
            </div>
            <div className="text-sm text-zinc-600">
              &copy; {new Date().getFullYear()} Prima Nota. Tutti i diritti
              riservati.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
