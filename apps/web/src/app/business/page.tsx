'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  StoragePurpose,
  formatNgnFromKobo,
  getCreatorTierDefinition,
  nairaToKobo,
} from '@amplyra/shared';
import Link from 'next/link';
import { ChangeEvent, FormEvent, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { BUSINESS_NAV } from '@/components/nav-configs';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { uploadToSupabaseStorage } from '@/lib/storage';

interface BusinessDashboardResponse {
  business: {
    id: string;
    name: string;
    industry: string;
    logoUrl?: string | null;
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
    targetTier?: string;
    budgetKobo: number;
    funding?: { status: string } | null;
    _count: { applications: number; assignments: number; posts: number };
  }>;
  recentPosts: Array<{
    id: string;
    platform: string;
    postUrl: string;
    verificationStatus: string;
    retentionUntil: string;
    aiInsightSummary?: string | null;
    lastSyncedAt?: string | null;
    campaign: { id: string; title: string };
    creator: {
      id: string;
      displayName: string;
      tier?: string;
      overallAvgEngagement?: number | null;
    };
    metricSnapshots?: Array<{
      metricSource: string;
      views: number | null;
      likes: number | null;
      comments: number | null;
      shares: number | null;
    }>;
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [syncingAi, setSyncingAi] = useState(false);

  const hasProfile = !!user?.business;

  const { data, isLoading } = useQuery({
    queryKey: ['business-dashboard'],
    queryFn: () => apiFetch<BusinessDashboardResponse>('/businesses/dashboard'),
    enabled: !!user && hasProfile,
  });

  async function refreshAgenticInsights() {
    setSyncingAi(true);
    setFormError(null);
    try {
      await apiFetch('/campaigns/agentic-sync', { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: ['business-dashboard'] });
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSyncingAi(false);
    }
  }

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

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setFormError(null);
    try {
      const uploaded = await uploadToSupabaseStorage({
        file,
        purpose: StoragePurpose.BUSINESS_LOGO,
      });
      await apiFetch('/businesses/me', {
        method: 'PATCH',
        body: JSON.stringify({ logoUrl: uploaded.url }),
      });
      queryClient.invalidateQueries({ queryKey: ['business-dashboard'] });
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
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
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {formError}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-4">
              {data.business.logoUrl ? (
                <img
                  src={data.business.logoUrl}
                  alt={data.business.name}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                  {data.business.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-slate-900">{data.business.name}</h2>
                <p className="text-sm text-slate-500">
                  {data.business.industry} • {data.business.city || data.business.state || data.business.country}
                </p>
                <label className="inline-block mt-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer">
                  {uploadingLogo ? 'Uploading logo...' : 'Upload Brand Logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={handleLogoUpload}
                  />
                </label>
              </div>
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
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-semibold text-slate-900">Recent Adverts</h3>
                <Link
                  href="/business/campaigns"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  + New Advert
                </Link>
              </div>
              {data.recentCampaigns.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No adverts yet. Create your first advert brief and set a fixed Creator Tier budget.
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
                          {formatNgnFromKobo(c.budgetKobo)}
                          {c.targetTier ? ` • ${getCreatorTierDefinition(c.targetTier).shortLabel}` : ''} •{' '}
                          {c._count.applications} applicants • {c._count.posts} live posts
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        {c.funding?.status === 'HELD_BY_PARTNER' ? 'ESCROW HELD' : c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Amplyra Agentic AI • Post Analytics
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Automatically tracks creator post links and accessible engagement insights.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={syncingAi}
                  onClick={refreshAgenticInsights}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer shrink-0"
                >
                  {syncingAi ? 'Syncing AI...' : 'Refresh AI Insights'}
                </button>
              </div>
              {data.recentPosts.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Once a Creator posts and submits their link, Amplyra Agentic AI will report insights here.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.recentPosts.map((p) => {
                    const snap = p.metricSnapshots?.[0];
                    const daysLeft = Math.max(
                      0,
                      Math.ceil((new Date(p.retentionUntil).getTime() - Date.now()) / 86_400_000),
                    );
                    return (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-900">
                            {p.creator.displayName}
                            {p.creator.tier ? ` (${getCreatorTierDefinition(p.creator.tier).shortLabel})` : ''} • {p.platform}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                            {daysLeft > 0 ? `${daysLeft}d left in hold` : '15d hold complete'}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500">{p.campaign.title}</p>
                        {p.aiInsightSummary && (
                          <p className="text-xs text-slate-800 bg-white border border-slate-200 rounded-lg p-2.5 leading-relaxed">
                            {p.aiInsightSummary}
                          </p>
                        )}
                        {snap && (
                          <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                            {snap.views !== null && (
                              <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                                Views: <strong>{snap.views.toLocaleString()}</strong>
                              </span>
                            )}
                            {snap.likes !== null && (
                              <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                                Likes: <strong>{snap.likes.toLocaleString()}</strong>
                              </span>
                            )}
                            {snap.comments !== null && (
                              <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                                Comments: <strong>{snap.comments.toLocaleString()}</strong>
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              Source: {snap.metricSource}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <a
                            href={p.postUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 hover:underline truncate max-w-[75%]"
                          >
                            {p.postUrl}
                          </a>
                          {p.lastSyncedAt && (
                            <span className="text-slate-400 shrink-0">
                              Synced {new Date(p.lastSyncedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
