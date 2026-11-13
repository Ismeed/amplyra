import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, CampaignStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpsertBusinessDto } from './dto/upsert-business.dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: UpsertBusinessDto) {
    const existing = await this.prisma.business.findUnique({
      where: { ownerUserId: userId },
    });
    if (existing) {
      throw new ConflictException('Business profile already exists for this user');
    }

    return this.prisma.business.create({
      data: {
        ownerUserId: userId,
        name: dto.name.trim(),
        industry: dto.industry.trim(),
        description: dto.description?.trim(),
        productsServices: dto.productsServices?.trim(),
        targetAudience: dto.targetAudience?.trim(),
        country: dto.country?.trim() || 'Nigeria',
        state: dto.state?.trim(),
        city: dto.city?.trim(),
        websiteUrl: dto.websiteUrl?.trim(),
        brandTone: dto.brandTone?.trim(),
        monthlyBudgetKobo: dto.monthlyBudgetKobo,
      },
    });
  }

  async getMine(userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { ownerUserId: userId },
    });
    if (!business) {
      throw new NotFoundException('Business profile not found');
    }
    return business;
  }

  async updateMine(userId: string, dto: UpdateBusinessDto) {
    const existing = await this.getMine(userId);
    return this.prisma.business.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.industry !== undefined ? { industry: dto.industry.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() }
          : {}),
        ...(dto.productsServices !== undefined
          ? { productsServices: dto.productsServices?.trim() }
          : {}),
        ...(dto.targetAudience !== undefined
          ? { targetAudience: dto.targetAudience?.trim() }
          : {}),
        ...(dto.country !== undefined ? { country: dto.country?.trim() } : {}),
        ...(dto.state !== undefined ? { state: dto.state?.trim() } : {}),
        ...(dto.city !== undefined ? { city: dto.city?.trim() } : {}),
        ...(dto.websiteUrl !== undefined
          ? { websiteUrl: dto.websiteUrl?.trim() }
          : {}),
        ...(dto.brandTone !== undefined ? { brandTone: dto.brandTone?.trim() } : {}),
        ...(dto.monthlyBudgetKobo !== undefined
          ? { monthlyBudgetKobo: dto.monthlyBudgetKobo }
          : {}),
      },
    });
  }

  async getDashboard(userId: string) {
    const business = await this.getMine(userId);

    const [campaigns, pendingApplicationsCount, recentPosts] = await Promise.all([
      this.prisma.campaign.findMany({
        where: { businessId: business.id },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { applications: true, assignments: true, posts: true },
          },
        },
      }),
      this.prisma.campaignApplication.count({
        where: {
          campaign: { businessId: business.id },
          status: ApplicationStatus.PENDING,
        },
      }),
      this.prisma.campaignPost.findMany({
        where: { campaign: { businessId: business.id } },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        include: {
          campaign: { select: { id: true, title: true } },
          creator: { select: { id: true, displayName: true } },
        },
      }),
    ]);

    const activeStatuses = new Set<CampaignStatus>([
      CampaignStatus.PUBLISHED,
      CampaignStatus.APPLICATIONS_OPEN,
      CampaignStatus.CREATOR_SELECTED,
      CampaignStatus.FUNDED,
      CampaignStatus.CREATOR_ACCEPTED,
      CampaignStatus.CONTENT_APPROVAL,
      CampaignStatus.PUBLISHED_ON_SOCIAL,
      CampaignStatus.ACTIVE_REPORTING,
      CampaignStatus.FINAL_VERIFICATION,
    ]);

    const totalBudgetCommittedKobo = campaigns
      .filter((c) => c.status !== CampaignStatus.CANCELLED && c.status !== CampaignStatus.DRAFT)
      .reduce((sum, c) => sum + c.budgetKobo, 0);

    return {
      business,
      summary: {
        totalCampaigns: campaigns.length,
        activeCampaigns: campaigns.filter((c) => activeStatuses.has(c.status)).length,
        draftCampaigns: campaigns.filter((c) => c.status === CampaignStatus.DRAFT).length,
        pendingApplicationsCount,
        submittedPostsCount: recentPosts.length,
        totalBudgetCommittedKobo,
      },
      recentCampaigns: campaigns.slice(0, 5),
      recentPosts,
    };
  }
}
