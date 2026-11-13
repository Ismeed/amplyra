'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNgnFromKobo } from '@amplyra/shared';
import { DashboardShell } from '@/components/dashboard-shell';
import { ADMIN_NAV } from '@/components/nav-configs';
import { apiFetch } from '@/lib/api';

interface AdminOverview {
  metrics: {
    businessesCount: number;
    creatorsCount: number;
    campaignsCount: number;
    postsCount: number;
  };
  recentAuditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    actor?: { fullName: string; email: string } | null;
  }>;
}

interface AdminBusiness {
  id: string;
  name: string;
  industry: string;
  verifiedAt: string | null;
  owner: { fullName: string; email: string };
}

interface AdminCreator {
  id: string;
  displayName: string;
  city?: string | null;
  verifiedAt: string | null;
  user: { fullName: string; email: string };
}

interface AdminDispute {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  campaign: { id: string; title: string; business: { name: string } };
  campaignFunding: { amountKobo: number };
}

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();

  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => apiFetch<AdminOverview>('/admin/overview'),
  });

  const { data: businesses = [] } = useQuery({
    queryKey: ['admin-businesses'],
    queryFn: () => apiFetch<AdminBusiness[]>('/admin/businesses'),
  });

  const { data: creators = [] } = useQuery({
    queryKey: ['admin-creators'],
    queryFn: () => apiFetch<AdminCreator[]>('/admin/creators'),
  });

  const { data: disputes = [] } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: () => apiFetch<AdminDispute[]>('/payments/disputes'),
  });

  async function verifyBusiness(id: string) {
    await apiFetch(`/admin/businesses/${id}/verify`, { method: 'POST' });
    queryClient.invalidateQueries({ queryKey: ['admin-businesses'] });
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
  }

  async function verifyCreator(id: string) {
    await apiFetch(`/admin/creators/${id}/verify`, { method: 'POST' });
    queryClient.invalidateQueries({ queryKey: ['admin-creators'] });
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
  }

  async function resolveDispute(
    disputeId: string,
    resolution: 'RESOLVED_RELEASE' | 'RESOLVED_REFUND' | 'DISMISSED',
  ) {
    await apiFetch(`/payments/disputes/${disputeId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({
        resolution,
        resolutionNotes: `Admin review decision: ${resolution}`,
      }),
    });
    queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
  }

  return (
    <DashboardShell
      title="Platform Operations"
      roleLabel="Admin Console"
      navItems={ADMIN_NAV}
    >
      <div className="space-y-6">
        {overview && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <p className="text-xs text-slate-500 uppercase">Businesses</p>
              <p className="mt-2 text-2xl font-bold">{overview.metrics.businessesCount}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <p className="text-xs text-slate-500 uppercase">Creators</p>
              <p className="mt-2 text-2xl font-bold">{overview.metrics.creatorsCount}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <p className="text-xs text-slate-500 uppercase">Campaigns</p>
              <p className="mt-2 text-2xl font-bold">{overview.metrics.campaignsCount}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <p className="text-xs text-slate-500 uppercase">Submitted Posts</p>
              <p className="mt-2 text-2xl font-bold">{overview.metrics.postsCount}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-bold text-slate-900">Disputes Queue ({disputes.length})</h2>
          {disputes.length === 0 ? (
            <p className="text-xs text-slate-500">No payment or verification disputes open.</p>
          ) : (
            <div className="space-y-3">
              {disputes.map((d) => (
                <div
                  key={d.id}
                  className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {d.campaign.title} ({d.campaign.business.name}) •{' '}
                      {formatNgnFromKobo(d.campaignFunding.amountKobo)}
                    </p>
                    <p className="text-slate-600 mt-1">{d.reason}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                      {d.status}
                    </span>
                  </div>
                  {d.status === 'OPEN' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => resolveDispute(d.id, 'RESOLVED_RELEASE')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                      >
                        Release to Creator
                      </button>
                      <button
                        onClick={() => resolveDispute(d.id, 'RESOLVED_REFUND')}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold cursor-pointer"
                      >
                        Refund Business
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-bold text-slate-900">Businesses</h2>
            {businesses.map((b) => (
              <div
                key={b.id}
                className="p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-900">{b.name}</p>
                  <p className="text-slate-500">
                    {b.industry} • {b.owner.email}
                  </p>
                </div>
                {b.verifiedAt ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                    Verified
                  </span>
                ) : (
                  <button
                    onClick={() => verifyBusiness(b.id)}
                    className="px-3 py-1 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer"
                  >
                    Verify
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-bold text-slate-900">Creators</h2>
            {creators.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-900">{c.displayName}</p>
                  <p className="text-slate-500">
                    {c.city || 'Nigeria'} • {c.user.email}
                  </p>
                </div>
                {c.verifiedAt ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                    Verified
                  </span>
                ) : (
                  <button
                    onClick={() => verifyCreator(c.id)}
                    className="px-3 py-1 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer"
                  >
                    Verify
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-bold text-slate-900">Recent Audit Logs</h2>
          <div className="space-y-2">
            {overview?.recentAuditLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs flex flex-wrap justify-between gap-2"
              >
                <span>
                  <strong>{log.action}</strong> on {log.entityType} ({log.entityId})
                </span>
                <span className="text-slate-500">
                  {log.actor?.email || 'system'} •{' '}
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
