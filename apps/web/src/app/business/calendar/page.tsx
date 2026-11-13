'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ContentCalendarStatus, SocialPlatform } from '@amplyra/shared';
import { FormEvent, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { BUSINESS_NAV } from '@/components/nav-configs';
import { apiFetch } from '@/lib/api';

interface CalendarItem {
  id: string;
  title: string;
  platform: SocialPlatform;
  caption: string;
  scheduledFor: string;
  status: ContentCalendarStatus;
}

export default function ContentCalendarPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<SocialPlatform>(SocialPlatform.INSTAGRAM);
  const [caption, setCaption] = useState('');
  const [scheduledFor, setScheduledFor] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  );
  const [error, setError] = useState<string | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ['content-calendar'],
    queryFn: () => apiFetch<CalendarItem[]>('/content-calendar'),
  });

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/content-calendar', {
        method: 'POST',
        body: JSON.stringify({
          title,
          platform,
          caption,
          scheduledFor: new Date(scheduledFor).toISOString(),
        }),
      });
      setTitle('');
      setCaption('');
      queryClient.invalidateQueries({ queryKey: ['content-calendar'] });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function updateStatus(id: string, status: ContentCalendarStatus) {
    setError(null);
    try {
      await apiFetch(`/content-calendar/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      queryClient.invalidateQueries({ queryKey: ['content-calendar'] });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <DashboardShell
      title="AI Content Calendar"
      roleLabel="Business Workspace"
      navItems={BUSINESS_NAV}
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {error}
          </div>
        )}

        <form
          onSubmit={handleCreate}
          className="bg-white rounded-2xl border border-slate-200 p-6 grid gap-4 sm:grid-cols-3"
        >
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value={SocialPlatform.INSTAGRAM}>Instagram</option>
            <option value={SocialPlatform.TIKTOK}>TikTok</option>
            <option value={SocialPlatform.FACEBOOK}>Facebook</option>
          </select>
          <input
            type="datetime-local"
            required
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <textarea
            required
            rows={2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption & creative notes..."
            className="sm:col-span-3 px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <button
            type="submit"
            className="sm:col-span-3 w-fit px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold cursor-pointer"
          >
            Add Scheduled Post
          </button>
        </form>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-start justify-between gap-4"
            >
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-emerald-700">{item.platform}</span>
                  <span className="text-slate-500">
                    {new Date(item.scheduledFor).toLocaleString()}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                    {item.status}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 mt-1">{item.title}</h3>
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">
                  {item.caption}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                {item.status === ContentCalendarStatus.DRAFT && (
                  <button
                    onClick={() =>
                      updateStatus(item.id, ContentCalendarStatus.APPROVED)
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                  >
                    Approve
                  </button>
                )}
                {item.status === ContentCalendarStatus.APPROVED && (
                  <button
                    onClick={() =>
                      updateStatus(item.id, ContentCalendarStatus.PUBLISHED)
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer"
                  >
                    Mark Published
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
