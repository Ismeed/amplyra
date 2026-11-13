'use client';

import { useQuery } from '@tanstack/react-query';
import { formatNgnFromKobo } from '@amplyra/shared';
import { DashboardShell } from '@/components/dashboard-shell';
import { CREATOR_NAV } from '@/components/nav-configs';
import { apiFetch } from '@/lib/api';

interface CreatorEarningsResponse {
  summary: {
    heldKobo: number;
    releasedKobo: number;
    disputedKobo: number;
  };
  items: Array<{
    assignmentId: string;
    campaignId: string;
    campaignTitle: string;
    campaignStatus: string;
    businessName: string;
    grossRateKobo: number;
    platformFeeKobo: number;
    netEarningsKobo: number;
    fundingStatus: string | null;
    releasedAt: string | null;
  }>;
}

export default function CreatorEarningsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['creator-earnings'],
    queryFn: () => apiFetch<CreatorEarningsResponse>('/creators/me/earnings'),
  });

  return (
    <DashboardShell
      title="Creator Earnings"
      roleLabel="Creator Workspace"
      navItems={CREATOR_NAV}
    >
      <div className="space-y-6">
        {isLoading || !data ? (
          <p className="text-sm text-slate-500">Loading earnings...</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500 uppercase">Held by Partner</p>
                <p className="mt-2 text-2xl font-bold text-amber-700">
                  {formatNgnFromKobo(data.summary.heldKobo)}
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500 uppercase">Released Earnings</p>
                <p className="mt-2 text-2xl font-bold text-emerald-700">
                  {formatNgnFromKobo(data.summary.releasedKobo)}
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500 uppercase">Under Dispute</p>
                <p className="mt-2 text-2xl font-bold text-rose-700">
                  {formatNgnFromKobo(data.summary.disputedKobo)}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-slate-900">Campaign Earnings Breakdown</h2>
              {data.items.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No campaign assignments yet. Apply to open campaigns to start earning.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.items.map((item) => (
                    <div
                      key={item.assignmentId}
                      className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="text-emerald-700 font-semibold">{item.businessName}</p>
                        <p className="font-bold text-sm text-slate-900">{item.campaignTitle}</p>
                        <p className="text-slate-500 mt-0.5">
                          Gross: {formatNgnFromKobo(item.grossRateKobo)} • Platform Fee (10%):{' '}
                          {formatNgnFromKobo(item.platformFeeKobo)} • Net:{' '}
                          <strong>{formatNgnFromKobo(item.netEarningsKobo)}</strong>
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 font-semibold">
                        {item.fundingStatus || 'AWAITING_FUNDING'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
