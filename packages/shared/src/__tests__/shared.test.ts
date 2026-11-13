import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CampaignStatus,
  SocialPlatform,
  assertCampaignTransition,
  calculatePlatformFeeSplit,
  canTransitionCampaignStatus,
  computeEngagementMetrics,
  formatNgnFromKobo,
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
