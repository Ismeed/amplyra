'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SocialPlatform } from '@amplyra/shared';
import { CheckCircle2, RefreshCw, Shield, Unplug } from 'lucide-react';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';

interface SocialConnection {
  id: string;
  platform: SocialPlatform;
  externalAccountId: string;
  accountName: string;
  accountHandle: string;
  scopes: string[];
  status: string;
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
}

const SUPPORTED_PLATFORMS: Array<{
  platform: SocialPlatform;
  label: string;
  description: string;
}> = [
  {
    platform: SocialPlatform.INSTAGRAM,
    label: 'Instagram Professional',
    description: 'Meta Instagram Platform OAuth for media & insights retrieval.',
  },
  {
    platform: SocialPlatform.TIKTOK,
    label: 'TikTok Account',
    description: 'TikTok Login Kit & Display API (video.list) authorization.',
  },
  {
    platform: SocialPlatform.FACEBOOK,
    label: 'Facebook Page',
    description: 'Meta Graph API Page connection for Page posts & insights.',
  },
];

export function SocialAccountsPanel() {
  const queryClient = useQueryClient();
  const [handleInput, setHandleInput] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyPlatform, setBusyPlatform] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['social-oauth-accounts'],
    queryFn: () => apiFetch<SocialConnection[]>('/social/accounts'),
  });

  async function handleConnect(platform: SocialPlatform) {
    setFeedback(null);
    setBusyPlatform(platform);
    try {
      const handle = handleInput[platform]?.trim() || '';
      const q = handle ? `?handle=${encodeURIComponent(handle)}` : '';
      const init = await apiFetch<{
        platform: string;
        mode: 'official_oauth' | 'sandbox_oauth';
        authorizationUrl: string;
        state: string;
      }>(`/social/${platform.toLowerCase()}/connect${q}`);

      if (init.mode === 'official_oauth') {
        window.location.href = init.authorizationUrl;
        return;
      }

      // Sandbox OAuth mode completes callback directly through API proxy
      const parsed = new URL(init.authorizationUrl);
      const code = parsed.searchParams.get('code') || 'sandbox_code';
      const state = parsed.searchParams.get('state') || init.state;
      await apiFetch(
        `/social/${platform.toLowerCase()}/callback?${new URLSearchParams({
          code,
          state,
          ...(handle ? { handle } : {}),
        }).toString()}`,
      );
      setFeedback(`Connected ${platform} via sandbox OAuth consent flow.`);
      queryClient.invalidateQueries({ queryKey: ['social-oauth-accounts'] });
    } catch (err) {
      setFeedback((err as Error).message);
    } finally {
      setBusyPlatform(null);
    }
  }

  async function handleRefresh(id: string) {
    setFeedback(null);
    await apiFetch(`/social/accounts/${id}/refresh`, { method: 'POST' });
    setFeedback('Access token refreshed and synced.');
    queryClient.invalidateQueries({ queryKey: ['social-oauth-accounts'] });
  }

  async function handleDisconnect(id: string) {
    setFeedback(null);
    await apiFetch(`/social/accounts/${id}`, { method: 'DELETE' });
    setFeedback('Account disconnected and access token revoked.');
    queryClient.invalidateQueries({ queryKey: ['social-oauth-accounts'] });
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-sm text-emerald-950">
        <Shield className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Official Permission-Based Integration</p>
          <p className="text-xs text-emerald-800 mt-0.5">
            Amplyra uses OAuth scopes and AES-256-GCM encrypted token storage. We never ask for or store your social media passwords.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-slate-900 text-white text-sm">
          {feedback}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {SUPPORTED_PLATFORMS.map((item) => {
          const connected = accounts.find((a) => a.platform === item.platform);
          return (
            <div
              key={item.platform}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">{item.label}</h3>
                  {connected && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">{item.description}</p>
              </div>

              {connected ? (
                <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">
                      @{connected.accountHandle}
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      Scopes: {connected.scopes.join(', ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRefresh(connected.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refresh
                    </button>
                    <button
                      onClick={() => handleDisconnect(connected.id)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-medium cursor-pointer"
                    >
                      <Unplug className="h-3.5 w-3.5" />
                      Revoke
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <input
                    value={handleInput[item.platform] || ''}
                    onChange={(e) =>
                      setHandleInput((prev) => ({
                        ...prev,
                        [item.platform]: e.target.value,
                      }))
                    }
                    placeholder="Account handle (optional)"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                  <button
                    onClick={() => handleConnect(item.platform)}
                    disabled={busyPlatform === item.platform}
                    className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                  >
                    {busyPlatform === item.platform
                      ? 'Connecting...'
                      : `Connect ${item.platform}`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isLoading && accounts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h4 className="font-semibold text-sm text-slate-900 mb-3">
            Authorized Connections ({accounts.length})
          </h4>
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-wrap justify-between gap-2"
              >
                <span>
                  <strong>{acc.platform}</strong> • @{acc.accountHandle} ({acc.status})
                </span>
                <span className="text-slate-500">
                  Expires:{' '}
                  {acc.tokenExpiresAt
                    ? new Date(acc.tokenExpiresAt).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
