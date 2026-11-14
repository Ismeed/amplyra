import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CampaignStatus, SocialPlatform, VerificationStatus } from '@prisma/client';
import { UserRole } from '@amplyra/shared';
import { CampaignsService } from './campaigns.service';

describe('CampaignsService', () => {
  const mockNotifications = {
    create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  };
  const mockVerification = {
    createScheduleForPost: jest.fn().mockResolvedValue([]),
  };

  function buildService(prismaOverrides: Record<string, any> = {}) {
    const mockPrisma: any = {
      business: { findUnique: jest.fn() },
      creator: { findUnique: jest.fn() },
      campaign: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      campaignApplication: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      campaignAssignment: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      campaignPost: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
      ...prismaOverrides,
    };

    const service = new CampaignsService(
      mockPrisma,
      mockNotifications as any,
      mockVerification as any,
    );
    return { service, mockPrisma };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes a DRAFT campaign to APPLICATIONS_OPEN for the owning business', async () => {
    const { service, mockPrisma } = buildService();
    mockPrisma.campaign.findUnique.mockResolvedValue({
      id: 'camp-1',
      status: CampaignStatus.DRAFT,
      business: { ownerUserId: 'user-biz-1' },
    });
    mockPrisma.campaign.update.mockResolvedValue({
      id: 'camp-1',
      status: CampaignStatus.APPLICATIONS_OPEN,
    });

    const result = await service.publish('user-biz-1', 'camp-1');

    expect(result.status).toBe(CampaignStatus.APPLICATIONS_OPEN);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CAMPAIGN_PUBLISHED',
          entityId: 'camp-1',
        }),
      }),
    );
  });

  it('rejects publishing a campaign owned by another business', async () => {
    const { service, mockPrisma } = buildService();
    mockPrisma.campaign.findUnique.mockResolvedValue({
      id: 'camp-1',
      status: CampaignStatus.DRAFT,
      business: { ownerUserId: 'user-biz-1' },
    });

    await expect(service.publish('user-biz-other', 'camp-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects invalid lifecycle transition when publishing a COMPLETED campaign', async () => {
    const { service, mockPrisma } = buildService();
    mockPrisma.campaign.findUnique.mockResolvedValue({
      id: 'camp-1',
      status: CampaignStatus.COMPLETED,
      business: { ownerUserId: 'user-biz-1' },
    });

    await expect(service.publish('user-biz-1', 'camp-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('detects platform & post ID when a creator submits a TikTok URL', async () => {
    const { service, mockPrisma } = buildService();
    mockPrisma.creator.findUnique.mockResolvedValue({
      id: 'creator-1',
      userId: 'user-creator-1',
      displayName: 'Zainab Styles',
    });
    mockPrisma.campaignAssignment.findUnique.mockResolvedValue({
      id: 'assign-1',
      campaignId: 'camp-1',
      creatorId: 'creator-1',
      campaign: {
        id: 'camp-1',
        title: 'Harmattan Drop',
        retentionDays: 15,
        status: CampaignStatus.CREATOR_ACCEPTED,
        business: { ownerUserId: 'user-biz-1' },
      },
    });
    mockPrisma.campaignPost.findUnique.mockResolvedValue(null);
    mockPrisma.campaignPost.create.mockImplementation(async ({ data }: any) => ({
      id: 'post-1',
      ...data,
    }));

    const post = await service.submitPost('user-creator-1', 'camp-1', {
      postUrl: 'https://www.tiktok.com/@zainabstyles/video/7399112233445566778',
      caption: 'Styled the new Harmattan linen kaftan',
    });

    expect(post.platform).toBe(SocialPlatform.TIKTOK);
    expect(post.platformPostId).toBe('7399112233445566778');
    expect(post.verificationStatus).toBe(VerificationStatus.PENDING_VERIFICATION);
    expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
      where: { id: 'camp-1' },
      data: { status: CampaignStatus.PUBLISHED_ON_SOCIAL },
    });
    expect(mockNotifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-biz-1',
      }),
    );
  });

  it('prevents a business from viewing another business campaign', async () => {
    const { service, mockPrisma } = buildService();
    mockPrisma.campaign.findUnique.mockResolvedValue({
      id: 'camp-1',
      status: CampaignStatus.APPLICATIONS_OPEN,
      business: { ownerUserId: 'user-biz-1' },
      applications: [],
      assignments: [],
      posts: [],
    });

    await expect(
      service.getById(
        {
          userId: 'user-biz-2',
          email: 'other@biz.ng',
          role: UserRole.BUSINESS,
          fullName: 'Other Biz',
        },
        'camp-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a TIER_1 creator applying to a TIER_3 advert and allows eligible creators at fixed Tier price', async () => {
    const { service, mockPrisma } = buildService();
    mockPrisma.creator.findUnique.mockResolvedValue({
      id: 'cr-1',
      userId: 'user-cr-1',
      displayName: 'Starter Voice',
      tier: 'TIER_1',
    });
    mockPrisma.campaign.findUnique.mockResolvedValue({
      id: 'camp-tier3',
      title: 'Kano Capsule Launch',
      status: CampaignStatus.APPLICATIONS_OPEN,
      targetTier: 'TIER_3',
      budgetKobo: 5_000_000,
      business: { ownerUserId: 'user-biz-1' },
    });

    await expect(
      service.apply('user-cr-1', 'camp-tier3', { pitch: 'Ready to post!' }),
    ).rejects.toThrow(ForbiddenException);

    mockPrisma.creator.findUnique.mockResolvedValue({
      id: 'cr-2',
      userId: 'user-cr-2',
      displayName: 'Zainab Styles',
      tier: 'TIER_3',
    });
    mockPrisma.campaignApplication.findUnique.mockResolvedValue(null);
    mockPrisma.campaignApplication.create.mockImplementation(async ({ data }: any) => ({
      id: 'app-1',
      ...data,
    }));

    const app = await service.apply('user-cr-2', 'camp-tier3', {
      pitch: 'Can deliver on TikTok & IG',
      proposedRateKobo: 9_999_999,
    });

    expect(app.proposedRateKobo).toBe(5_000_000);
  });
});
