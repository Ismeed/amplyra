import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';

const pillars = [
  {
    title: 'AI Marketing Department',
    description:
      'Generate marketing strategies, brand-consistent copy, approval-gated content calendars, and grounded performance analyses tailored to your SME.',
    status: 'Live in V1 MVP',
    icon: Sparkles,
  },
  {
    title: 'Creator & Influencer Marketplace',
    description:
      'Discover vetted creators by Nigerian city, state, niche, platform, audience size, and transparent promotional rates.',
    status: 'Live in V1 MVP',
    icon: Users,
  },
  {
    title: 'Campaign Verification Engine',
    description:
      'Track deliverables, public post URLs, 15-day retention periods, and five-day reporting milestones with clear metric provenance.',
    status: 'Live in V1 MVP',
    icon: BarChart3,
  },
  {
    title: 'Protected Campaign Payments',
    description:
      'Milestone-driven funding, 10% platform fee transparency, dispute resolution, and creator payout tracking integrated with regulated payment partners.',
    status: 'Live in V1 MVP',
    icon: ShieldCheck,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">
              AMPLYRA AI
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 lg:pt-24 lg:pb-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold tracking-wide uppercase">
              Nigeria-First • Built for SMEs & Creators
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1]">
              Your Marketing Team. Powered by AI. Amplified by Creators.
            </h1>
            <p className="mt-6 text-lg text-slate-300 leading-relaxed max-w-2xl">
              Amplyra AI unifies AI-powered marketing execution with a transparent
              creator collaboration marketplace—so growing businesses can launch
              campaigns, discover local promoters, and verify campaign deliverables
              in one operating system.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/register?role=BUSINESS"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
              >
                Launch as a Business
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register?role=CREATOR"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-semibold transition"
              >
                Join as a Creator
              </Link>
            </div>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                        {pillar.status}
                      </span>
                    </div>
                    <h2 className="mt-4 text-xl font-semibold text-white">
                      {pillar.title}
                    </h2>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-t border-slate-800 bg-slate-900/40 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid gap-10 lg:grid-cols-2">
            <div>
              <h3 className="text-2xl font-bold text-white">
                End-to-End V1 MVP Operating System
              </h3>
              <p className="mt-3 text-slate-400 text-sm leading-relaxed">
                Built on Amplyra&apos;s principle of trust before automation.
                Businesses, creators, and platform admins can run the complete
                campaign, verification, AI marketing, and payment protection
                cycle today:
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                {[
                  'Role-based dashboards for Businesses, Creators, and Admins',
                  'Creator discovery filtered by Nigerian state/city, category, platform, followers & NGN rate',
                  'Campaign funding ledger in kobo with 10% platform fee split & Paystack partner webhooks',
                  'Day 0 / 5 / 10 / 15 reporting schedule with OAuth analytics + labeled creator evidence',
                  'AI Strategist, Brand-Toned Content Studio, Approval-Gated Calendar & Grounded Analyst',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <h4 className="font-semibold text-white">
                Seeded Local Demo Accounts
              </h4>
              <p className="text-xs text-slate-400">
                After running database migrations and <code className="text-emerald-400">pnpm db:seed</code>,
                you can test every dashboard with password{' '}
                <code className="text-emerald-400">AmplyraDemo123!</code>:
              </p>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-emerald-400 font-semibold">Business:</span>{' '}
                  founder@katsinathreadz.ng (Katsina Threadz)
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-emerald-400 font-semibold">Creator:</span>{' '}
                  zainab@creators.amplyra.ai (Zainab Styles — Katsina)
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-emerald-400 font-semibold">Admin:</span>{' '}
                  admin@amplyra.ai (Platform Operations)
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
