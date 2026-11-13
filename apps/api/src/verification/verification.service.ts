import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignStatus,
  MetricSourceType,
  NotificationType,
  Prisma,
  ReportStatus,
  VerificationStatus,
} from '@prisma/client';
import {
  CampaignStatus as SharedCampaignStatus,
  SocialPlatform as SharedPlatform,
  UserRole,
  canTransitionCampaignStatus,
  computeEngagementMetrics,
} from '@amplyra/shared';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SocialService } from '../social/social.service';
import { FlagReportDto, SubmitCampaignReportDto } from './dto/verification.dto';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socialService: SocialService,
    private readonly notifications: NotificationsService,
  ) {}

  async createScheduleForPost(params: {
    campaignId: string;
    postId: string;
    creatorId: string;
    retentionDays: number;
    submittedAt: Date;
  }) {
    const days = [0, 5, 10, Math.max(15, params.retentionDays)].filter(
      (v, i, arr) => arr.indexOf(v) === i && v <= Math.max(15, params.retentionDays),
    );

    const created = [];
    for (const day of days) {
      const dueAt = new Date(params.submittedAt.getTime() + day * 24 * 60 * 60 * 1000);
      const report = await this.prisma.campaignReport.upsert({
        where: {
          postId_milestoneDay: {
            postId: params.postId,
            milestoneDay: day,
          },
        },
        create: {
          campaignId: params.campaignId,
          postId: params.postId,
          creatorId: params.creatorId,
          milestoneDay: day,
          dueAt,
          status: ReportStatus.SCHEDULED,
        },
        update: {},
      });
      created.push(report);
    }
    return created;
  }

  async submitCreatorEvidenceReport(
    userId: string,
    campaignId: string,
    dto: SubmitCampaignReportDto,
  ) {
    const creator = await this.prisma.creator.findUnique({ where: { userId } });
    if (!creator) {
      throw new NotFoundException('Creator profile not found');
    }

    const post = await this.prisma.campaignPost.findUnique({
      where: { id: dto.postId },
      include: { campaign: { include: { business: true } } },
    });
    if (!post || post.campaignId !== campaignId) {
      throw new NotFoundException('Campaign post not found');
    }
    if (post.creatorId !== creator.id) {
      throw new ForbiddenException('You can only submit reports for your own posts');
    }

    const hasAnyMetric = [
      dto.views,
      dto.reach,
      dto.impressions,
      dto.likes,
      dto.comments,
      dto.shares,
      dto.saves,
    ].some((v) => typeof v === 'number');

    if (!hasAnyMetric && !dto.evidenceImageUrl) {
      throw new BadRequestException(
        'Provide at least one metric figure or an evidence screenshot to submit a report',
      );
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const report = await tx.campaignReport.upsert({
        where: {
          postId_milestoneDay: {
            postId: post.id,
            milestoneDay: dto.milestoneDay,
          },
        },
        create: {
          campaignId,
          postId: post.id,
          creatorId: creator.id,
          milestoneDay: dto.milestoneDay,
          dueAt: now,
          submittedAt: now,
          status: ReportStatus.SUBMITTED_EVIDENCE,
          notes: dto.notes?.trim(),
          evidenceImageUrl: dto.evidenceImageUrl,
          extractedSummary: {
            source: 'creator_evidence',
            views: dto.views ?? null,
            reach: dto.reach ?? null,
            impressions: dto.impressions ?? null,
            likes: dto.likes ?? null,
            comments: dto.comments ?? null,
            shares: dto.shares ?? null,
            saves: dto.saves ?? null,
          } as Prisma.InputJsonValue,
        },
        update: {
          submittedAt: now,
          status: ReportStatus.SUBMITTED_EVIDENCE,
          notes: dto.notes?.trim(),
          evidenceImageUrl: dto.evidenceImageUrl,
          extractedSummary: {
            source: 'creator_evidence',
            views: dto.views ?? null,
            reach: dto.reach ?? null,
            impressions: dto.impressions ?? null,
            likes: dto.likes ?? null,
            comments: dto.comments ?? null,
            shares: dto.shares ?? null,
            saves: dto.saves ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      const snapshot = await tx.metricSnapshot.create({
        data: {
          campaignId,
          postId: post.id,
          reportId: report.id,
          platform: post.platform,
          metricSource: MetricSourceType.creator_evidence,
          views: dto.views ?? null,
          reach: dto.reach ?? null,
          impressions: dto.impressions ?? null,
          likes: dto.likes ?? null,
          comments: dto.comments ?? null,
          shares: dto.shares ?? null,
          saves: dto.saves ?? null,
          retrievedAt: now,
        },
      });

      // Evidence uploads must NOT be marked API_VERIFIED; mark as CREATOR_EVIDENCE unless already API_VERIFIED.
      if (post.verificationStatus === VerificationStatus.PENDING_VERIFICATION) {
        await tx.campaignPost.update({
          where: { id: post.id },
          data: { verificationStatus: VerificationStatus.CREATOR_EVIDENCE },
        });
      }

      if (
        canTransitionCampaignStatus(
          post.campaign.status as unknown as SharedCampaignStatus,
          SharedCampaignStatus.ACTIVE_REPORTING,
        )
      ) {
        await tx.campaign.update({
          where: { id: campaignId },
          data: { status: CampaignStatus.ACTIVE_REPORTING },
        });
      }

      return { report, snapshot };
    });

    await this.notifications.create({
      userId: post.campaign.business.ownerUserId,
      type: NotificationType.REPORT_REMINDER,
      title: `Day ${dto.milestoneDay} report submitted: ${post.campaign.title}`,
      message: `${creator.displayName} submitted creator evidence metrics for ${post.platform}.`,
      metadata: {
        campaignId,
        postId: post.id,
        reportId: result.report.id,
        metricSource: 'creator_evidence',
      },
    });

    return result;
  }

  async listReports(user: AuthUser, campaignId: string) {
    await this.assertCampaignAccess(user, campaignId);
    return this.prisma.campaignReport.findMany({
      where: { campaignId },
      include: {
        post: {
          select: {
            id: true,
            platform: true,
            postUrl: true,
            verificationStatus: true,
            retentionUntil: true,
          },
        },
        creator: { select: { id: true, displayName: true } },
        metricSnapshots: { orderBy: { retrievedAt: 'desc' } },
      },
      orderBy: [{ milestoneDay: 'asc' }, { dueAt: 'asc' }],
    });
  }

  async getCampaignAnalytics(user: AuthUser, campaignId: string) {
    const campaign = await this.assertCampaignAccess(user, campaignId);

    const [posts, snapshots, reports] = await Promise.all([
      this.prisma.campaignPost.findMany({
        where: { campaignId },
        include: { creator: { select: { id: true, displayName: true } } },
        orderBy: { submittedAt: 'asc' },
      }),
      this.prisma.metricSnapshot.findMany({
        where: { campaignId },
        orderBy: { retrievedAt: 'asc' },
      }),
      this.prisma.campaignReport.findMany({
        where: { campaignId },
        orderBy: { milestoneDay: 'asc' },
      }),
    ]);

    const latestByPost = new Map<string, (typeof snapshots)[number]>();
    for (const snap of snapshots) {
      latestByPost.set(snap.postId, snap);
    }

    const totals = Array.from(latestByPost.values()).reduce(
      (acc, snap) => ({
        views: acc.views + (snap.views ?? 0),
        reach: acc.reach + (snap.reach ?? 0),
        impressions: acc.impressions + (snap.impressions ?? 0),
        likes: acc.likes + (snap.likes ?? 0),
        comments: acc.comments + (snap.comments ?? 0),
        shares: acc.shares + (snap.shares ?? 0),
        saves: acc.saves + (snap.saves ?? 0),
        hasViews: acc.hasViews || snap.views !== null,
        hasReach: acc.hasReach || snap.reach !== null,
      }),
      {
        views: 0,
        reach: 0,
        impressions: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        hasViews: false,
        hasReach: false,
      },
    );

    const kpis = computeEngagementMetrics({
      views: totals.hasViews ? totals.views : null,
      reach: totals.hasReach ? totals.reach : null,
      likes: snapshots.some((s) => s.likes !== null) ? totals.likes : null,
      comments: snapshots.some((s) => s.comments !== null) ? totals.comments : null,
      shares: snapshots.some((s) => s.shares !== null) ? totals.shares : null,
      saves: snapshots.some((s) => s.saves !== null) ? totals.saves : null,
      campaignCostKobo: campaign.budgetKobo,
    });

    const sourceBreakdown = snapshots.reduce<Record<string, number>>((acc, s) => {
      acc[s.metricSource] = (acc[s.metricSource] ?? 0) + 1;
      return acc;
    }, {});

    return {
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      campaignStatus: campaign.status,
      budgetKobo: campaign.budgetKobo,
      retentionDays: campaign.retentionDays,
      posts: posts.map((p) => ({
        ...p,
        latestSnapshot: latestByPost.get(p.id) ?? null,
      })),
      totals: {
        views: totals.hasViews ? totals.views : null,
        reach: totals.hasReach ? totals.reach : null,
        impressions: snapshots.some((s) => s.impressions !== null)
          ? totals.impressions
          : null,
        likes: totals.likes,
        comments: totals.comments,
        shares: totals.shares,
        saves: totals.saves,
      },
      kpis,
      sourceBreakdown,
      reports,
      snapshots,
    };
  }

  async runVerification(user: AuthUser, campaignId: string) {
    const campaign = await this.assertCampaignAccess(user, campaignId);

    const posts = await this.prisma.campaignPost.findMany({
      where: { campaignId },
      include: { creator: true },
    });

    const syncResults = [];
    for (const post of posts) {
      let apiResult = null;
      let syncNote = 'No live API connection or sandbox mode — use creator-submitted evidence.';

      if (post.platformPostId) {
        try {
          apiResult = await this.socialService.fetchLiveMetricsIfAvailable(
            post.creator.userId,
            post.platform as SharedPlatform,
            post.platformPostId,
          );
        } catch (err) {
          syncNote = (err as Error).message;
        }
      }

      if (apiResult) {
        await this.prisma.metricSnapshot.create({
          data: {
            campaignId,
            postId: post.id,
            platform: post.platform,
            metricSource: MetricSourceType.official_api,
            views: apiResult.views ?? null,
            reach: apiResult.reach ?? null,
            impressions: apiResult.impressions ?? null,
            likes: apiResult.likes ?? null,
            comments: apiResult.comments ?? null,
            shares: apiResult.shares ?? null,
            saves: apiResult.saves ?? null,
            retrievedAt: new Date(apiResult.retrievedAt),
          },
        });
        await this.prisma.campaignPost.update({
          where: { id: post.id },
          data: { verificationStatus: VerificationStatus.API_VERIFIED },
        });
        syncNote = 'Official platform metrics synced.';
      }

      syncResults.push({
        postId: post.id,
        platform: post.platform,
        verificationStatus: apiResult
          ? VerificationStatus.API_VERIFIED
          : post.verificationStatus,
        retentionMet: post.retentionUntil <= new Date(),
        retentionUntil: post.retentionUntil,
        note: syncNote,
      });
    }

    const allRetentionMet =
      posts.length > 0 && posts.every((p) => p.retentionUntil <= new Date());

    if (
      allRetentionMet &&
      canTransitionCampaignStatus(
        campaign.status as unknown as SharedCampaignStatus,
        SharedCampaignStatus.FINAL_VERIFICATION,
      )
    ) {
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: CampaignStatus.FINAL_VERIFICATION },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.userId,
        action: 'CAMPAIGN_VERIFICATION_RUN',
        entityType: 'Campaign',
        entityId: campaignId,
        metadata: { checkedPosts: posts.length },
      },
    });

    return {
      campaignId,
      checkedPosts: posts.length,
      allRetentionMet,
      results: syncResults,
    };
  }

  async flagReport(user: AuthUser, reportId: string, dto: FlagReportDto) {
    const report = await this.prisma.campaignReport.findUnique({
      where: { id: reportId },
      include: { campaign: { include: { business: true } }, creator: true },
    });
    if (!report) {
      throw new NotFoundException('Campaign report not found');
    }

    const isOwner = report.campaign.business.ownerUserId === user.userId;
    if (user.role !== UserRole.ADMIN && !isOwner) {
      throw new ForbiddenException('Only the campaign owner or an admin can flag a report');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const flaggedReport = await tx.campaignReport.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.FLAGGED,
          notes: `${report.notes ? `${report.notes}\n` : ''}[FLAGGED]: ${dto.reason.trim()}`,
        },
      });
      await tx.campaignPost.update({
        where: { id: report.postId },
        data: { verificationStatus: VerificationStatus.FLAGGED_EVIDENCE },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.userId,
          action: 'EVIDENCE_FLAGGED_FOR_REVIEW',
          entityType: 'CampaignReport',
          entityId: report.id,
          metadata: { reason: dto.reason.trim() },
        },
      });
      return flaggedReport;
    });

    return updated;
  }

  private async assertCampaignAccess(user: AuthUser, campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        business: { select: { id: true, ownerUserId: true, name: true } },
      },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    if (
      user.role === UserRole.BUSINESS &&
      campaign.business.ownerUserId !== user.userId
    ) {
      throw new ForbiddenException('You can only access your own business campaigns');
    }
    if (user.role === UserRole.CREATOR) {
      const creator = await this.prisma.creator.findUnique({
        where: { userId: user.userId },
      });
      if (!creator) {
        throw new ForbiddenException('Creator profile required');
      }
      const assignment = await this.prisma.campaignAssignment.findUnique({
        where: {
          campaignId_creatorId: { campaignId, creatorId: creator.id },
        },
      });
      if (!assignment) {
        throw new ForbiddenException('You are not assigned to this campaign');
      }
    }
    return campaign;
  }
}
