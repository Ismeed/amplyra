import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContentCalendarStatus } from '@amplyra/shared';
import { MetricSourceType, SocialPlatform, VerificationStatus } from '@prisma/client';
import { AiProviderService } from './ai-provider.service';
import { AiService } from './ai.service';

describe('AiService', () => {
  const createService = (prismaOverrides: Record<string, unknown> = {}) => {
    const mockPrisma: any = {
      business: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'biz-1',
          ownerUserId: 'user-biz-1',
          name: 'Katsina Threadz',
          industry: 'Fashion & Textiles',
          country: 'Nigeria',
          state: 'Katsina',
          city: 'Katsina',
          brandTone: 'Warm and proud of northern craftsmanship',
          monthlyBudgetKobo: 25_000_000,
        }),
      },
      campaign: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      contentCalendarItem: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      ...prismaOverrides,
    };

    const aiProvider = new AiProviderService(new ConfigService({}));
    return {
      service: new AiService(mockPrisma, aiProvider),
      mockPrisma,
    };
  };

  it('askAnalyst does not invent metrics when campaigns or snapshots are missing', async () => {
    const { service: emptySvc } = createService();
    const noCampaigns = await emptySvc.askAnalyst('user-biz-1', {
      question: 'Which posts performed best this month?',
    });
    expect(noCampaigns.answer).toContain('No campaigns exist yet');
    expect(noCampaigns.dataBasis).toEqual({
      campaignsAnalyzed: 0,
      postsObserved: 0,
    });

    const { service: missingSnapSvc } = createService({
      campaign: {
        findMany: jest.fn().mockResolvedValue([
          {
            title: 'Harmattan Launch',
            status: 'PUBLISHED_ON_SOCIAL',
            budgetKobo: 15_000_000,
            posts: [
              {
                creator: { displayName: 'Zainab Styles' },
                platform: SocialPlatform.INSTAGRAM,
                verificationStatus: VerificationStatus.PENDING_VERIFICATION,
                metricSnapshots: [],
              },
            ],
            funding: null,
          },
        ]),
      },
    });

    const res = await missingSnapSvc.askAnalyst('user-biz-1', {
      question: 'Which creator generated the best results?',
    });
    expect(res.answer).toContain('0 metric snapshots have been recorded yet');
    expect(res.dataBasis).toEqual({
      campaignsAnalyzed: 1,
      postsObserved: 1,
    });
  });

  it('askAnalyst grounds answers in observed snapshots and calls out missing snapshots', async () => {
    const { service } = createService({
      campaign: {
        findMany: jest.fn().mockResolvedValue([
          {
            title: 'Harmattan Launch',
            status: 'IN_PROGRESS',
            budgetKobo: 15_000_000,
            posts: [
              {
                creator: { displayName: 'Zainab Styles' },
                platform: SocialPlatform.INSTAGRAM,
                verificationStatus: VerificationStatus.CREATOR_EVIDENCE,
                metricSnapshots: [
                  {
                    metricSource: MetricSourceType.creator_evidence,
                    views: 8400,
                    likes: 520,
                    comments: 45,
                    shares: 30,
                    saves: 15,
                  },
                ],
              },
              {
                creator: { displayName: 'Musa Bello' },
                platform: SocialPlatform.TIKTOK,
                verificationStatus: VerificationStatus.PENDING_VERIFICATION,
                metricSnapshots: [],
              },
            ],
            funding: null,
          },
        ]),
      },
    });

    const res = await service.askAnalyst('user-biz-1', {
      question: 'Which creator generated the best results?',
    });
    expect(res.answer).toContain('Zainab Styles');
    expect(res.answer).toContain('610 recorded engagements');
    expect(res.answer).toContain('[source: creator_evidence]');
    expect(res.answer).toContain('1 submitted post(s) still have missing metric snapshots');
  });

  it('updateCalendarItem enforces approval before marking as PUBLISHED', async () => {
    const { service, mockPrisma } = createService({
      contentCalendarItem: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'cal-1',
            businessId: 'biz-1',
            status: ContentCalendarStatus.DRAFT,
          })
          .mockResolvedValueOnce({
            id: 'cal-1',
            businessId: 'biz-1',
            status: ContentCalendarStatus.APPROVED,
          }),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'cal-1',
          ...data,
        })),
      },
    });

    await expect(
      service.updateCalendarItem('user-biz-1', 'cal-1', {
        status: ContentCalendarStatus.PUBLISHED,
      }),
    ).rejects.toThrow(BadRequestException);

    const published = await service.updateCalendarItem('user-biz-1', 'cal-1', {
      status: ContentCalendarStatus.PUBLISHED,
    });
    expect(mockPrisma.contentCalendarItem.update).toHaveBeenCalledTimes(1);
    expect(published.status).toBe(ContentCalendarStatus.PUBLISHED);
    expect(published.publishedAt).toBeInstanceOf(Date);
  });
});
