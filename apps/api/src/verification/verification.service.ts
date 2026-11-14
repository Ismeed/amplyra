import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  CampaignStatus,
  CreatorTier,
  MetricSourceType,
  NotificationType,
  Prisma,
  ReportStatus,
  StoragePurpose,
  UploadedFileStatus,
  VerificationStatus,
} from '@prisma/client';
import {
  CampaignStatus as SharedCampaignStatus,
  CreatorTier as SharedCreatorTier,
  SocialPlatform as SharedPlatform,
  UserRole,
  canTransitionCampaignStatus,
  computeCreatorTier,
  computeEngagementMetrics,
  formatNgnFromKobo,
  getCreatorTierDefinition,
} from '@amplyra/shared';
import { AiProviderService } from '../ai/ai-provider.service';
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
    @Optional() private readonly aiProvider?: AiProviderService,
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

    if (!hasAnyMetric && !dto.evidenceImageUrl && !dto.evidenceFileId) {
      throw new BadRequestException(
        'Provide at least one metric figure or an evidence screenshot to submit a report',
      );
    }

    let linkedFile:
      | { id: string; bucket: string; objectPath: string }
      | null = null;
    if (dto.evidenceFileId) {
      const file = await this.prisma.uploadedFile.findUnique({
        where: { id: dto.evidenceFileId },
      });
      if (!file) {
        throw new NotFoundException('Uploaded evidence screenshot not found');
      }
      if (file.ownerUserId !== userId) {
        throw new ForbiddenException(
          'You can only attach evidence screenshots you uploaded',
        );
      }
      if (file.purpose !== StoragePurpose.EVIDENCE_SCREENSHOT) {
        throw new BadRequestException(
          'Attached file is not an evidence screenshot upload',
        );
      }
      if (file.campaignId && file.campaignId !== campaignId) {
        throw new BadRequestException(
          'Evidence screenshot belongs to a different campaign',
        );
      }
      linkedFile = file;
    }

    const resolvedEvidenceUrl =
      dto.evidenceImageUrl ??
      (linkedFile
        ? `supabase://${linkedFile.bucket}/${linkedFile.objectPath}`
        : undefined);

    const now = new Date();
    const extractedSummary = {
      source: 'creator_evidence',
      views: dto.views ?? null,
      reach: dto.reach ?? null,
      impressions: dto.impressions ?? null,
      likes: dto.likes ?? null,
      comments: dto.comments ?? null,
      shares: dto.shares ?? null,
      saves: dto.saves ?? null,
    } as Prisma.InputJsonValue;

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
          evidenceImageUrl: resolvedEvidenceUrl,
          extractedSummary,
        },
        update: {
          submittedAt: now,
          status: ReportStatus.SUBMITTED_EVIDENCE,
          notes: dto.notes?.trim(),
          ...(resolvedEvidenceUrl !== undefined
            ? { evidenceImageUrl: resolvedEvidenceUrl }
            : {}),
          extractedSummary,
        },
      });

      if (linkedFile) {
        await tx.uploadedFile.update({
          where: { id: linkedFile.id },
          data: {
            campaignId,
            reportId: report.id,
            status: UploadedFileStatus.READY,
          },
        });
      }

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

    try {
      await this.syncPostAnalyticsInBackground(post.id);
    } catch {
      // Evidence submission still succeeds if background AI summary refresh fails
    }

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
        uploadedFiles: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            status: true,
            createdAt: true,
          },
        },
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
        include: {
          uploadedFiles: {
            select: {
              id: true,
              originalName: true,
              mimeType: true,
              sizeBytes: true,
              status: true,
              createdAt: true,
            },
          },
        },
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
      const result = await this.syncSinglePost(post, campaign.budgetKobo);
      syncResults.push(result);
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

  async syncPostAnalyticsInBackground(postId: string) {
    const post = await this.prisma.campaignPost.findUnique({
      where: { id: postId },
      include: {
        creator: true,
        campaign: { select: { id: true, status: true, budgetKobo: true } },
      },
    });
    if (!post) {
      return null;
    }

    const result = await this.syncSinglePost(post, post.campaign.budgetKobo);

    if (
      post.retentionUntil <= new Date() &&
      canTransitionCampaignStatus(
        post.campaign.status as unknown as SharedCampaignStatus,
        SharedCampaignStatus.FINAL_VERIFICATION,
      )
    ) {
      await this.prisma.campaign.update({
        where: { id: post.campaign.id },
        data: { status: CampaignStatus.FINAL_VERIFICATION },
      });
    }

    return result;
  }

  async runAgenticSyncForUser(user: AuthUser) {
    if (user.role === UserRole.ADMIN) {
      return this.runAgenticSync({ staleHours: 0, limit: 30 });
    }
    const business = await this.prisma.business.findUnique({
      where: { ownerUserId: user.userId },
    });
    if (!business) {
      throw new NotFoundException('Business profile not found');
    }
    return this.runAgenticSync({ businessId: business.id, staleHours: 0, limit: 25 });
  }

  async runAgenticSync(options?: {
    campaignId?: string;
    businessId?: string;
    staleHours?: number;
    limit?: number;
  }) {
    const staleHours = options?.staleHours ?? 6;
    const cutoff =
      staleHours > 0 ? new Date(Date.now() - staleHours * 3_600_000) : null;

    const posts = await this.prisma.campaignPost.findMany({
      where: {
        ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
        ...(options?.businessId ? { campaign: { businessId: options.businessId } } : {}),
        ...(cutoff
          ? {
              OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
            }
          : {}),
      },
      include: {
        creator: true,
        campaign: { select: { id: true, status: true, budgetKobo: true } },
      },
      orderBy: [{ lastSyncedAt: 'asc' }, { submittedAt: 'desc' }],
      take: options?.limit ?? 20,
    });

    const results = [];
    for (const post of posts) {
      const res = await this.syncSinglePost(post, post.campaign.budgetKobo);
      results.push(res);
    }

    return {
      syncedCount: results.length,
      syncedAt: new Date().toISOString(),
      results,
    };
  }

  async recalculateCreatorBenchmarkAndTier(creatorId: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { id: creatorId },
      include: { socialAccounts: true },
    });
    if (!creator) {
      return null;
    }

    const completedDealsCount = await this.prisma.campaignAssignment.count({
      where: {
        creatorId,
        OR: [
          { completedAt: { not: null } },
          {
            campaign: {
              status: {
                in: [CampaignStatus.COMPLETED, CampaignStatus.PAYMENT_RELEASED],
              },
            },
          },
        ],
      },
    });

    const settledPosts = await this.prisma.campaignPost.findMany({
      where: {
        creatorId,
        OR: [
          { assignment: { completedAt: { not: null } } },
          {
            campaign: {
              status: {
                in: [CampaignStatus.COMPLETED, CampaignStatus.PAYMENT_RELEASED],
              },
            },
          },
          { campaign: { funding: { status: 'RELEASED' } } },
        ],
      },
      include: {
        metricSnapshots: {
          orderBy: { retrievedAt: 'desc' },
          take: 1,
        },
      },
    });

    const engagementRates: number[] = [];
    const viewsCounts: number[] = [];

    for (const post of settledPosts) {
      const latest = post.metricSnapshots[0];
      if (!latest) continue;
      if (typeof latest.views === 'number' && latest.views > 0) {
        viewsCounts.push(latest.views);
      }
      const computed = computeEngagementMetrics({
        views: latest.views,
        reach: latest.reach,
        likes: latest.likes,
        comments: latest.comments,
        shares: latest.shares,
        saves: latest.saves,
      });
      const effectiveEr =
        computed.engagementRateByViewsPct ?? computed.engagementRateByReachPct;
      if (effectiveEr !== null) {
        engagementRates.push(effectiveEr);
      }
    }

    const overallAvgEngagement =
      engagementRates.length > 0
        ? Number(
            (
              engagementRates.reduce((sum, n) => sum + n, 0) /
              engagementRates.length
            ).toFixed(2),
          )
        : null;

    const overallAvgViews =
      viewsCounts.length > 0
        ? Math.round(
            viewsCounts.reduce((sum, n) => sum + n, 0) / viewsCounts.length,
          )
        : null;

    const maxFollowers = creator.socialAccounts.reduce(
      (max, sa) => Math.max(max, sa.followersCount),
      0,
    );
    const ratedAccounts = creator.socialAccounts.filter(
      (sa) => typeof sa.avgEngagementRate === 'number',
    );
    const profileAvgEngagementPct =
      ratedAccounts.length > 0
        ? ratedAccounts.reduce((sum, sa) => sum + (sa.avgEngagementRate ?? 0), 0) /
          ratedAccounts.length
        : null;

    const computedTier = computeCreatorTier({
      maxFollowers,
      profileAvgEngagementPct,
      overallAvgEngagementPct: overallAvgEngagement,
      completedDealsCount,
    });

    const previousTier = creator.tier;
    const now = new Date();

    const updated = await this.prisma.creator.update({
      where: { id: creator.id },
      data: {
        tier: computedTier.tier as unknown as CreatorTier,
        fixedPriceKobo: computedTier.fixedPriceKobo,
        minRateKobo: computedTier.fixedPriceKobo,
        overallAvgEngagement,
        overallAvgViews,
        completedDealsCount,
        lastBenchmarkAt: now,
      },
    });

    if (previousTier !== updated.tier) {
      const tierDef = getCreatorTierDefinition(
        computedTier.tier as SharedCreatorTier,
      );
      await this.notifications.create({
        userId: creator.userId,
        type: NotificationType.SYSTEM,
        title: `Creator Tier updated to ${tierDef.label}`,
        message: `Based on your followers and AI insight average (${computedTier.effectiveEngagementPct}% ER), your fixed campaign fee is now ${formatNgnFromKobo(tierDef.fixedPriceKobo)}.`,
        metadata: {
          tier: updated.tier,
          fixedPriceKobo: updated.fixedPriceKobo,
          overallAvgEngagement,
        },
      });
    }

    return {
      creatorId: updated.id,
      tier: updated.tier,
      fixedPriceKobo: updated.fixedPriceKobo,
      overallAvgEngagement: updated.overallAvgEngagement,
      overallAvgViews: updated.overallAvgViews,
      completedDealsCount: updated.completedDealsCount,
    };
  }

  private async syncSinglePost(
    post: {
      id: string;
      campaignId: string;
      platform: string;
      postUrl: string;
      platformPostId: string | null;
      verificationStatus: VerificationStatus;
      retentionUntil: Date;
      creator: { userId: string; displayName: string };
    },
    campaignBudgetKobo: number,
  ) {
    let apiResult = null;
    let syncNote = 'Live post monitored; awaiting official channel API or post metrics.';

    if (post.platformPostId && typeof this.socialService?.fetchLiveMetricsIfAvailable === 'function') {
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
          campaignId: post.campaignId,
          postId: post.id,
          platform: post.platform as any,
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

    let publicMetaNote: string | null = null;
    if (!apiResult && post.platform === 'TIKTOK') {
      publicMetaNote = await this.fetchTikTokOembedSummary(post.postUrl);
      if (publicMetaNote) {
        syncNote = `Public post confirmed (${publicMetaNote}).`;
      }
    }

    const latestSnapshot =
      typeof this.prisma.metricSnapshot?.findFirst === 'function'
        ? await this.prisma.metricSnapshot.findFirst({
            where: { postId: post.id },
            orderBy: { retrievedAt: 'desc' },
          })
        : null;

    const kpis = latestSnapshot
      ? computeEngagementMetrics({
          views: latestSnapshot.views,
          reach: latestSnapshot.reach,
          likes: latestSnapshot.likes,
          comments: latestSnapshot.comments,
          shares: latestSnapshot.shares,
          saves: latestSnapshot.saves,
          campaignCostKobo: campaignBudgetKobo,
        })
      : null;

    const retentionMet = post.retentionUntil <= new Date();
    const daysLeft = Math.max(
      0,
      Math.ceil((post.retentionUntil.getTime() - Date.now()) / 86_400_000),
    );
    const retentionText = retentionMet
      ? '15-day retention requirement completed.'
      : `${daysLeft} day(s) remaining in 15-day retention lock.`;

    let aiInsightSummary: string;
    if (latestSnapshot) {
      const viewsLabel =
        latestSnapshot.views !== null
          ? `${latestSnapshot.views.toLocaleString()} views`
          : 'views pending';
      const engLabel =
        kpis?.totalEngagements !== null && kpis?.totalEngagements !== undefined
          ? `${kpis.totalEngagements.toLocaleString()} engagements`
          : 'engagements pending';
      const erLabel =
        kpis?.engagementRateByViewsPct !== null &&
        kpis?.engagementRateByViewsPct !== undefined
          ? `${kpis.engagementRateByViewsPct}% ER`
          : 'ER pending';
      aiInsightSummary = `Agentic AI (${latestSnapshot.metricSource}): ${post.creator.displayName} reached ${viewsLabel}, ${engLabel} (${erLabel}) on ${post.platform}. ${retentionText}`;
    } else if (publicMetaNote) {
      aiInsightSummary = `Agentic AI verified live ${post.platform} post (${publicMetaNote}). Full reach metrics sync when creator API access is enabled. ${retentionText}`;
    } else {
      aiInsightSummary = `Agentic AI is monitoring ${post.creator.displayName}'s ${post.platform} link. ${syncNote} ${retentionText}`;
    }

    if (
      this.aiProvider &&
      latestSnapshot &&
      process.env.GEMINI_API_KEY
    ) {
      try {
        const generated = await this.aiProvider.generateText({
          systemPrompt:
            'You are Amplyra Agentic AI. Summarize campaign post performance in max 2 concise, strictly factual sentences using only the provided JSON metrics. Never invent numbers.',
          userPrompt: JSON.stringify({
            creator: post.creator.displayName,
            platform: post.platform,
            metricSource: latestSnapshot.metricSource,
            views: latestSnapshot.views,
            likes: latestSnapshot.likes,
            comments: latestSnapshot.comments,
            shares: latestSnapshot.shares,
            engagementRateByViewsPct: kpis?.engagementRateByViewsPct ?? null,
            retentionStatus: retentionText,
          }),
          fallbackGenerator: () => aiInsightSummary,
        });
        if (generated.providerUsed !== 'amplyra-brand-engine' && generated.text.trim()) {
          aiInsightSummary = generated.text.trim().slice(0, 320);
        }
      } catch {
        // Keep grounded deterministic summary when LLM provider fails
      }
    }

    await this.prisma.campaignPost.update({
      where: { id: post.id },
      data: {
        aiInsightSummary,
        lastSyncedAt: new Date(),
      },
    });

    return {
      postId: post.id,
      platform: post.platform,
      verificationStatus: apiResult
        ? VerificationStatus.API_VERIFIED
        : post.verificationStatus,
      retentionMet,
      retentionUntil: post.retentionUntil,
      aiInsightSummary,
      note: syncNote,
    };
  }

  private async fetchTikTokOembedSummary(postUrl: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(postUrl)}`,
        { signal: AbortSignal.timeout(2500) },
      );
      if (!response.ok) return null;
      const data = (await response.json()) as {
        author_name?: string;
        title?: string;
      };
      if (data.author_name) {
        return `TikTok creator ${data.author_name}`;
      }
      return null;
    } catch {
      return null;
    }
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
