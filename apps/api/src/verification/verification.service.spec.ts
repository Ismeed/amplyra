import {
  CampaignStatus,
  MetricSourceType,
  ReportStatus,
  SocialPlatform,
  StoragePurpose,
  UploadedFileStatus,
  VerificationStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { TokenCryptoService } from '../common/crypto/token-crypto.service';
import { VerificationService } from './verification.service';

describe('VerificationService & TokenCryptoService', () => {
  it('encrypts and decrypts social tokens cleanly at rest', () => {
    const cryptoService = new TokenCryptoService(
      new ConfigService({ SOCIAL_TOKEN_SECRET: 'super-secret-dev-key-123456' }),
    );
    const token = 'ig_live_token_abc123xyz';
    const encrypted = cryptoService.encrypt(token);
    expect(encrypted).not.toContain(token);
    expect(cryptoService.decrypt(encrypted)).toBe(token);
  });

  it('marks creator-submitted screenshot metrics as CREATOR_EVIDENCE, never API_VERIFIED', async () => {
    const mockPrisma: any = {
      creator: { findUnique: jest.fn().mockResolvedValue({ id: 'cr-1', displayName: 'Zainab' }) },
      campaignPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'post-1',
          campaignId: 'camp-1',
          creatorId: 'cr-1',
          platform: SocialPlatform.INSTAGRAM,
          verificationStatus: VerificationStatus.PENDING_VERIFICATION,
          campaign: {
            id: 'camp-1',
            title: 'Harmattan',
            status: CampaignStatus.PUBLISHED_ON_SOCIAL,
            business: { ownerUserId: 'biz-user-1' },
          },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      campaignReport: {
        upsert: jest.fn().mockResolvedValue({
          id: 'rep-1',
          status: ReportStatus.SUBMITTED_EVIDENCE,
        }),
      },
      metricSnapshot: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'snap-1',
          ...data,
        })),
      },
      campaign: { update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
    };

    const service = new VerificationService(
      mockPrisma,
      {} as any,
      { create: jest.fn().mockResolvedValue({}) } as any,
    );

    const res = await service.submitCreatorEvidenceReport('user-cr-1', 'camp-1', {
      postId: 'post-1',
      milestoneDay: 5,
      views: 8200,
      likes: 640,
      notes: 'Day 5 creator analytics screenshot',
    });

    expect(res.snapshot.metricSource).toBe(MetricSourceType.creator_evidence);
    expect(mockPrisma.campaignPost.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { verificationStatus: VerificationStatus.CREATOR_EVIDENCE },
    });
  });

  it('links Supabase Storage evidenceFileId to CampaignReport and keeps CREATOR_EVIDENCE tag', async () => {
    const mockPrisma: any = {
      creator: { findUnique: jest.fn().mockResolvedValue({ id: 'cr-1', displayName: 'Zainab' }) },
      campaignPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'post-1',
          campaignId: 'camp-1',
          creatorId: 'cr-1',
          platform: SocialPlatform.INSTAGRAM,
          verificationStatus: VerificationStatus.PENDING_VERIFICATION,
          campaign: {
            id: 'camp-1',
            title: 'Harmattan',
            status: CampaignStatus.ACTIVE_REPORTING,
            business: { ownerUserId: 'biz-user-1' },
          },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      uploadedFile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'file-ev-1',
          ownerUserId: 'user-cr-1',
          purpose: StoragePurpose.EVIDENCE_SCREENSHOT,
          bucket: 'amplyra-private',
          objectPath: 'evidence-screenshots/user-cr-1/img.png',
          campaignId: 'camp-1',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      campaignReport: {
        upsert: jest.fn().mockImplementation(async ({ create }: any) => ({
          id: 'rep-2',
          ...create,
        })),
      },
      metricSnapshot: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'snap-2',
          ...data,
        })),
      },
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
    };

    const service = new VerificationService(
      mockPrisma,
      {} as any,
      { create: jest.fn().mockResolvedValue({}) } as any,
    );

    const res = await service.submitCreatorEvidenceReport('user-cr-1', 'camp-1', {
      postId: 'post-1',
      milestoneDay: 5,
      evidenceFileId: 'file-ev-1',
    });

    expect(res.report.evidenceImageUrl).toBe(
      'supabase://amplyra-private/evidence-screenshots/user-cr-1/img.png',
    );
    expect(mockPrisma.uploadedFile.update).toHaveBeenCalledWith({
      where: { id: 'file-ev-1' },
      data: {
        campaignId: 'camp-1',
        reportId: 'rep-2',
        status: UploadedFileStatus.READY,
      },
    });
  });

  it('averages overall post insight data after deal completion and recalculates Creator Tier', async () => {
    const mockPrisma: any = {
      creator: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cr-1',
          userId: 'user-cr-1',
          tier: 'TIER_1',
          socialAccounts: [{ followersCount: 35000, avgEngagementRate: 2.0 }],
        }),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'cr-1',
          ...data,
        })),
      },
      campaignAssignment: {
        count: jest.fn().mockResolvedValue(2),
      },
      campaignPost: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'post-1',
            metricSnapshots: [
              { views: 10000, reach: null, likes: 400, comments: 50, shares: 30, saves: 20 },
            ],
          },
          {
            id: 'post-2',
            metricSnapshots: [
              { views: 20000, reach: null, likes: 600, comments: 100, shares: 60, saves: 40 },
            ],
          },
        ]),
      },
    };

    const mockNotifications = { create: jest.fn().mockResolvedValue({}) };
    const service = new VerificationService(
      mockPrisma,
      {} as any,
      mockNotifications as any,
    );

    const updated = await service.recalculateCreatorBenchmarkAndTier('cr-1');

    // post-1 ER = 500/10000 = 5.0%, post-2 ER = 800/20000 = 4.0% => overall avg = 4.5%, avg views = 15000
    // 35,000 followers + 4.5% ER qualifies for TIER_3 (30k+ & >= 4.0% ER -> ₦50,000 / 5_000_000 kobo)
    expect(updated?.overallAvgEngagement).toBe(4.5);
    expect(updated?.overallAvgViews).toBe(15000);
    expect(updated?.completedDealsCount).toBe(2);
    expect(updated?.tier).toBe('TIER_3');
    expect(updated?.fixedPriceKobo).toBe(5_000_000);
    expect(mockNotifications.create).toHaveBeenCalledTimes(1);
  });
});
