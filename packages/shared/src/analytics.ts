export interface EngagementInput {
  views?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  campaignCostKobo?: number | null;
}

export interface ComputedEngagementMetrics {
  totalEngagements: number | null;
  engagementRateByViewsPct: number | null;
  engagementRateByReachPct: number | null;
  costPerViewKobo: number | null;
  costPerEngagementKobo: number | null;
  methodologyNotes: string[];
}

/**
 * Computes engagement and cost-efficiency metrics strictly when underlying
 * denominator values exist (Blueprint Section 8.5 & 10.5). Never conflates
 * view-based engagement with reach-based engagement.
 */
export function computeEngagementMetrics(
  input: EngagementInput,
): ComputedEngagementMetrics {
  const likes = input.likes ?? null;
  const comments = input.comments ?? null;
  const shares = input.shares ?? null;
  const saves = input.saves ?? null;

  const availableComponents = [likes, comments, shares, saves].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );

  const totalEngagements =
    availableComponents.length > 0
      ? availableComponents.reduce((sum, n) => sum + n, 0)
      : null;

  const views =
    typeof input.views === 'number' && input.views > 0 ? input.views : null;
  const reach =
    typeof input.reach === 'number' && input.reach > 0 ? input.reach : null;
  const cost =
    typeof input.campaignCostKobo === 'number' && input.campaignCostKobo > 0
      ? input.campaignCostKobo
      : null;

  const engagementRateByViewsPct =
    totalEngagements !== null && views !== null
      ? Number(((totalEngagements / views) * 100).toFixed(2))
      : null;

  const engagementRateByReachPct =
    totalEngagements !== null && reach !== null
      ? Number(((totalEngagements / reach) * 100).toFixed(2))
      : null;

  const costPerViewKobo =
    cost !== null && views !== null ? Math.round(cost / views) : null;

  const costPerEngagementKobo =
    cost !== null && totalEngagements !== null && totalEngagements > 0
      ? Math.round(cost / totalEngagements)
      : null;

  const methodologyNotes: string[] = [];
  if (engagementRateByViewsPct !== null) {
    methodologyNotes.push(
      'Engagement Rate by Views = ((Likes + Comments + Shares + Saves) / Views) * 100',
    );
  }
  if (engagementRateByReachPct !== null) {
    methodologyNotes.push(
      'Engagement Rate by Reach = ((Likes + Comments + Shares + Saves) / Reach) * 100',
    );
  }

  return {
    totalEngagements,
    engagementRateByViewsPct,
    engagementRateByReachPct,
    costPerViewKobo,
    costPerEngagementKobo,
    methodologyNotes,
  };
}

export function calculatePlatformFeeSplit(
  grossAmountKobo: number,
  feeRateBps = 1000, // 10.00% default hypothesis
): {
  grossAmountKobo: number;
  platformFeeKobo: number;
  creatorNetKobo: number;
  feeRateBps: number;
} {
  if (!Number.isInteger(grossAmountKobo) || grossAmountKobo <= 0) {
    throw new Error('Gross amount in kobo must be a positive integer');
  }
  const platformFeeKobo = Math.round((grossAmountKobo * feeRateBps) / 10_000);
  const creatorNetKobo = grossAmountKobo - platformFeeKobo;
  return {
    grossAmountKobo,
    platformFeeKobo,
    creatorNetKobo,
    feeRateBps,
  };
}
