'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CREATOR_TIER_DEFINITIONS,
  CreatorTier,
  SocialPlatform,
  StoragePurpose,
  calculatePlatformFeeSplit,
  formatNgnFromKobo,
  getCreatorTierDefinition,
  nairaToKobo,
} from '@amplyra/shared';
import { ChangeEvent, FormEvent, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { EvidenceFilePreview } from '@/components/evidence-file-preview';
import { BUSINESS_NAV } from '@/components/nav-configs';
import { apiFetch } from '@/lib/api';
import { uploadToSupabaseStorage } from '@/lib/storage';

interface CampaignDetail {
  id: string;
  title: string;
  productOrService: string;
  description: string;
  status: string;
  targetTier?: string;
  budgetKobo: number;
  retentionDays: number;
  targetCity?: string | null;
  targetState?: string | null;
  platforms: string[];
  applications?: Array<{
    id: string;
    status: string;
    type: string;
    pitch?: string | null;
    proposedRateKobo?: number | null;
    creator: { id: string; displayName: string; tier?: string };
  }>;
  posts?: Array<{
    id: string;
    platform: string;
    postUrl: string;
    platformPostId?: string | null;
    verificationStatus: string;
    retentionUntil: string;
    aiInsightSummary?: string | null;
    lastSyncedAt?: string | null;
    creator: { id: string; displayName: string };
  }>;
}

interface CampaignAnalyticsResponse {
  totals: {
    views: number | null;
    reach: number | null;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
  kpis: {
    totalEngagements: number | null;
    engagementRateByViewsPct: number | null;
    engagementRateByReachPct: number | null;
    costPerViewKobo: number | null;
    costPerEngagementKobo: number | null;
    methodologyNotes: string[];
  };
  sourceBreakdown: Record<string, number>;
  reports: Array<{
    id: string;
    postId: string;
    milestoneDay: number;
    dueAt: string;
    submittedAt: string | null;
    status: string;
    notes: string | null;
    uploadedFiles?: Array<{
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    }>;
  }>;
}

interface CampaignStoredFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  purpose: string;
  accessUrl: string | null;
}

interface CampaignPaymentResponse {
  funding: {
    id: string;
    amountKobo: number;
    platformFeeKobo: number;
    creatorNetKobo: number;
    provider: string;
    providerReference: string;
    status: string;
  } | null;
}

export default function BusinessCampaignsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');

  const [title, setTitle] = useState('');
  const [productOrService, setProductOrService] = useState('');
  const [description, setDescription] = useState('');
  const [targetState, setTargetState] = useState('Katsina');
  const [targetCity, setTargetCity] = useState('Katsina');
  const [targetTier, setTargetTier] = useState<CreatorTier>(CreatorTier.TIER_2);
  const [budgetNaira, setBudgetNaira] = useState('25000');
  const [deliverableFormat, setDeliverableFormat] = useState('60s Short Video / Reel');
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([
    SocialPlatform.INSTAGRAM,
    SocialPlatform.TIKTOK,
  ]);
  const [creating, setCreating] = useState(false);
  const [uploadingBriefMedia, setUploadingBriefMedia] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['business-campaigns'],
    queryFn: () => apiFetch<CampaignDetail[]>('/campaigns'),
  });

  const { data: selectedCampaign } = useQuery({
    queryKey: ['campaign-detail', selectedCampaignId],
    queryFn: () => apiFetch<CampaignDetail>(`/campaigns/${selectedCampaignId}`),
    enabled: !!selectedCampaignId,
  });

  const { data: analytics } = useQuery({
    queryKey: ['campaign-analytics', selectedCampaignId],
    queryFn: () =>
      apiFetch<CampaignAnalyticsResponse>(
        `/campaigns/${selectedCampaignId}/analytics`,
      ),
    enabled: !!selectedCampaignId,
  });

  const { data: paymentInfo } = useQuery({
    queryKey: ['campaign-payment', selectedCampaignId],
    queryFn: () =>
      apiFetch<CampaignPaymentResponse>(`/payments/${selectedCampaignId}`),
    enabled: !!selectedCampaignId,
  });

  const { data: campaignFiles = [] } = useQuery({
    queryKey: ['campaign-files', selectedCampaignId],
    queryFn: () =>
      apiFetch<CampaignStoredFile[]>(
        `/storage/campaigns/${selectedCampaignId}/files`,
      ),
    enabled: !!selectedCampaignId,
  });

  function togglePlatform(p: SocialPlatform) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p],
    );
  }

  function invalidateSelected(campaignId: string) {
    queryClient.invalidateQueries({ queryKey: ['business-campaigns'] });
    queryClient.invalidateQueries({ queryKey: ['campaign-detail', campaignId] });
    queryClient.invalidateQueries({ queryKey: ['campaign-analytics', campaignId] });
    queryClient.invalidateQueries({ queryKey: ['campaign-payment', campaignId] });
    queryClient.invalidateQueries({ queryKey: ['campaign-files', campaignId] });
  }

  async function handleCampaignMediaUpload(
    e: ChangeEvent<HTMLInputElement>,
    campaignId: string,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBriefMedia(true);
    setActionMessage(null);
    try {
      const uploaded = await uploadToSupabaseStorage({
        file,
        purpose: StoragePurpose.CAMPAIGN_MEDIA,
        campaignId,
      });
      setActionMessage(
        `Uploaded campaign brief asset "${uploaded.originalName}" to Supabase Storage.`,
      );
      invalidateSelected(campaignId);
    } catch (err) {
      setActionMessage((err as Error).message);
    } finally {
      setUploadingBriefMedia(false);
      e.target.value = '';
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (platforms.length === 0) {
      setError('Select at least one platform');
      return;
    }
    setCreating(true);
    try {
      const created = await apiFetch<CampaignDetail>('/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title,
          productOrService,
          description,
          targetCountry: 'Nigeria',
          targetState: targetState || undefined,
          targetCity: targetCity || undefined,
          targetTier,
          platforms,
          budgetKobo: nairaToKobo(Number(budgetNaira)),
          retentionDays: 15,
          deliverables: [
            {
              platform: platforms[0],
              format: deliverableFormat,
              quantity: 1,
            },
          ],
        }),
      });
      setTitle('');
      setProductOrService('');
      setDescription('');
      setShowCreate(false);
      setSelectedCampaignId(created.id);
      queryClient.invalidateQueries({ queryKey: ['business-campaigns'] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function publishCampaign(id: string) {
    setActionMessage(null);
    await apiFetch(`/campaigns/${id}/publish`, { method: 'POST' });
    setActionMessage('Campaign published to Creator Marketplace.');
    invalidateSelected(id);
  }

  async function decideApplication(
    campaignId: string,
    applicationId: string,
    decision: 'APPROVE' | 'DECLINE',
  ) {
    setActionMessage(null);
    await apiFetch(`/campaigns/${campaignId}/approve-creator`, {
      method: 'POST',
      body: JSON.stringify({ applicationId, decision }),
    });
    setActionMessage(
      decision === 'APPROVE'
        ? 'Creator approved and assignment created.'
        : 'Application declined.',
    );
    invalidateSelected(campaignId);
  }

  async function fundCampaign(campaignId: string) {
    setActionMessage(null);
    try {
      const res = await apiFetch<{ authorizationUrl?: string }>(
        '/payments/fund-campaign',
        {
          method: 'POST',
          body: JSON.stringify({ campaignId }),
        },
      );
      if (res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
        return;
      }
      setActionMessage('Campaign funded and held via partner ledger.');
      invalidateSelected(campaignId);
    } catch (err) {
      setActionMessage((err as Error).message);
    }
  }

  async function runVerify(campaignId: string) {
    setActionMessage(null);
    const res = await apiFetch<{
      checkedPosts: number;
      allRetentionMet: boolean;
      results: Array<{ note: string }>;
    }>(`/campaigns/${campaignId}/verify`, { method: 'POST' });
    setActionMessage(
      `Verification checked ${res.checkedPosts} post(s). ${res.results[0]?.note || ''}`,
    );
    invalidateSelected(campaignId);
  }

  async function releasePayment(campaignId: string) {
    setActionMessage(null);
    try {
      await apiFetch(`/payments/${campaignId}/release`, {
        method: 'POST',
        body: JSON.stringify({ confirmEarlyRelease: true }),
      });
      setActionMessage('Payment released to creator.');
      invalidateSelected(campaignId);
    } catch (err) {
      setActionMessage((err as Error).message);
    }
  }

  async function openDispute(campaignId: string) {
    if (!disputeReason.trim()) return;
    setActionMessage(null);
    try {
      await apiFetch(`/payments/${campaignId}/dispute`, {
        method: 'POST',
        body: JSON.stringify({ reason: disputeReason }),
      });
      setDisputeReason('');
      setActionMessage('Dispute opened for administrator review.');
      invalidateSelected(campaignId);
    } catch (err) {
      setActionMessage((err as Error).message);
    }
  }

  async function flagReport(campaignId: string, reportId: string) {
    await apiFetch(`/campaigns/reports/${reportId}/flag`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Flagged by business for verification review' }),
    });
    setActionMessage('Report flagged for review.');
    invalidateSelected(campaignId);
  }

  const feePreview = selectedCampaign
    ? calculatePlatformFeeSplit(selectedCampaign.budgetKobo)
    : null;

  return (
    <DashboardShell
      title="Campaigns & Verification"
      roleLabel="Business Workspace"
      navItems={BUSINESS_NAV}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Create location-targeted adverts at fixed Creator Tiers, fund escrow, and track Amplyra Agentic AI post insights.
          </p>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
          >
            {showCreate ? 'Close Form' : '+ Create Advert'}
          </button>
        </div>

        {actionMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
            {actionMessage}
          </div>
        )}

        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-2xl border border-slate-200 p-6 grid gap-4 sm:grid-cols-2"
          >
            <h3 className="sm:col-span-2 text-base font-bold text-slate-900">
              Create Location-Targeted Advert
            </h3>
            {error && (
              <div className="sm:col-span-2 p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Advert Title
              </label>
              <input
                required
                minLength={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Katsina Harmattan Launch"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Product or Service
              </label>
              <input
                required
                value={productOrService}
                onChange={(e) => setProductOrService(e.target.value)}
                placeholder="e.g. Tailored Kaftans"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                Select Creator Tier &amp; Fixed Per-Post Budget
              </label>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {CREATOR_TIER_DEFINITIONS.map((t) => {
                  const selected = targetTier === t.tier;
                  return (
                    <button
                      key={t.tier}
                      type="button"
                      onClick={() => {
                        setTargetTier(t.tier);
                        setBudgetNaira(String(t.fixedPriceKobo / 100));
                      }}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        selected
                          ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                        <span>{t.label}</span>
                        <span className="text-emerald-700">
                          {formatNgnFromKobo(t.fixedPriceKobo)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">{t.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target State
              </label>
              <input
                value={targetState}
                onChange={(e) => setTargetState(e.target.value)}
                placeholder="e.g. Katsina, Kano, Lagos"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target City
              </label>
              <input
                value={targetCity}
                onChange={(e) => setTargetCity(e.target.value)}
                placeholder="Leave blank for nationwide reach"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Platforms
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  SocialPlatform.INSTAGRAM,
                  SocialPlatform.TIKTOK,
                  SocialPlatform.FACEBOOK,
                  SocialPlatform.YOUTUBE,
                ].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      platforms.includes(p)
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Primary Deliverable
              </label>
              <input
                required
                value={deliverableFormat}
                onChange={(e) => setDeliverableFormat(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Campaign Description & Brief
              </label>
              <textarea
                required
                minLength={10}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold cursor-pointer"
              >
                {creating ? 'Creating...' : 'Save as Draft'}
              </button>
            </div>
          </form>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-3">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading campaigns...</p>
            ) : campaigns.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">
                No campaigns created yet.
              </div>
            ) : (
              campaigns.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedCampaignId(c.id)}
                  className={`p-4 rounded-2xl border bg-white cursor-pointer transition ${
                    selectedCampaignId === c.id
                      ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm text-slate-900">{c.title}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatNgnFromKobo(c.budgetKobo)}
                    {c.targetTier ? ` • ${getCreatorTierDefinition(c.targetTier).shortLabel}` : ''} •{' '}
                    {c.retentionDays}d withdrawal lock
                  </p>
                  {c.status === 'DRAFT' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        publishCampaign(c.id);
                      }}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      Publish to Marketplace
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-2">
            {!selectedCampaign ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                Select a campaign on the left to manage applicants, protected funding, 5-day verification reports, and analytics.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {selectedCampaign.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedCampaign.productOrService} •{' '}
                      {formatNgnFromKobo(selectedCampaign.budgetKobo)} •{' '}
                      {selectedCampaign.platforms.join(', ')}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                    {selectedCampaign.status}
                  </span>
                </div>

                {/* Protected Payment Panel */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900">
                        Protected Campaign Payment
                      </h4>
                      {feePreview && (
                        <p className="text-xs text-slate-600">
                          Amount: {formatNgnFromKobo(feePreview.grossAmountKobo)} • Platform Fee (10%):{' '}
                          {formatNgnFromKobo(feePreview.platformFeeKobo)} • Creator Net:{' '}
                          {formatNgnFromKobo(feePreview.creatorNetKobo)}
                        </p>
                      )}
                    </div>
                    {paymentInfo?.funding ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-100 text-emerald-800">
                        {paymentInfo.funding.status}
                      </span>
                    ) : (
                      selectedCampaign.status !== 'DRAFT' && (
                        <button
                          onClick={() => fundCampaign(selectedCampaign.id)}
                          className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          Fund Campaign ({formatNgnFromKobo(selectedCampaign.budgetKobo)})
                        </button>
                      )
                    )}
                  </div>

                  {paymentInfo?.funding &&
                    paymentInfo.funding.status === 'HELD_BY_PARTNER' && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={() => releasePayment(selectedCampaign.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                        >
                          Authorize Payout Release
                        </button>
                        <input
                          value={disputeReason}
                          onChange={(e) => setDisputeReason(e.target.value)}
                          placeholder="Reason if opening dispute..."
                          className="flex-1 min-w-44 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                        />
                        <button
                          onClick={() => openDispute(selectedCampaign.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold cursor-pointer"
                        >
                          Open Dispute
                        </button>
                      </div>
                    )}
                </div>

                {/* Analytics & 5-Day Verification */}
                {analytics && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-semibold text-sm text-slate-900">
                        Campaign Analytics & Metric Provenance
                      </h4>
                      <button
                        onClick={() => runVerify(selectedCampaign.id)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Refresh Agentic AI Sync
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block">Views</span>
                        <strong className="text-base text-slate-900">
                          {analytics.totals.views !== null
                            ? analytics.totals.views.toLocaleString()
                            : 'N/A'}
                        </strong>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block">Engagements</span>
                        <strong className="text-base text-slate-900">
                          {analytics.kpis.totalEngagements !== null
                            ? analytics.kpis.totalEngagements.toLocaleString()
                            : '0'}
                        </strong>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block">ER by Views</span>
                        <strong className="text-base text-emerald-700">
                          {analytics.kpis.engagementRateByViewsPct !== null
                            ? `${analytics.kpis.engagementRateByViewsPct}%`
                            : 'N/A'}
                        </strong>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block">Cost / Engagement</span>
                        <strong className="text-base text-slate-900">
                          {analytics.kpis.costPerEngagementKobo !== null
                            ? formatNgnFromKobo(analytics.kpis.costPerEngagementKobo)
                            : 'N/A'}
                        </strong>
                      </div>
                    </div>

                    {Object.keys(analytics.sourceBreakdown).length > 0 && (
                      <p className="text-[11px] text-slate-500">
                        Snapshot sources:{' '}
                        {Object.entries(analytics.sourceBreakdown)
                          .map(([src, count]) => `${src}: ${count}`)
                          .join(' • ')}
                      </p>
                    )}

                    {analytics.reports.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold text-slate-700">
                          5-Day Reporting Milestones
                        </h5>
                        {analytics.reports.map((rep) => (
                          <div
                            key={rep.id}
                            className="p-3 rounded-xl border border-slate-200 flex flex-wrap items-start justify-between gap-2 text-xs"
                          >
                            <div className="space-y-1">
                              <strong>Day {rep.milestoneDay}</strong> • Due{' '}
                              {new Date(rep.dueAt).toLocaleDateString()} •{' '}
                              <span className="font-semibold">{rep.status}</span>
                              {rep.notes && (
                                <p className="text-slate-500 mt-0.5">{rep.notes}</p>
                              )}
                              {rep.uploadedFiles?.map((file) => (
                                <EvidenceFilePreview
                                  key={file.id}
                                  fileId={file.id}
                                  originalName={file.originalName}
                                  mimeType={file.mimeType}
                                />
                              ))}
                            </div>
                            {rep.status !== 'SCHEDULED' && rep.status !== 'FLAGGED' && (
                              <button
                                onClick={() => flagReport(selectedCampaign.id, rep.id)}
                                className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium cursor-pointer"
                              >
                                Flag Evidence
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Campaign Media Storage */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900">
                        Campaign Brief Assets (Supabase Storage)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Upload private product photos, moodboards, or PDF briefs for assigned creators.
                      </p>
                    </div>
                    <label className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer">
                      {uploadingBriefMedia ? 'Uploading...' : 'Upload Asset'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,application/pdf,video/mp4"
                        className="hidden"
                        disabled={uploadingBriefMedia}
                        onChange={(e) =>
                          handleCampaignMediaUpload(e, selectedCampaign.id)
                        }
                      />
                    </label>
                  </div>
                  {campaignFiles.filter((f) => f.purpose === 'CAMPAIGN_MEDIA').length ===
                  0 ? (
                    <p className="text-xs text-slate-500">
                      No campaign assets uploaded yet.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {campaignFiles
                        .filter((f) => f.purpose === 'CAMPAIGN_MEDIA')
                        .map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs"
                          >
                            <span className="truncate font-medium text-slate-800">
                              {file.originalName} (
                              {Math.max(1, Math.round(file.sizeBytes / 1024))} KB)
                            </span>
                            {file.accessUrl && (
                              <a
                                href={file.accessUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-700 hover:underline font-semibold shrink-0"
                              >
                                Download
                              </a>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Applications */}
                <div>
                  <h4 className="font-semibold text-sm text-slate-900 mb-3">
                    Applications & Invitations ({selectedCampaign.applications?.length || 0})
                  </h4>
                  {!selectedCampaign.applications?.length ? (
                    <p className="text-xs text-slate-500">No applications yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedCampaign.applications.map((app) => (
                        <div
                          key={app.id}
                          className="p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div>
                            <p className="font-semibold text-sm text-slate-900">
                              {app.creator.displayName}{' '}
                              <span className="text-xs font-normal text-slate-500">
                                ({app.type} • {app.status})
                              </span>
                            </p>
                            {app.pitch && (
                              <p className="text-xs text-slate-600 mt-1">{app.pitch}</p>
                            )}
                          </div>
                          {app.status === 'PENDING' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  decideApplication(selectedCampaign.id, app.id, 'APPROVE')
                                }
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  decideApplication(selectedCampaign.id, app.id, 'DECLINE')
                                }
                                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Posts */}
                <div>
                  <h4 className="font-semibold text-sm text-slate-900 mb-3">
                    Submitted Posts ({selectedCampaign.posts?.length || 0})
                  </h4>
                  {!selectedCampaign.posts?.length ? (
                    <p className="text-xs text-slate-500">No post URLs submitted yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedCampaign.posts.map((post) => (
                        <div
                          key={post.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900">
                              {post.creator.displayName} • {post.platform}
                              {post.platformPostId ? ` (ID: ${post.platformPostId})` : ''}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                              {post.verificationStatus}
                            </span>
                          </div>
                          <a
                            href={post.postUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 hover:underline mt-1 inline-block break-all"
                          >
                            {post.postUrl}
                          </a>
                          {post.aiInsightSummary && (
                            <p className="mt-2 p-2.5 rounded-lg bg-white border border-slate-200 text-slate-800">
                              {post.aiInsightSummary}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
