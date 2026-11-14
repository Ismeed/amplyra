import { CreatorTier } from './enums';

export interface CreatorTierDefinition {
  tier: CreatorTier;
  rank: number;
  label: string;
  shortLabel: string;
  fixedPriceKobo: number;
  minFollowers: number;
  minEngagementPct: number;
  description: string;
}

export const CREATOR_TIER_DEFINITIONS: readonly CreatorTierDefinition[] = [
  {
    tier: CreatorTier.TIER_1,
    rank: 1,
    label: 'Tier 1 • Starter',
    shortLabel: 'Tier 1 (₦15k)',
    fixedPriceKobo: 1_500_000,
    minFollowers: 0,
    minEngagementPct: 0,
    description: 'Emerging local creators getting started (1k–10k audience).',
  },
  {
    tier: CreatorTier.TIER_2,
    rank: 2,
    label: 'Tier 2 • Rising',
    shortLabel: 'Tier 2 (₦25k)',
    fixedPriceKobo: 2_500_000,
    minFollowers: 10_000,
    minEngagementPct: 2.5,
    description: '10k+ followers and >= 2.5% engagement rate.',
  },
  {
    tier: CreatorTier.TIER_3,
    rank: 3,
    label: 'Tier 3 • Growth',
    shortLabel: 'Tier 3 (₦50k)',
    fixedPriceKobo: 5_000_000,
    minFollowers: 30_000,
    minEngagementPct: 4.0,
    description: '30k+ followers and >= 4.0% AI-verified post engagement.',
  },
  {
    tier: CreatorTier.TIER_4,
    rank: 4,
    label: 'Tier 4 • Pro',
    shortLabel: 'Tier 4 (₦85k)',
    fixedPriceKobo: 8_500_000,
    minFollowers: 60_000,
    minEngagementPct: 4.5,
    description: '60k+ followers and >= 4.5% AI-verified post engagement.',
  },
] as const;

const TIER_MAP = new Map<CreatorTier, CreatorTierDefinition>(
  CREATOR_TIER_DEFINITIONS.map((def) => [def.tier, def]),
);

export function getCreatorTierDefinition(
  tier: CreatorTier | string | null | undefined,
): CreatorTierDefinition {
  if (tier && TIER_MAP.has(tier as CreatorTier)) {
    return TIER_MAP.get(tier as CreatorTier)!;
  }
  return CREATOR_TIER_DEFINITIONS[0];
}

export interface ComputeCreatorTierInput {
  maxFollowers: number;
  profileAvgEngagementPct?: number | null;
  overallAvgEngagementPct?: number | null;
  completedDealsCount?: number;
}

export interface ComputedCreatorTierResult extends CreatorTierDefinition {
  maxFollowers: number;
  effectiveEngagementPct: number;
  basedOnAiHistory: boolean;
}

/**
 * Classifies a creator into a fixed-rate platform Tier based on peak followers
 * and engagement rate (preferring rolling AI insight averages once deals exist).
 */
export function computeCreatorTier(
  input: ComputeCreatorTierInput,
): ComputedCreatorTierResult {
  const maxFollowers = Math.max(0, Math.floor(input.maxFollowers || 0));
  const hasAiHistory =
    (input.completedDealsCount ?? 0) > 0 &&
    typeof input.overallAvgEngagementPct === 'number' &&
    Number.isFinite(input.overallAvgEngagementPct);

  const rawEngagement = hasAiHistory
    ? input.overallAvgEngagementPct!
    : typeof input.profileAvgEngagementPct === 'number' &&
        Number.isFinite(input.profileAvgEngagementPct)
      ? input.profileAvgEngagementPct
      : 0;

  const effectiveEngagementPct = Number(Math.max(0, rawEngagement).toFixed(2));

  let matched = CREATOR_TIER_DEFINITIONS[0];
  for (const candidate of CREATOR_TIER_DEFINITIONS) {
    if (
      maxFollowers >= candidate.minFollowers &&
      effectiveEngagementPct >= candidate.minEngagementPct
    ) {
      matched = candidate;
    }
  }

  return {
    ...matched,
    maxFollowers,
    effectiveEngagementPct,
    basedOnAiHistory: hasAiHistory,
  };
}

export function inferTierFromBudgetKobo(budgetKobo: number): CreatorTierDefinition {
  let matched = CREATOR_TIER_DEFINITIONS[0];
  for (const candidate of CREATOR_TIER_DEFINITIONS) {
    if (budgetKobo >= candidate.fixedPriceKobo) {
      matched = candidate;
    }
  }
  return matched;
}

export function canCreatorAccessTier(
  creatorTier: CreatorTier | string | null | undefined,
  requiredTier: CreatorTier | string | null | undefined,
): boolean {
  const creatorDef = getCreatorTierDefinition(creatorTier);
  const requiredDef = getCreatorTierDefinition(requiredTier);
  return creatorDef.rank >= requiredDef.rank;
}
