import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AiContentType,
  ContentCalendarStatus,
  Prisma,
  SocialPlatform,
} from '@prisma/client';
import { formatNgnFromKobo } from '@amplyra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';
import {
  AskAnalystDto,
  CreateCalendarItemDto,
  GenerateContentDto,
  GenerateStrategyDto,
  UpdateCalendarItemDto,
} from './dto/ai.dto';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProviderService,
  ) {}

  async generateStrategy(userId: string, dto: GenerateStrategyDto) {
    const business = await this.getBusinessOrThrow(userId);
    const budgetKobo = dto.budgetKobo ?? business.monthlyBudgetKobo ?? 10_000_000;
    const region =
      dto.focusRegion?.trim() ||
      [business.city, business.state, business.country].filter(Boolean).join(', ');

    const prompt = `Business: ${business.name} (${business.industry}). Products: ${business.productsServices || 'Not specified'}. Target Audience: ${business.targetAudience || 'General consumers'}. Region: ${region}. Objective: ${dto.objective}. Budget: ${formatNgnFromKobo(budgetKobo)}. Brand Tone: ${business.brandTone || 'Clear and trustworthy'}.`;

    const { text, providerUsed } = await this.aiProvider.generateText({
      systemPrompt:
        'You are the Amplyra AI Marketing Strategist for growing Nigerian and African SMEs. Provide concise, actionable, realistic marketing strategy recommendations.',
      userPrompt: prompt,
      fallbackGenerator: () =>
        JSON.stringify({
          summary: `30-day growth plan for ${business.name} focused on "${dto.objective}" across ${region}.`,
          targetSegments: [
            business.targetAudience || `Active mobile shoppers in ${region}`,
            `Local repeat buyers seeking ${business.industry.toLowerCase()} value`,
          ],
          channelMix: [
            {
              channel: 'TikTok & Instagram Reels (Creator Amplification)',
              allocationPct: 50,
              estimatedBudget: formatNgnFromKobo(Math.round(budgetKobo * 0.5)),
              rationale:
                'Short-form product demonstrations with trusted regional micro-creators.',
            },
            {
              channel: 'Owned Social Content Calendar (Instagram / Facebook)',
              allocationPct: 30,
              estimatedBudget: formatNgnFromKobo(Math.round(budgetKobo * 0.3)),
              rationale:
                'Consistent educational, behind-the-scenes, and social proof posts.',
            },
            {
              channel: 'WhatsApp & Direct Conversion Follow-up',
              allocationPct: 20,
              estimatedBudget: formatNgnFromKobo(Math.round(budgetKobo * 0.2)),
              rationale:
                'Convert inbound campaign comments and DMs into direct orders.',
            },
          ],
          campaignConcepts: [
            `Local Spotlight Challenge: Partner with 2-3 ${business.city || region} creators to showcase real product use over a 15-day campaign.`,
            `Customer Proof Series: Turn buyer testimonials and creator clips into reusable Reels and Facebook Page posts.`,
          ],
          kpisToTrack: [
            'View-to-engagement rate across 5-day reporting checkpoints',
            'Cost per engagement and creator-driven inquiry volume',
          ],
        }),
    });

    let strategyJson: Record<string, unknown>;
    try {
      strategyJson = JSON.parse(text);
    } catch {
      strategyJson = {
        summary: text,
        targetSegments: [business.targetAudience || 'Primary brand audience'],
        channelMix: [],
        campaignConcepts: [],
      };
    }

    return this.prisma.aiStrategy.create({
      data: {
        businessId: business.id,
        objective: dto.objective.trim(),
        budgetKobo,
        strategyJson: strategyJson as Prisma.InputJsonValue,
        providerUsed,
      },
    });
  }

  async listStrategies(userId: string) {
    const business = await this.getBusinessOrThrow(userId);
    return this.prisma.aiStrategy.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async generateContent(userId: string, dto: GenerateContentDto) {
    const business = await this.getBusinessOrThrow(userId);
    const brandTone = business.brandTone || 'Warm, clear, culturally relevant';
    const cta = dto.callToAction?.trim() || 'Send us a DM or tap the link in bio to order today.';

    const { text } = await this.aiProvider.generateText({
      systemPrompt: `You are the Amplyra AI Content Studio. Write ${dto.contentType} tailored for ${dto.platform} in the brand tone: "${brandTone}". Never invent false awards or statistics.`,
      userPrompt: `Business: ${business.name} (${business.industry}). Topic: ${dto.topic}. CTA: ${cta}`,
      fallbackGenerator: () =>
        this.buildDeterministicContent({
          businessName: business.name,
          industry: business.industry,
          city: business.city || business.country,
          brandTone,
          contentType: dto.contentType,
          platform: dto.platform,
          topic: dto.topic.trim(),
          cta,
        }),
    });

    return this.prisma.aiGeneratedContent.create({
      data: {
        businessId: business.id,
        contentType: dto.contentType as AiContentType,
        platform: dto.platform as SocialPlatform,
        promptSummary: dto.topic.trim(),
        outputText: text,
        brandToneUsed: brandTone,
      },
    });
  }

  async listGeneratedContent(userId: string) {
    const business = await this.getBusinessOrThrow(userId);
    return this.prisma.aiGeneratedContent.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async askAnalyst(userId: string, dto: AskAnalystDto) {
    const business = await this.getBusinessOrThrow(userId);
    const campaigns = await this.prisma.campaign.findMany({
      where: { businessId: business.id },
      include: {
        posts: {
          include: {
            creator: { select: { displayName: true } },
            metricSnapshots: { orderBy: { retrievedAt: 'desc' }, take: 1 },
          },
        },
        funding: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const observedSummary = campaigns.map((c) => ({
      title: c.title,
      status: c.status,
      budget: formatNgnFromKobo(c.budgetKobo),
      postsCount: c.posts.length,
      posts: c.posts.map((p) => {
        const snap = p.metricSnapshots[0];
        return {
          creator: p.creator.displayName,
          platform: p.platform,
          verificationStatus: p.verificationStatus,
          metrics: snap
            ? {
                source: snap.metricSource,
                views: snap.views,
                likes: snap.likes,
                comments: snap.comments,
                shares: snap.shares,
              }
            : null,
        };
      }),
    }));

    const { text, providerUsed } = await this.aiProvider.generateText({
      systemPrompt:
        'You are the Amplyra AI Marketing Analyst. Answer ONLY from the observed database metrics provided. Explicitly call out where data or metrics are missing. Never invent statistics.',
      userPrompt: `Question: ${dto.question}\n\nObserved data for ${business.name}: ${JSON.stringify(observedSummary)}`,
      fallbackGenerator: () => {
        if (campaigns.length === 0) {
          return `No campaigns exist yet for ${business.name}, so there is no performance data to evaluate. Create and publish your first campaign, then collect 5-day reporting snapshots to unlock comparative insights.`;
        }

        const allPosts = campaigns.flatMap((c) =>
          c.posts.map((p) => ({
            campaignTitle: c.title,
            creator: p.creator.displayName,
            platform: p.platform,
            snap: p.metricSnapshots[0] ?? null,
          })),
        );
        const postsWithSnapshots = allPosts.filter((p) => p.snap !== null);

        if (postsWithSnapshots.length === 0) {
          return `You currently have ${campaigns.length} campaign(s) and ${allPosts.length} submitted creator post(s), but 0 metric snapshots have been recorded yet. Ask assigned creators to submit their Day 0/Day 5 evidence reports or connect official OAuth integrations before evaluating top performers.`;
        }

        const sortedByEngagement = [...postsWithSnapshots].sort((a, b) => {
          const engA =
            (a.snap!.likes ?? 0) +
            (a.snap!.comments ?? 0) +
            (a.snap!.shares ?? 0) +
            (a.snap!.saves ?? 0);
          const engB =
            (b.snap!.likes ?? 0) +
            (b.snap!.comments ?? 0) +
            (b.snap!.shares ?? 0) +
            (b.snap!.saves ?? 0);
          return engB - engA;
        });
        const top = sortedByEngagement[0];
        const topEng =
          (top.snap!.likes ?? 0) +
          (top.snap!.comments ?? 0) +
          (top.snap!.shares ?? 0) +
          (top.snap!.saves ?? 0);

        return `Based on ${postsWithSnapshots.length} observed post snapshot(s) across ${campaigns.length} campaign(s) for ${business.name}: "${top.creator}" on ${top.platform} (${top.campaignTitle}) currently leads with ${topEng} recorded engagements${top.snap!.views ? ` and ${top.snap!.views.toLocaleString()} views` : ' (views not reported)'} [source: ${top.snap!.metricSource}]. Note: ${allPosts.length - postsWithSnapshots.length} submitted post(s) still have missing metric snapshots.`;
      },
    });

    return {
      question: dto.question,
      answer: text,
      providerUsed,
      dataBasis: {
        campaignsAnalyzed: campaigns.length,
        postsObserved: campaigns.reduce((sum, c) => sum + c.posts.length, 0),
      },
    };
  }

  async getRecommendations(userId: string) {
    const business = await this.getBusinessOrThrow(userId);
    const [campaigns, matchingCreators, calendarCount] = await Promise.all([
      this.prisma.campaign.findMany({
        where: { businessId: business.id },
        include: {
          posts: {
            include: {
              creator: { select: { id: true, displayName: true } },
              metricSnapshots: { orderBy: { retrievedAt: 'desc' }, take: 1 },
            },
          },
        },
      }),
      this.prisma.creator.findMany({
        where: {
          isAvailable: true,
          ...(business.city
            ? { city: { equals: business.city, mode: 'insensitive' } }
            : {}),
        },
        include: { socialAccounts: true },
        take: 3,
      }),
      this.prisma.contentCalendarItem.count({
        where: { businessId: business.id },
      }),
    ]);

    const recommendations: Array<{
      category: 'CREATOR' | 'CAMPAIGN' | 'BUDGET' | 'CONTENT';
      title: string;
      explanation: string;
      evidenceStatus: 'observed_data' | 'incomplete_evidence';
    }> = [];

    if (matchingCreators.length > 0) {
      const names = matchingCreators.map((c) => c.displayName).join(', ');
      recommendations.push({
        category: 'CREATOR',
        title: `Available local creators in ${business.city || business.country}`,
        explanation: `${names} match your region and are currently open for collaborations.`,
        evidenceStatus: 'observed_data',
      });
    }

    const totalSnapshots = campaigns.reduce(
      (sum, c) =>
        sum + c.posts.filter((p) => p.metricSnapshots.length > 0).length,
      0,
    );

    if (totalSnapshots === 0) {
      recommendations.push({
        category: 'CAMPAIGN',
        title: 'Collect baseline Day 0 & Day 5 performance snapshots',
        explanation:
          'No campaign metric snapshots exist yet. Encourage creators to submit Day 0/Day 5 reports or connect OAuth insights so Amplyra can benchmark cost per engagement.',
        evidenceStatus: 'incomplete_evidence',
      });
    } else {
      recommendations.push({
        category: 'BUDGET',
        title: 'Re-invest in highest-engagement creator formats',
        explanation: `You have ${totalSnapshots} verified/submitted post snapshot(s). Compare cost-per-engagement across creators before scaling your next campaign budget.`,
        evidenceStatus: 'observed_data',
      });
    }

    if (calendarCount === 0) {
      recommendations.push({
        category: 'CONTENT',
        title: 'Populate your weekly Content Calendar',
        explanation:
          'Your content calendar has no scheduled posts yet. Use Content Studio to draft 3-5 posts aligned with your brand tone.',
        evidenceStatus: 'observed_data',
      });
    }

    return recommendations;
  }

  async listCalendarItems(userId: string) {
    const business = await this.getBusinessOrThrow(userId);
    return this.prisma.contentCalendarItem.findMany({
      where: { businessId: business.id },
      include: { campaign: { select: { id: true, title: true } } },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  async createCalendarItem(userId: string, dto: CreateCalendarItemDto) {
    const business = await this.getBusinessOrThrow(userId);
    return this.prisma.contentCalendarItem.create({
      data: {
        businessId: business.id,
        campaignId: dto.campaignId || null,
        title: dto.title.trim(),
        platform: dto.platform as SocialPlatform,
        caption: dto.caption.trim(),
        scheduledFor: new Date(dto.scheduledFor),
        status: ContentCalendarStatus.DRAFT,
      },
    });
  }

  async updateCalendarItem(
    userId: string,
    itemId: string,
    dto: UpdateCalendarItemDto,
  ) {
    const business = await this.getBusinessOrThrow(userId);
    const item = await this.prisma.contentCalendarItem.findFirst({
      where: { id: itemId, businessId: business.id },
    });
    if (!item) {
      throw new NotFoundException('Calendar item not found');
    }

    // Human-in-the-loop publishing control: cannot skip directly from DRAFT to PUBLISHED without approval
    if (
      dto.status === ContentCalendarStatus.PUBLISHED &&
      item.status === ContentCalendarStatus.DRAFT
    ) {
      throw new BadRequestException(
        'Approve the content item before marking it as published',
      );
    }

    return this.prisma.contentCalendarItem.update({
      where: { id: item.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.caption !== undefined ? { caption: dto.caption.trim() } : {}),
        ...(dto.scheduledFor !== undefined
          ? { scheduledFor: new Date(dto.scheduledFor) }
          : {}),
        ...(dto.status !== undefined
          ? {
              status: dto.status as ContentCalendarStatus,
              ...(dto.status === ContentCalendarStatus.PUBLISHED
                ? { publishedAt: new Date() }
                : {}),
            }
          : {}),
      },
    });
  }

  async deleteCalendarItem(userId: string, itemId: string) {
    const business = await this.getBusinessOrThrow(userId);
    const deleted = await this.prisma.contentCalendarItem.deleteMany({
      where: { id: itemId, businessId: business.id },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Calendar item not found');
    }
    return { deleted: true };
  }

  private async getBusinessOrThrow(userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { ownerUserId: userId },
    });
    if (!business) {
      throw new NotFoundException(
        'Complete your business profile before using the AI Marketing Department',
      );
    }
    return business;
  }

  private buildDeterministicContent(params: {
    businessName: string;
    industry: string;
    city: string;
    brandTone: string;
    contentType: string;
    platform: string;
    topic: string;
    cta: string;
  }) {
    const tagSlug = params.businessName.replace(/[^A-Za-z0-9]/g, '');
    switch (params.contentType) {
      case 'VIDEO_SCRIPT':
        return [
          `[SHORT-FORM ${params.platform} VIDEO SCRIPT — ${params.businessName}]`,
          `Tone: ${params.brandTone}`,
          ``,
          `0-3s HOOK: "Wait—if you're in ${params.city} looking for ${params.topic}, watch this before you buy!"`,
          `3-20s BODY: Show the product/service up close. Highlight why ${params.businessName} (${params.industry}) built it to solve a real daily frustration.`,
          `20-30s PROOF & CTA: Show final result + on-screen text. "${params.cta}"`,
        ].join('\n');
      case 'AD_COPY':
        return [
          `HEADLINE: ${params.topic} by ${params.businessName}`,
          `PRIMARY TEXT: Looking for trusted ${params.industry.toLowerCase()} quality in ${params.city}? Discover ${params.topic} crafted for everyday reliability.`,
          `CTA: ${params.cta}`,
        ].join('\n\n');
      case 'EMAIL_COPY':
        return [
          `SUBJECT: Meet ${params.topic} — Now from ${params.businessName}`,
          ``,
          `Hi there,`,
          ``,
          `We just launched ${params.topic} at ${params.businessName}. Designed with our signature ${params.brandTone.toLowerCase()} approach, it's ready for customers across ${params.city}.`,
          ``,
          `${params.cta}`,
          ``,
          `Warm regards,`,
          `${params.businessName} Team`,
        ].join('\n');
      case 'SLOGAN':
        return [
          `1. ${params.businessName}: ${params.topic}, Elevated.`,
          `2. Built for ${params.city}. Crafted by ${params.businessName}.`,
          `3. Quality you feel. Style you share. — ${params.businessName}`,
        ].join('\n');
      case 'HASHTAGS':
        return `#${tagSlug} #AmplyraNigeria #${params.city.replace(/\s+/g, '')}Business #${params.industry.replace(/[^A-Za-z0-9]/g, '')} #SupportLocalNG`;
      default:
        return [
          `✨ ${params.topic} is officially here at ${params.businessName}!`,
          ``,
          `Crafted for our community in ${params.city} with a ${params.brandTone.toLowerCase()} touch.`,
          ``,
          `${params.cta}`,
          ``,
          `#${tagSlug} #${params.city.replace(/\s+/g, '')} #${params.industry.replace(/[^A-Za-z0-9]/g, '')}`,
        ].join('\n');
    }
  }
}
