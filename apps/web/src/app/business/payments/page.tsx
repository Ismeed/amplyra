'use client';

import { useQuery } from '@tanstack/react-query';
import { formatNgnFromKobo } from '@amplyra/shared';
import { DashboardShell } from '@/components/dashboard-shell';
import { BUSINESS_NAV } from '@/components/nav-configs';
import { apiFetch } from '@/lib/api';

interface LedgerEntry {
  id: string;
  amountKobo: number;
  platformFeeKobo: number;
  creatorNetKobo: number;
  provider: string;
  providerReference: string;
  status: string;
  fundedAt: string | null;
  releasedAt: string | null;
  campaign: { id: string; title: string; status: string };
}

export default function BusinessPaymentsPage() {
  const { data: ledger = [], isLoading } = useQuery({
    queryKey: ['business-ledger'],
    queryFn: () => apiFetch<LedgerEntry[]>('/payments/business/ledger'),
  });

  return (
    <DashboardShell
      title="Payments & Billing"
      roleLabel="Business Workspace"
      navItems={BUSINESS_NAV}
    >
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-sm text-slate-600">
          Campaign funds are recorded in integer kobo via integrated payment-partner holding workflows and released only after deliverable verification and retention checks (or authorized business approval).
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading payment ledger...</p>
        ) : ledger.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            No funded campaigns yet. Fund a campaign from the Campaigns tab.
          </div>
        ) : (
          <div className="space-y-3">
            {ledger.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <h3 className="font-bold text-slate-900">{item.campaign.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ref: {item.providerReference} • Provider: {item.provider}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Total: {formatNgnFromKobo(item.amountKobo)} • Platform Fee (10%):{' '}
                    {formatNgnFromKobo(item.platformFeeKobo)} • Creator Net:{' '}
                    {formatNgnFromKobo(item.creatorNetKobo)}
                  </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
