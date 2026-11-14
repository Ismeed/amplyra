'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNgnFromKobo } from '@amplyra/shared';
import { Clock, Lock, Wallet } from 'lucide-react';
import { useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { CREATOR_NAV } from '@/components/nav-configs';
import { apiFetch } from '@/lib/api';

interface CreatorEarningsResponse {
  summary: {
    heldKobo: number;
    releasedKobo: number;
    disputedKobo: number;
    withdrawableKobo?: number;
    lockedKobo?: number;
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
    hasSubmittedPost?: boolean;
    postSubmittedAt?: string | null;
    unlockAt?: string | null;
    daysRemaining?: number | null;
    canWithdraw?: boolean;
    withdrawBlockedReason?: string | null;
  }>;
}

export default function CreatorEarningsPage() {
  const queryClient = useQueryClient();
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['creator-earnings'],
    queryFn: () => apiFetch<CreatorEarningsResponse>('/creators/me/earnings'),
  });

  async function handleWithdraw(campaignId: string, title: string) {
    setWithdrawingId(campaignId);
    setFeedback(null);
    try {
      await apiFetch(`/payments/${campaignId}/withdraw`, { method: 'POST' });
      setFeedback({
        type: 'ok',
        text: `Withdrawal completed for "${title}". Amplyra AI has updated your post-deal engagement average and Tier eligibility.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['creator-earnings'] }),
        queryClient.invalidateQueries({ queryKey: ['creator-me'] }),
        queryClient.invalidateQueries({ queryKey: ['creator-work'] }),
      ]);
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    } finally {
      setWithdrawingId(null);
    }
  }

  return (
    <DashboardShell
      title="Earnings & 15-Day Withdrawals"
      roleLabel="Creator Workspace"
      navItems={CREATOR_NAV}
    >
      <div className="space-y-6">
        <div className="bg-emerald-950 text-emerald-50 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
              15-Day Creator Payout Protection
            </p>
            <p className="text-sm mt-1 text-emerald-100">
              Funds are held safely in escrow and unlock automatically for withdrawal 15 days after your campaign post goes live. Once withdrawn, Amplyra AI averages the deal&apos;s insight metrics into your Creator Tier score.
            </p>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-3.5 rounded-xl border text-sm ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {isLoading || !data ? (
          <p className="text-sm text-slate-500">Loading earnings...</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-white p-5 rounded-2xl border border-emerald-200">
                <p className="text-xs text-slate-500 uppercase flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                  Ready to Withdraw
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-700">
                  {formatNgnFromKobo(data.summary.withdrawableKobo ?? 0)}
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500 uppercase flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-amber-600" />
                  In 15-Day Lock
                </p>
                <p className="mt-2 text-2xl font-bold text-amber-700">
                  {formatNgnFromKobo(data.summary.lockedKobo ?? data.summary.heldKobo)}
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500 uppercase">Total Withdrawn</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {formatNgnFromKobo(data.summary.releasedKobo)}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-slate-900">Job Payouts &amp; 15-Day Timers</h2>
              {data.items.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No active jobs yet. Accept an offer in Available Offers to start earning.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.items.map((item) => (
                    <div
                      key={item.assignmentId}
                      className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <p className="text-emerald-700 font-semibold">{item.businessName}</p>
                        <p className="font-bold text-sm text-slate-900">{item.campaignTitle}</p>
                        <p className="text-slate-600">
                          Fixed Tier Fee: {formatNgnFromKobo(item.grossRateKobo)} • 10% Platform Fee:{' '}
                          {formatNgnFromKobo(item.platformFeeKobo)} • Your Net Payout:{' '}
                          <strong className="text-slate-900">
                            {formatNgnFromKobo(item.netEarningsKobo)}
                          </strong>
                        </p>
                        {item.unlockAt && (
                          <p className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                            Posted {new Date(item.postSubmittedAt!).toLocaleDateString()} •{' '}
                            {item.daysRemaining && item.daysRemaining > 0
                              ? `Unlocks on ${new Date(item.unlockAt).toLocaleDateString()} (${item.daysRemaining} day(s) remaining)`
                              : `15-day retention unlocked on ${new Date(item.unlockAt).toLocaleDateString()}`}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        {item.fundingStatus === 'RELEASED' ? (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                            Withdrawn
                          </span>
                        ) : item.canWithdraw ? (
                          <button
                            type="button"
                            disabled={withdrawingId === item.campaignId}
                            onClick={() => handleWithdraw(item.campaignId, item.campaignTitle)}
                            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                          >
                            {withdrawingId === item.campaignId
                              ? 'Processing...'
                              : `Withdraw ${formatNgnFromKobo(item.netEarningsKobo)}`}
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium">
                            {item.withdrawBlockedReason || item.fundingStatus || 'Pending'}
                          </span>
                        )}
                      </div>
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
