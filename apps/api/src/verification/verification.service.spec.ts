import {
  CampaignStatus,
  MetricSourceType,
  ReportStatus,
  SocialPlatform,
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
});
