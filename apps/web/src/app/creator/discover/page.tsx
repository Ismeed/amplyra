'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNgnFromKobo, nairaToKobo } from '@amplyra/shared';
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
  const [proposedRateNaira, setProposedRateNaira] = useState('');
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
          pitch,
          proposedRateKobo: proposedRateNaira
            ? nairaToKobo(Number(proposedRateNaira))
            : undefined,
        }),
      });
      setFeedback(`Application submitted to ${applyingCampaign.business.name}!`);
      setApplyingCampaign(null);
      setPitch('');
      setProposedRateNaira('');
      queryClient.invalidateQueries({ queryKey: ['creator-work'] });
    } catch (err) {
      setFeedback((err as Error).message);
    }
  }

  return (
    <DashboardShell
      title="Discover Campaigns"
      roleLabel="Creator Workspace"
      navItems={CREATOR_NAV}
    >
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 grid gap-3 sm:grid-cols-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search campaigns by keyword or product..."
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Filter by target city (e.g. Katsina, Lagos)..."
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
        </div>

        {feedback && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
            {feedback}
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading open campaigns...</p>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            No open campaigns matched your filters.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {campaigns.map((c) => (
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
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900">
                      {formatNgnFromKobo(c.budgetKobo)}
                    </span>
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
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {c.retentionDays}-day retention
                    </span>
                    {c.targetCity && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {c.targetCity}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setApplyingCampaign(c)}
                  className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Apply for Campaign
                </button>
              </div>
            ))}
          </div>
        )}

        {applyingCampaign && (
          <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center p-4 z-40">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">
                Apply to {applyingCampaign.title}
              </h3>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Your Proposed Rate (NGN, optional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={proposedRateNaira}
                  onChange={(e) => setProposedRateNaira(e.target.value)}
                  placeholder="Leave blank to accept campaign budget"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pitch & Content Concept
                </label>
                <textarea
                  rows={3}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="Explain how you will present this product to your audience..."
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
                  Submit Application
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
