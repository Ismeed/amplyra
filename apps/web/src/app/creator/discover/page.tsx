'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNgnFromKobo } from '@amplyra/shared';
import { CheckCircle2, Lock, MapPin } from 'lucide-react';
import { useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { CREATOR_NAV } from '@/components/nav-configs';
import { apiFetch } from '@/lib/api';

interface OpenCampaign {
  id: string;
  title: string;
  productOrService: string;
  description: string;
  budgetKobo: number;
  retentionDays: number;
  targetCity?: string | null;
  targetState?: string | null;
  targetTier?: string;
  fixedTierRateKobo?: number;
  tierLabel?: string;
  creatorTier?: string;
  isEligibleForMyTier?: boolean;
  platforms: string[];
  preferredCategories: string[];
  business: {
    id: string;
    name: string;
    industry: string;
    city?: string | null;
    state?: string | null;
  };
}

export default function CreatorDiscoverCampaignsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [applyingCampaign, setApplyingCampaign] = useState<OpenCampaign | null>(null);
  const [pitch, setPitch] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (city) params.set('city', city);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['discover-campaigns', q, city],
    queryFn: () => apiFetch<OpenCampaign[]>(`/campaigns?${params.toString()}`),
  });

  async function submitApplication() {
    if (!applyingCampaign) return;
    setFeedback(null);
    try {
      await apiFetch(`/campaigns/${applyingCampaign.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          pitch: pitch || undefined,
        }),
      });
      setFeedback(
        `Offer accepted/applied for ${applyingCampaign.business.name} at fixed ${applyingCampaign.tierLabel ?? 'Tier'} rate! Check "Active Jobs & Post Link" once approved.`,
      );
      setApplyingCampaign(null);
      setPitch('');
      queryClient.invalidateQueries({ queryKey: ['creator-work'] });
    } catch (err) {
      setFeedback((err as Error).message);
    }
  }

  return (
    <DashboardShell
      title="Available Fixed-Price Offers"
      roleLabel="Creator Workspace"
      navItems={CREATOR_NAV}
    >
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 grid gap-3 sm:grid-cols-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search adverts by keyword or product..."
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Filter by target city (e.g. Katsina, Kano, Lagos)..."
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
        </div>

        {feedback && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
            {feedback}
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading available offers...</p>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            No open adverts matched your filters right now.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {campaigns.map((c) => {
              const eligible = c.isEligibleForMyTier !== false;
              const fixedPrice = c.fixedTierRateKobo ?? c.budgetKobo;

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-emerald-700">
                          {c.business.name} • {c.business.industry}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                          {c.title}
                        </h3>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 block">
                          {formatNgnFromKobo(fixedPrice)} Fixed
                        </span>
                        {c.tierLabel && (
                          <span className="text-[10px] text-slate-500 block mt-1">
                            {c.tierLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="mt-2 text-sm text-slate-600">{c.description}</p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.platforms.map((p) => (
                        <span
                          key={p}
                          className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-800"
                        >
                          {p}
                        </span>
                      ))}
                      {(c.targetCity || c.targetState) && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[c.targetCity, c.targetState].filter(Boolean).join(', ')}
                        </span>
                      )}
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {c.retentionDays}-day withdrawal lock
                      </span>
                    </div>
                  </div>

                  {eligible ? (
                    <button
                      onClick={() => setApplyingCampaign(c)}
                      className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Apply at Fixed {formatNgnFromKobo(fixedPrice)}
                    </button>
                  ) : (
                    <div className="w-full py-2.5 px-3 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium inline-flex items-center justify-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      Requires {c.tierLabel || c.targetTier} (Grow followers &amp; AI ER%)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {applyingCampaign && (
          <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center p-4 z-40">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">
                Apply to {applyingCampaign.title}
              </h3>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <p>
                  <strong>Fixed Job Rate:</strong>{' '}
                  {formatNgnFromKobo(
                    applyingCampaign.fixedTierRateKobo ?? applyingCampaign.budgetKobo,
                  )}{' '}
                  ({applyingCampaign.tierLabel ?? applyingCampaign.targetTier})
                </p>
                <p>
                  Payout is locked in escrow and unlocked for withdrawal{' '}
                  {applyingCampaign.retentionDays} days after you submit your live post link.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Quick Note for the Business (optional)
                </label>
                <textarea
                  rows={3}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="Share how you will promote this product to your audience..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setApplyingCampaign(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={submitApplication}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
                >
                  Confirm &amp; Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
