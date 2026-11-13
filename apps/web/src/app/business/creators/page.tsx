'use client';

import { useQuery } from '@tanstack/react-query';
import { formatNgnFromKobo, nairaToKobo } from '@amplyra/shared';
import { CheckCircle2, MapPin, Search } from 'lucide-react';
import { useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { BUSINESS_NAV } from '@/components/nav-configs';
import { apiFetch } from '@/lib/api';

interface CreatorItem {
  id: string;
  displayName: string;
  bio?: string | null;
  city?: string | null;
  state?: string | null;
  country: string;
  categories: string[];
  niches: string[];
  isAvailable: boolean;
  minRateKobo: number;
  maxRateKobo?: number | null;
  verifiedAt?: string | null;
  socialAccounts: Array<{
    id: string;
    platform: string;
    handle: string;
    followersCount: number;
    avgEngagementRate?: number | null;
  }>;
}

interface CampaignOption {
  id: string;
  title: string;
  status: string;
}

export default function BusinessCreatorMarketplacePage() {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [platform, setPlatform] = useState('');
  const [maxRateNaira, setMaxRateNaira] = useState('');
  const [inviteCreatorId, setInviteCreatorId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (q) queryParams.set('q', q);
  if (city) queryParams.set('city', city);
  if (category) queryParams.set('category', category);
  if (platform) queryParams.set('platform', platform);
  if (maxRateNaira) queryParams.set('maxRateKobo', String(nairaToKobo(Number(maxRateNaira))));

  const { data: creators = [], isLoading } = useQuery({
    queryKey: ['creators-discover', q, city, category, platform, maxRateNaira],
    queryFn: () =>
      apiFetch<CreatorItem[]>(`/creators/discover?${queryParams.toString()}`),
  });

  const { data: myCampaigns = [] } = useQuery({
    queryKey: ['business-campaigns'],
    queryFn: () => apiFetch<CampaignOption[]>('/campaigns'),
  });

  async function sendInvite() {
    if (!inviteCreatorId || !selectedCampaignId) return;
    setInviteFeedback(null);
    try {
      await apiFetch(`/campaigns/${selectedCampaignId}/invite`, {
        method: 'POST',
        body: JSON.stringify({
          creatorId: inviteCreatorId,
          message: inviteMessage || undefined,
        }),
      });
      setInviteFeedback('Invitation sent to creator.');
      setInviteCreatorId(null);
      setInviteMessage('');
    } catch (err) {
      setInviteFeedback((err as Error).message);
    }
  }

  return (
    <DashboardShell
      title="Creator Marketplace"
      roleLabel="Business Workspace"
      navItems={BUSINESS_NAV}
    >
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or bio..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City (e.g. Katsina, Lagos)"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value="">All Categories</option>
            <option value="Fashion">Fashion</option>
            <option value="Beauty">Beauty</option>
            <option value="Food">Food</option>
            <option value="Lifestyle">Lifestyle</option>
            <option value="Consumer Products">Consumer Products</option>
            <option value="Local Services">Local Services</option>
          </select>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value="">All Platforms</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="TIKTOK">TikTok</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="YOUTUBE">YouTube</option>
          </select>
          <input
            type="number"
            min={0}
            value={maxRateNaira}
            onChange={(e) => setMaxRateNaira(e.target.value)}
            placeholder="Max starting rate (₦)"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
        </div>

        {inviteFeedback && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
            {inviteFeedback}
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-slate-500">Searching creators...</div>
        ) : creators.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            No creators matched your current filters.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {creators.map((creator) => (
              <div
                key={creator.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                        {creator.displayName}
                        {creator.verifiedAt && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {[creator.city, creator.state, creator.country]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        creator.isAvailable
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {creator.isAvailable ? 'Available' : 'Busy'}
                    </span>
                  </div>

                  {creator.bio && (
                    <p className="mt-3 text-xs text-slate-600 line-clamp-3">
                      {creator.bio}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {creator.categories.map((cat) => (
                      <span
                        key={cat}
                        className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 space-y-1.5">
                    {creator.socialAccounts.map((sa) => (
                      <div
                        key={sa.id}
                        className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg"
                      >
                        <span className="font-medium text-slate-800">
                          {sa.platform} (@{sa.handle})
                        </span>
                        <span className="text-slate-600">
                          {sa.followersCount.toLocaleString()} followers
                          {sa.avgEngagementRate ? ` • ${sa.avgEngagementRate}% ER` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="text-slate-500 block">Starting rate</span>
                    <span className="font-bold text-slate-900">
                      {formatNgnFromKobo(creator.minRateKobo)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setInviteCreatorId(creator.id);
                      const open = myCampaigns.find((c) => c.status !== 'DRAFT');
                      if (open) setSelectedCampaignId(open.id);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    Invite to Campaign
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {inviteCreatorId && (
          <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center p-4 z-40">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">
                Invite Creator to Campaign
              </h3>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Published Campaign
                </label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="">-- Choose a campaign --</option>
                  {myCampaigns
                    .filter((c) => c.status !== 'DRAFT')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.status})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Invitation Message
                </label>
                <textarea
                  rows={3}
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Share brief notes or timeline expectations..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setInviteCreatorId(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={sendInvite}
                  disabled={!selectedCampaignId}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
                >
                  Send Invitation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
