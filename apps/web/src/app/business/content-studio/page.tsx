'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AiContentType, SocialPlatform } from '@amplyra/shared';
import { FormEvent, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { BUSINESS_NAV } from '@/components/nav-configs';
import { apiFetch } from '@/lib/api';

interface GeneratedContentRecord {
  id: string;
  contentType: AiContentType;
  platform: SocialPlatform;
  promptSummary: string;
  outputText: string;
  brandToneUsed: string | null;
  createdAt: string;
}

export default function ContentStudioPage() {
  const queryClient = useQueryClient();
  const [contentType, setContentType] = useState<AiContentType>(AiContentType.CAPTION);
  const [platform, setPlatform] = useState<SocialPlatform>(SocialPlatform.INSTAGRAM);
  const [topic, setTopic] = useState('');
  const [callToAction, setCallToAction] = useState('');
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ['ai-content-history'],
    queryFn: () => apiFetch<GeneratedContentRecord[]>('/ai/content'),
  });

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setFeedback(null);
    try {
      await apiFetch('/ai/content', {
        method: 'POST',
        body: JSON.stringify({
          contentType,
          platform,
          topic,
          callToAction: callToAction || undefined,
        }),
      });
      setTopic('');
      queryClient.invalidateQueries({ queryKey: ['ai-content-history'] });
    } catch (err) {
      setFeedback((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function sendToCalendar(item: GeneratedContentRecord) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await apiFetch('/content-calendar', {
      method: 'POST',
      body: JSON.stringify({
        title: `${item.contentType}: ${item.promptSummary}`.slice(0, 80),
        platform: item.platform,
        caption: item.outputText,
        scheduledFor: tomorrow,
      }),
    });
    setFeedback('Saved draft to Content Calendar for tomorrow!');
    queryClient.invalidateQueries({ queryKey: ['content-calendar'] });
  }

  return (
    <DashboardShell
      title="AI Content Studio"
      roleLabel="Business Workspace"
      navItems={BUSINESS_NAV}
    >
      <div className="space-y-6">
        {feedback && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
            {feedback}
          </div>
        )}

        <form
          onSubmit={handleGenerate}
          className="bg-white rounded-2xl border border-slate-200 p-6 grid gap-4 sm:grid-cols-2"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Material Type
            </label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value as AiContentType)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value={AiContentType.CAPTION}>Social Caption</option>
              <option value={AiContentType.VIDEO_SCRIPT}>Short-Form Video Script</option>
              <option value={AiContentType.AD_COPY}>Advertising Copy</option>
              <option value={AiContentType.EMAIL_COPY}>Email Copy</option>
              <option value={AiContentType.SLOGAN}>Campaign Slogans</option>
              <option value={AiContentType.HASHTAGS}>Hashtag Pack</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Target Platform
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value={SocialPlatform.INSTAGRAM}>Instagram</option>
              <option value={SocialPlatform.TIKTOK}>TikTok</option>
              <option value={SocialPlatform.FACEBOOK}>Facebook</option>
              <option value={SocialPlatform.YOUTUBE}>YouTube</option>
              <option value={SocialPlatform.X}>X</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Campaign / Product Topic
            </label>
            <input
              required
              minLength={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. New Harmattan Linen Kaftan Capsule"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Call-to-Action (optional)
            </label>
            <input
              value={callToAction}
              onChange={(e) => setCallToAction(e.target.value)}
              placeholder="e.g. Visit our Katsina showroom or send a DM to order"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={generating}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
            >
              {generating ? 'Generating...' : 'Generate Brand Content'}
            </button>
          </div>
        </form>

        <div className="space-y-3">
          <h2 className="font-bold text-slate-900">Generated Content Library</h2>
          {history.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-emerald-700">
                  {item.contentType} • {item.platform}
                </span>
                <button
                  onClick={() => sendToCalendar(item)}
                  className="px-3 py-1 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer"
                >
                  Schedule in Calendar
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                {item.outputText}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
