'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StoragePurpose, formatNgnFromKobo } from '@amplyra/shared';
import { ChangeEvent, FormEvent, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { CREATOR_NAV } from '@/components/nav-configs';
import { apiFetch } from '@/lib/api';
import { uploadToSupabaseStorage } from '@/lib/storage';

interface CreatorWorkResponse {
  applications: Array<{
    id: string;
    status: string;
    type: string;
    campaign: {
      id: string;
      title: string;
      status: string;
      budgetKobo: number;
      business: { name: string };
    };
  }>;
  assignments: Array<{
    id: string;
    agreedRateKobo: number;
    acceptedAt: string | null;
    campaign: {
      id: string;
      title: string;
      status: string;
      retentionDays: number;
      business: { name: string };
    };
    posts: Array<{
      id: string;
      platform: string;
      postUrl: string;
      platformPostId?: string | null;
      verificationStatus: string;
      retentionUntil: string;
    }>;
  }>;
}

export default function CreatorWorkPage() {
  const queryClient = useQueryClient();
  const [postUrlByCampaign, setPostUrlByCampaign] = useState<Record<string, string>>({});
  const [captionByCampaign, setCaptionByCampaign] = useState<Record<string, string>>({});
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [reportCampaignId, setReportCampaignId] = useState<string | null>(null);
  const [milestoneDay, setMilestoneDay] = useState('5');
  const [views, setViews] = useState('');
  const [likes, setLikes] = useState('');
  const [comments, setComments] = useState('');
  const [shares, setShares] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [evidenceFileId, setEvidenceFileId] = useState<string | null>(null);
  const [evidenceFileName, setEvidenceFileName] = useState<string | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['creator-work'],
    queryFn: () => apiFetch<CreatorWorkResponse>('/campaigns/creator/my-work'),
  });

  async function acceptCampaign(campaignId: string) {
    setFeedback(null);
    await apiFetch(`/campaigns/${campaignId}/accept`, { method: 'POST' });
    setFeedback('Campaign assignment accepted! You can now submit your published post URL.');
    queryClient.invalidateQueries({ queryKey: ['creator-work'] });
  }

  async function submitPostUrl(e: FormEvent, campaignId: string) {
    e.preventDefault();
    setFeedback(null);
    try {
      await apiFetch(`/campaigns/${campaignId}/posts`, {
        method: 'POST',
        body: JSON.stringify({
          postUrl: postUrlByCampaign[campaignId],
          caption: captionByCampaign[campaignId] || undefined,
        }),
      });
      setPostUrlByCampaign((prev) => ({ ...prev, [campaignId]: '' }));
      setCaptionByCampaign((prev) => ({ ...prev, [campaignId]: '' }));
      setFeedback(
        'Post URL submitted! 5-day reporting schedule (Day 0, 5, 10, 15) created.',
      );
      queryClient.invalidateQueries({ queryKey: ['creator-work'] });
    } catch (err) {
      setFeedback((err as Error).message);
    }
  }

  async function handleEvidenceFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !reportCampaignId) return;
    setUploadingEvidence(true);
    setUploadError(null);
    try {
      const uploaded = await uploadToSupabaseStorage({
        file,
        purpose: StoragePurpose.EVIDENCE_SCREENSHOT,
        campaignId: reportCampaignId,
      });
      setEvidenceFileId(uploaded.fileId);
      setEvidenceFileName(uploaded.originalName);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploadingEvidence(false);
    }
  }

  async function submitEvidenceReport(e: FormEvent) {
    e.preventDefault();
    if (!reportPostId || !reportCampaignId) return;
    setFeedback(null);
    try {
      await apiFetch(`/campaigns/${reportCampaignId}/reports`, {
        method: 'POST',
        body: JSON.stringify({
          postId: reportPostId,
          milestoneDay: Number(milestoneDay),
          views: views ? Number(views) : undefined,
          likes: likes ? Number(likes) : undefined,
          comments: comments ? Number(comments) : undefined,
          shares: shares ? Number(shares) : undefined,
          notes: reportNotes || undefined,
          evidenceFileId: evidenceFileId || undefined,
        }),
      });
      setFeedback(
        `Day ${milestoneDay} creator-submitted evidence report recorded.`,
      );
      setReportPostId(null);
      setReportCampaignId(null);
      setViews('');
      setLikes('');
      setComments('');
      setShares('');
      setReportNotes('');
      setEvidenceFileId(null);
      setEvidenceFileName(null);
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ['creator-work'] });
    } catch (err) {
      setFeedback((err as Error).message);
    }
  }

  return (
    <DashboardShell
      title="My Work & 5-Day Reports"
      roleLabel="Creator Workspace"
      navItems={CREATOR_NAV}
    >
      <div className="space-y-6">
        {feedback && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
            {feedback}
          </div>
        )}

        {isLoading || !data ? (
          <p className="text-sm text-slate-500">Loading your campaign work...</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-slate-900">
                Applications & Invitations ({data.applications.length})
              </h2>
              {data.applications.length === 0 ? (
                <p className="text-sm text-slate-500">No applications or invitations yet.</p>
              ) : (
                data.applications.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 rounded-xl border border-slate-200 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-emerald-700 font-semibold">
                          {app.campaign.business.name}
                        </p>
                        <p className="font-semibold text-sm text-slate-900">
                          {app.campaign.title}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {app.type} • {app.status}
                      </span>
                    </div>
                    {(app.status === 'INVITED' || app.status === 'APPROVED') && (
                      <button
                        onClick={() => acceptCampaign(app.campaign.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Accept Assignment
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <h2 className="font-bold text-slate-900">
                Active Assignments, Posts & 5-Day Reports ({data.assignments.length})
              </h2>
              {data.assignments.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Once a business approves your application or you accept an invitation, your deliverable workspace appears here.
                </p>
              ) : (
                data.assignments.map((assign) => (
                  <div
                    key={assign.id}
                    className="p-4 rounded-xl border border-slate-200 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-emerald-700">
                          {assign.campaign.business.name}
                        </p>
                        <p className="font-bold text-sm text-slate-900">
                          {assign.campaign.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          Agreed rate: {formatNgnFromKobo(assign.agreedRateKobo)} •{' '}
                          {assign.campaign.retentionDays}d retention
                        </p>
                      </div>
                      {!assign.acceptedAt ? (
                        <button
                          onClick={() => acceptCampaign(assign.campaign.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          Accept Assignment
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Accepted
                        </span>
                      )}
                    </div>

                    {assign.posts.length > 0 && (
                      <div className="space-y-2">
                        {assign.posts.map((post) => (
                          <div
                            key={post.id}
                            className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5"
                          >
                            <div className="flex justify-between font-medium">
                              <span>
                                {post.platform}
                                {post.platformPostId ? ` • ID ${post.platformPostId}` : ''}
                              </span>
                              <span className="text-amber-700">{post.verificationStatus}</span>
                            </div>
                            <a
                              href={post.postUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:underline break-all block"
                            >
                              {post.postUrl}
                            </a>
                            <button
                              onClick={() => {
                                setReportPostId(post.id);
                                setReportCampaignId(assign.campaign.id);
                              }}
                              className="px-2.5 py-1 rounded bg-slate-900 text-white font-semibold cursor-pointer"
                            >
                              Submit 5-Day Evidence Report
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <form
                      onSubmit={(e) => submitPostUrl(e, assign.campaign.id)}
                      className="space-y-2 pt-2 border-t border-slate-100"
                    >
                      <label className="block text-xs font-medium text-slate-700">
                        Submit Public Post URL
                      </label>
                      <input
                        type="url"
                        required
                        value={postUrlByCampaign[assign.campaign.id] || ''}
                        onChange={(e) =>
                          setPostUrlByCampaign((prev) => ({
                            ...prev,
                            [assign.campaign.id]: e.target.value,
                          }))
                        }
                        placeholder="https://www.instagram.com/reel/..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                      />
                      <input
                        value={captionByCampaign[assign.campaign.id] || ''}
                        onChange={(e) =>
                          setCaptionByCampaign((prev) => ({
                            ...prev,
                            [assign.campaign.id]: e.target.value,
                          }))
                        }
                        placeholder="Optional deliverable note or caption"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        Submit Post URL
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {reportPostId && (
          <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center p-4 z-40">
            <form
              onSubmit={submitEvidenceReport}
              className="bg-white rounded-2xl max-w-md w-full p-6 space-y-3"
            >
              <h3 className="text-base font-bold text-slate-900">
                Submit Creator Analytics Evidence
              </h3>
              <p className="text-xs text-slate-500">
                These figures are explicitly tagged as creator-submitted evidence (never misrepresented as API-verified).
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reporting Milestone
                </label>
                <select
                  value={milestoneDay}
                  onChange={(e) => setMilestoneDay(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="0">Day 0 (Publication Baseline)</option>
                  <option value="5">Day 5</option>
                  <option value="10">Day 10</option>
                  <option value="15">Day 15 (Final)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={views}
                  onChange={(e) => setViews(e.target.value)}
                  placeholder="Views"
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={likes}
                  onChange={(e) => setLikes(e.target.value)}
                  placeholder="Likes"
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Comments"
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  placeholder="Shares"
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <textarea
                rows={2}
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="Notes or analytics screenshot reference..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Analytics Screenshot (Private Supabase Storage)
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleEvidenceFileChange}
                  disabled={uploadingEvidence}
                  className="block w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:bg-slate-900 file:text-white file:text-xs"
                />
                {uploadingEvidence && (
                  <p className="text-[11px] text-slate-500">
                    Uploading screenshot to secure storage...
                  </p>
                )}
                {evidenceFileName && (
                  <p className="text-[11px] text-emerald-700 font-medium">
                    Attached: {evidenceFileName}
                  </p>
                )}
                {uploadError && (
                  <p className="text-[11px] text-rose-600">{uploadError}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setReportPostId(null);
                    setEvidenceFileId(null);
                    setEvidenceFileName(null);
                    setUploadError(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingEvidence}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  Submit Evidence Report
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
