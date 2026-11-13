'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  SocialPlatform,
  StoragePurpose,
  formatNgnFromKobo,
  nairaToKobo,
} from '@amplyra/shared';
import Link from 'next/link';
import { ChangeEvent, FormEvent, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { CREATOR_NAV } from '@/components/nav-configs';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { uploadToSupabaseStorage } from '@/lib/storage';

interface CreatorProfile {
  id: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  city?: string | null;
  state?: string | null;
  country: string;
  categories: string[];
  minRateKobo: number;
  maxRateKobo?: number | null;
  isAvailable: boolean;
  verifiedAt?: string | null;
  socialAccounts: Array<{
    id: string;
    platform: SocialPlatform;
    handle: string;
    followersCount: number;
    avgEngagementRate?: number | null;
  }>;
  portfolioItems: Array<{
    id: string;
    title: string;
    platform: SocialPlatform;
    postUrl: string;
  }>;
  _count: { applications: number; assignments: number; submittedPosts: number };
}

export default function CreatorOverviewPage() {
  const { user, loading, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [state, setState] = useState('Katsina');
  const [city, setCity] = useState('Katsina');
  const [categoriesText, setCategoriesText] = useState('Fashion, Lifestyle');
  const [minRateNaira, setMinRateNaira] = useState('25000');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>(
    SocialPlatform.INSTAGRAM,
  );
  const [socialHandle, setSocialHandle] = useState('');
  const [followersCount, setFollowersCount] = useState('15000');
  const [engagementRate, setEngagementRate] = useState('4.5');

  const [portTitle, setPortTitle] = useState('');
  const [portPlatform, setPortPlatform] = useState<SocialPlatform>(
    SocialPlatform.TIKTOK,
  );
  const [portUrl, setPortUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const hasProfile = !!user?.creator;

  const { data: creator, isLoading } = useQuery({
    queryKey: ['creator-me'],
    queryFn: () => apiFetch<CreatorProfile>('/creators/me'),
    enabled: !!user && hasProfile,
  });

  async function handleCreateProfile(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch('/creators', {
        method: 'POST',
        body: JSON.stringify({
          displayName,
          bio,
          country: 'Nigeria',
          state,
          city,
          categories: categoriesText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          minRateKobo: nairaToKobo(Number(minRateNaira || 0)),
        }),
      });
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['creator-me'] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSocial(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/creators/me/social-accounts', {
      method: 'POST',
      body: JSON.stringify({
        platform: socialPlatform,
        handle: socialHandle,
        followersCount: Number(followersCount),
        avgEngagementRate: engagementRate ? Number(engagementRate) : undefined,
      }),
    });
    setSocialHandle('');
    queryClient.invalidateQueries({ queryKey: ['creator-me'] });
  }

  async function handleAddPortfolio(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/creators/me/portfolio', {
      method: 'POST',
      body: JSON.stringify({
        title: portTitle,
        platform: portPlatform,
        postUrl: portUrl,
      }),
    });
    setPortTitle('');
    setPortUrl('');
    queryClient.invalidateQueries({ queryKey: ['creator-me'] });
  }

  async function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setError(null);
    try {
      const uploaded = await uploadToSupabaseStorage({
        file,
        purpose: StoragePurpose.CREATOR_AVATAR,
      });
      await apiFetch('/creators/me', {
        method: 'PATCH',
        body: JSON.stringify({ avatarUrl: uploaded.url }),
      });
      queryClient.invalidateQueries({ queryKey: ['creator-me'] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading creator workspace...</div>;
  }

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-700 mb-3">Please sign in to access your Creator Dashboard.</p>
        <Link href="/login" className="text-emerald-700 font-semibold underline">
          Go to Sign in
        </Link>
      </div>
    );
  }

  return (
    <DashboardShell
      title="Creator Overview"
      roleLabel="Creator Workspace"
      navItems={CREATOR_NAV}
    >
      {!hasProfile ? (
        <div className="max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Build your Creator Profile
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Showcase your niche, location, and promotional rates so Nigerian & African brands can discover you.
          </p>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Creator Display Name
              </label>
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Zainab Styles"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Categories (comma-separated)
              </label>
              <input
                value={categoriesText}
                onChange={(e) => setCategoriesText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Minimum Promotional Rate (NGN)
              </label>
              <input
                type="number"
                min={0}
                value={minRateNaira}
                onChange={(e) => setMinRateNaira(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell brands about your content style and audience..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
              >
                {saving ? 'Saving...' : 'Create Creator Profile'}
              </button>
            </div>
          </form>
        </div>
      ) : isLoading || !creator ? (
        <div className="text-sm text-slate-500">Loading creator profile...</div>
      ) : (
        <div className="space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {error}
            </div>
          )}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {creator.avatarUrl ? (
                <img
                  src={creator.avatarUrl}
                  alt={creator.displayName}
                  className="w-12 h-12 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                  {creator.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-slate-900">{creator.displayName}</h2>
                <p className="text-sm text-slate-500">
                  {[creator.city, creator.state, creator.country].filter(Boolean).join(', ')} •
                  Starting rate {formatNgnFromKobo(creator.minRateKobo)}
                </p>
                <label className="inline-block mt-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer">
                  {uploadingAvatar ? 'Uploading photo...' : 'Upload Profile Photo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploadingAvatar}
                    onChange={handleAvatarUpload}
                  />
                </label>
              </div>
            </div>
            <div className="flex gap-3">
              <Link
                href="/creator/discover"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
              >
                Discover Campaigns
              </Link>
              <Link
                href="/creator/work"
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700"
              >
                My Work ({creator._count.assignments})
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase">Applications</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {creator._count.applications}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase">Active Assignments</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                {creator._count.assignments}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase">Submitted Posts</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {creator._count.submittedPosts}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <h3 className="font-semibold text-slate-900">Social Channels</h3>
              <p className="text-xs text-slate-500">
                Add your public handles and audience size. Official OAuth analytics connections arrive in Phase 2 (Amplyra never asks for social passwords).
              </p>
              <div className="space-y-2">
                {creator.socialAccounts.map((sa) => (
                  <div
                    key={sa.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-slate-900">
                      {sa.platform} (@{sa.handle})
                    </span>
                    <span className="text-slate-600">
                      {sa.followersCount.toLocaleString()} followers
                      {sa.avgEngagementRate ? ` • ${sa.avgEngagementRate}% ER` : ''}
                    </span>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddSocial} className="grid gap-2 sm:grid-cols-4 pt-2">
                <select
                  value={socialPlatform}
                  onChange={(e) => setSocialPlatform(e.target.value as SocialPlatform)}
                  className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value={SocialPlatform.INSTAGRAM}>Instagram</option>
                  <option value={SocialPlatform.TIKTOK}>TikTok</option>
                  <option value={SocialPlatform.FACEBOOK}>Facebook</option>
                  <option value={SocialPlatform.YOUTUBE}>YouTube</option>
                </select>
                <input
                  required
                  value={socialHandle}
                  onChange={(e) => setSocialHandle(e.target.value)}
                  placeholder="@handle"
                  className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
                />
                <input
                  type="number"
                  required
                  value={followersCount}
                  onChange={(e) => setFollowersCount(e.target.value)}
                  placeholder="Followers"
                  className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
                />
                <input
                  type="number"
                  step="0.1"
                  value={engagementRate}
                  onChange={(e) => setEngagementRate(e.target.value)}
                  placeholder="ER %"
                  className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
                />
                <button
                  type="submit"
                  className="sm:col-span-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                >
                  Save Social Channel
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <h3 className="font-semibold text-slate-900">Portfolio Highlights</h3>
              <div className="space-y-2">
                {creator.portfolioItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  >
                    <p className="font-semibold text-slate-900">
                      {item.title} ({item.platform})
                    </p>
                    <a
                      href={item.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 hover:underline break-all"
                    >
                      {item.postUrl}
                    </a>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddPortfolio} className="space-y-2 pt-2">
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    required
                    value={portTitle}
                    onChange={(e) => setPortTitle(e.target.value)}
                    placeholder="Campaign / post title"
                    className="sm:col-span-2 px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                  <select
                    value={portPlatform}
                    onChange={(e) => setPortPlatform(e.target.value as SocialPlatform)}
                    className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value={SocialPlatform.TIKTOK}>TikTok</option>
                    <option value={SocialPlatform.INSTAGRAM}>Instagram</option>
                    <option value={SocialPlatform.FACEBOOK}>Facebook</option>
                  </select>
                </div>
                <input
                  type="url"
                  required
                  value={portUrl}
                  onChange={(e) => setPortUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/@you/video/..."
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                >
                  Add Portfolio Link
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
