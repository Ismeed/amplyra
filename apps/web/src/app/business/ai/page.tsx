'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { nairaToKobo } from '@amplyra/shared';
import { Sparkles } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { BUSINESS_NAV } from '@/components/nav-configs';
import { apiFetch } from '@/lib/api';

interface StrategyRecord {
  id: string;
  objective: string;
  budgetKobo: number | null;
  providerUsed: string;
  createdAt: string;
  strategyJson: {
    summary?: string;
    targetSegments?: string[];
    channelMix?: Array<{
      channel: string;
      allocationPct: number;
      estimatedBudget: string;
      rationale: string;
    }>;
    campaignConcepts?: string[];
    kpisToTrack?: string[];
  };
}

interface RecommendationItem {
  category: string;
  title: string;
  explanation: string;
  evidenceStatus: string;
}

export default function BusinessAiWorkspacePage() {
  const queryClient = useQueryClient();
  const [objective, setObjective] = useState(
    'Increase showroom visits and WhatsApp orders in Northern Nigeria',
  );
  const [budgetNaira, setBudgetNaira] = useState('150000');
  const [focusRegion, setFocusRegion] = useState('');
  const [generating, setGenerating] = useState(false);

  const [question, setQuestion] = useState(
    'Which creator or campaign performed best so far, and what metrics are still missing?',
  );
  const [analystReply, setAnalystReply] = useState<{
    answer: string;
    providerUsed: string;
    dataBasis: { campaignsAnalyzed: number; postsObserved: number };
  } | null>(null);
  const [asking, setAsking] = useState(false);

  const { data: strategies = [] } = useQuery({
    queryKey: ['ai-strategies'],
    queryFn: () => apiFetch<StrategyRecord[]>('/ai/strategies'),
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['ai-recommendations'],
    queryFn: () => apiFetch<RecommendationItem[]>('/ai/recommendations'),
  });

  async function handleGenerateStrategy(e: FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      await apiFetch('/ai/strategy', {
        method: 'POST',
        body: JSON.stringify({
          objective,
          budgetKobo: budgetNaira ? nairaToKobo(Number(budgetNaira)) : undefined,
          focusRegion: focusRegion || undefined,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['ai-strategies'] });
    } finally {
      setGenerating(false);
    }
  }

  async function handleAskAnalyst(e: FormEvent) {
    e.preventDefault();
    setAsking(true);
    try {
      const res = await apiFetch<{
        answer: string;
        providerUsed: string;
        dataBasis: { campaignsAnalyzed: number; postsObserved: number };
      }>('/ai/analyst', {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
      setAnalystReply(res);
    } finally {
      setAsking(false);
    }
  }

  return (
    <DashboardShell
      title="AI Marketing Strategist & Analyst"
      roleLabel="Business Workspace"
      navItems={BUSINESS_NAV}
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleGenerateStrategy}
            className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
              <Sparkles className="h-4 w-4" />
              AI Marketing Strategist
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Primary Marketing Objective
              </label>
              <textarea
                required
                rows={2}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Budget (NGN)
                </label>
                <input
                  type="number"
                  min={0}
                  value={budgetNaira}
                  onChange={(e) => setBudgetNaira(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Focus Region (optional)
                </label>
                <input
                  value={focusRegion}
                  onChange={(e) => setFocusRegion(e.target.value)}
                  placeholder="e.g. Katsina, Abuja"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={generating}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
            >
              {generating ? 'Generating Strategy...' : 'Generate Marketing Strategy'}
            </button>
          </form>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="font-bold text-slate-900 text-sm">
              AI Marketing Analyst (Grounded in Real Campaign Data)
            </h2>
            <form onSubmit={handleAskAnalyst} className="space-y-3">
              <textarea
                required
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
              <button
                type="submit"
                disabled={asking}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer"
              >
                {asking ? 'Analyzing...' : 'Ask Analyst'}
              </button>
            </form>
            {analystReply && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm space-y-2">
                <p className="text-slate-800 whitespace-pre-wrap">{analystReply.answer}</p>
                <p className="text-[11px] text-slate-500">
                  Basis: {analystReply.dataBasis.campaignsAnalyzed} campaigns,{' '}
                  {analystReply.dataBasis.postsObserved} submitted posts •{' '}
                  {analystReply.providerUsed}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h2 className="font-bold text-slate-900 text-base">
            Marketing Intelligence Recommendations
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/70"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-emerald-700">{rec.category}</span>
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                    {rec.evidenceStatus}
                  </span>
                </div>
                <p className="font-semibold text-sm text-slate-900 mt-1">{rec.title}</p>
                <p className="text-xs text-slate-600 mt-1">{rec.explanation}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-bold text-slate-900 text-base">
            Saved Strategies ({strategies.length})
          </h2>
          {strategies.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900">{s.objective}</h3>
                  <p className="text-xs text-slate-500">
                    Generated via {s.providerUsed} •{' '}
                    {new Date(s.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {s.strategyJson.summary && (
                <p className="text-sm text-slate-700">{s.strategyJson.summary}</p>
              )}
              {s.strategyJson.channelMix && s.strategyJson.channelMix.length > 0 && (
                <div className="grid gap-3 md:grid-cols-3">
                  {s.strategyJson.channelMix.map((ch, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <p className="font-bold text-slate-900">
                        {ch.channel} ({ch.allocationPct}%)
                      </p>
                      <p className="text-emerald-700 font-semibold mt-0.5">
                        {ch.estimatedBudget}
                      </p>
                      <p className="text-slate-600 mt-1">{ch.rationale}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
