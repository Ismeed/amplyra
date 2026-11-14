import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CampaignStatus,
  CreatorTier,
  SocialPlatform,
  assertCampaignTransition,
  calculatePlatformFeeSplit,
  canCreatorAccessTier,
  canTransitionCampaignStatus,
  computeCreatorTier,
  computeEngagementMetrics,
  formatNgnFromKobo,
  getCreatorTierDefinition,
  inferTierFromBudgetKobo,
  koboToNaira,
  nairaToKobo,
  parseSocialPostUrl,
} from '../index';

test('campaign lifecycle allows valid progression and rejects invalid jumps', () => {
  assert.equal(
    canTransitionCampaignStatus(CampaignStatus.DRAFT, CampaignStatus.APPLICATIONS_OPEN),
    true,
  );
  assert.equal(
    canTransitionCampaignStatus(CampaignStatus.DRAFT, CampaignStatus.PAYMENT_RELEASED),
    false,
  );
  assert.throws(
    () => assertCampaignTransition(CampaignStatus.PAYMENT_RELEASED, CampaignStatus.DRAFT),
    /Invalid campaign status transition/,
  );
});

test('parseSocialPostUrl detects Instagram, TikTok, and Facebook post IDs', () => {
  const ig = parseSocialPostUrl('https://www.instagram.com/reel/Cx123AbCdEf/?igsh=abc');
  assert.equal(ig.platform, SocialPlatform.INSTAGRAM);
  assert.equal(ig.platformPostId, 'Cx123AbCdEf');

  const tt = parseSocialPostUrl('https://www.tiktok.com/@creator/video/7345678901234567890');
  assert.equal(tt.platform, SocialPlatform.TIKTOK);
  assert.equal(tt.platformPostId, '7345678901234567890');

  const fb = parseSocialPostUrl('https://facebook.com/brandpage/posts/987654321');
  assert.equal(fb.platform, SocialPlatform.FACEBOOK);
  assert.equal(fb.platformPostId, '987654321');

  assert.throws(() => parseSocialPostUrl('not-a-url'), /Invalid post URL/);
  assert.throws(() => parseSocialPostUrl('https://example.com/post/1'), /Unsupported social platform/);
});

test('currency helpers convert between Naira and kobo accurately', () => {
  assert.equal(nairaToKobo(50000), 5_000_000);
  assert.equal(koboToNaira(5_000_000), 50_000);
  assert.match(formatNgnFromKobo(5_000_000), /50,000/);
});

test('computeEngagementMetrics avoids fabricating missing denominators and labels calculations', () => {
  const withViews = computeEngagementMetrics({
    views: 10000,
    likes: 500,
    comments: 50,
    shares: 30,
    saves: 20,
    campaignCostKobo: 5_000_000,
  });
  assert.equal(withViews.totalEngagements, 600);
  assert.equal(withViews.engagementRateByViewsPct, 6);
  assert.equal(withViews.engagementRateByReachPct, null);
  assert.equal(withViews.costPerViewKobo, 500);
  assert.equal(withViews.costPerEngagementKobo, 8333);

  const withoutViews = computeEngagementMetrics({
    likes: 100,
    campaignCostKobo: 1_000_000,
  });
  assert.equal(withoutViews.engagementRateByViewsPct, null);
  assert.equal(withoutViews.costPerViewKobo, null);
});

test('calculatePlatformFeeSplit computes 10% platform fee and net creator payout in kobo', () => {
  const split = calculatePlatformFeeSplit(5_000_000);
  assert.equal(split.platformFeeKobo, 500_000);
  assert.equal(split.creatorNetKobo, 4_500_000);
});

test('computeCreatorTier classifies creators deterministically and prioritizes AI history', () => {
  const starter = computeCreatorTier({ maxFollowers: 4500, profileAvgEngagementPct: 5.0 });
  assert.equal(starter.tier, CreatorTier.TIER_1);
  assert.equal(starter.fixedPriceKobo, 1_500_000);

  const rising = computeCreatorTier({ maxFollowers: 15000, profileAvgEngagementPct: 3.1 });
  assert.equal(rising.tier, CreatorTier.TIER_2);
  assert.equal(rising.fixedPriceKobo, 2_500_000);

  const growth = computeCreatorTier({
    maxFollowers: 41200,
    profileAvgEngagementPct: 6.1,
    overallAvgEngagementPct: 5.2,
    completedDealsCount: 2,
  });
  assert.equal(growth.tier, CreatorTier.TIER_3);
  assert.equal(growth.fixedPriceKobo, 5_000_000);
  assert.equal(growth.basedOnAiHistory, true);
  assert.equal(growth.effectiveEngagementPct, 5.2);

  // High followers but poor post-deal AI engagement drops eligibility down from Tier 4/3
  const downgraded = computeCreatorTier({
    maxFollowers: 89000,
    profileAvgEngagementPct: 6.0,
    overallAvgEngagementPct: 1.9,
    completedDealsCount: 3,
  });
  assert.equal(downgraded.tier, CreatorTier.TIER_1);

  assert.equal(canCreatorAccessTier(CreatorTier.TIER_3, CreatorTier.TIER_2), true);
  assert.equal(canCreatorAccessTier(CreatorTier.TIER_1, CreatorTier.TIER_3), false);
  assert.equal(inferTierFromBudgetKobo(5_000_000).tier, CreatorTier.TIER_3);
  assert.equal(getCreatorTierDefinition(CreatorTier.TIER_4).fixedPriceKobo, 8_500_000);
});
