'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNgnFromKobo, nairaToKobo } from '@amplyra/shared';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { BUSINESS_NAV } from '@/components/nav-configs';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface BusinessDashboardResponse {
  business: {
    id: string;
    name: string;
    industry: string;
    city?: string | null;
    state?: string | null;
    country: string;
    brandTone?: string | null;
  };
  summary: {
    totalCampaigns: number;
    activeCampaigns: number;
    draftCampaigns: number;
    pendingApplicationsCount: number;
    submittedPostsCount: number;
    totalBudgetCommittedKobo: number;
  };
  recentCampaigns: Array<{
    id: string;
    title: string;
    status: string;
    budgetKobo: number;
    _count: { applications: number; assignments: number; posts: number };
  }>;
  recentPosts: Array<{
    id: string;
    platform: string;
    postUrl: string;
    verificationStatus: string;
    campaign: { id: string; title: string };
    creator: { id: string; displayName: string };
  }>;
}

export default function BusinessOverviewPage() {
  const { user, loading, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('Fashion & Beauty');
  const [state, setState] = useState('Katsina');
  const [city, setCity] = useState('Katsina');
  const [productsServices, setProductsServices] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [brandTone, setBrandTone] = useState('Warm, modern, trustworthy');
  const [monthlyBudgetNaira, setMonthlyBudgetNaira] = useState('150000');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hasProfile = !!user?.business;

  const { data, isLoading } = useQuery({
    queryKey: ['business-dashboard'],
    queryFn: () => apiFetch<BusinessDashboardResponse>('/businesses/dashboard'),
    enabled: !!user && hasProfile,
  });

  async function handleCreateProfile(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await apiFetch('/businesses', {
        method: 'POST',
        body: JSON.stringify({
          name,
          industry,
          country: 'Nigeria',
          state,
          city,
          productsServices,
          targetAudience,
          brandTone,
          monthlyBudgetKobo: monthlyBudgetNaira
            ? nairaToKobo(Number(monthlyBudgetNaira))
            : undefined,
        }),
      });
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['business-dashboard'] });
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading workspace...</div>;
  }

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-700 mb-3">Please sign in to access your Business Dashboard.</p>
        <Link href="/login" className="text-emerald-700 font-semibold underline">
          Go to Sign in
        </Link>
      </div>
    );
  }

  return (
    <DashboardShell
      title="Business Overview"
      roleLabel="Business Workspace"
      navItems={BUSINESS_NAV}
    >
      {!hasProfile ? (
        <div className="max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Complete your Business Profile
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Tell Amplyra about your organisation so creators understand your brand and goals.
          </p>

          {formError && (
            <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Business Name
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Katsina Threadz"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Industry
              </label>
              <input
                required
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Monthly Marketing Budget (NGN)
              </label>
              <input
                type="number"
                min={0}
                value={monthlyBudgetNaira}
                onChange={(e) => setMonthlyBudgetNaira(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                State
              </label>
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                City
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Products & Services
              </label>
              <textarea
                rows={2}
                value={productsServices}
                onChange={(e) => setProductsServices(e.target.value)}
                placeholder="What do you sell or promote?"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Target Audience & Brand Tone
              </label>
              <input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. Young professionals and shoppers in Northern Nigeria"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm mb-2"
              />
              <input
                value={brandTone}
                onChange={(e) => setBrandTone(e.target.value)}
                placeholder="Brand tone"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
              >
                {saving ? 'Saving profile...' : 'Save Business Profile'}
              </button>
            </div>
          </form>
        </div>
      ) : isLoading || !data ? (
        <div className="text-sm text-slate-500">Loading business dashboard...</div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{data.business.name}</h2>
              <p className="text-sm text-slate-500">
                {data.business.industry} • {data.business.city || data.business.state || data.business.country}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/business/creators"
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Browse Creators
              </Link>
              <Link
                href="/business/campaigns"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
              >
                Manage Campaigns
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase">Active Campaigns</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.summary.activeCampaigns}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase">Pending Applications</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                {data.summary.pendingApplicationsCount}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase">Submitted Posts</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.summary.submittedPostsCount}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase">Committed Budget</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatNgnFromKobo(data.summary.totalBudgetCommittedKobo)}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Recent Campaigns</h3>
              {data.recentCampaigns.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No campaigns yet. Launch your first campaign to start matching with creators.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.recentCampaigns.map((c) => (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{c.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatNgnFromKobo(c.budgetKobo)} • {c._count.applications} applications •{' '}
                          {c._count.posts} posts
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Latest Submitted Posts</h3>
              {data.recentPosts.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Submitted creator post URLs will appear here once deliverables go live.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.recentPosts.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900">
                          {p.creator.displayName} • {p.platform}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                          {p.verificationStatus}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{p.campaign.title}</p>
                      <a
                        href={p.postUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-700 hover:underline mt-1 inline-block break-all"
                      >
                        {p.postUrl}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
