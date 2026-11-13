import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePortfolioItemDto,
  UpsertCreatorDto,
  UpsertCreatorSocialAccountDto,
} from './dto/creator.dto';
import { DiscoverCreatorsQueryDto } from './dto/discover-creators.dto';
import { UpdateCreatorDto } from './dto/update-creator.dto';

@Injectable()
export class CreatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: UpsertCreatorDto) {
    const existing = await this.prisma.creator.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('Creator profile already exists for this user');
    }

    return this.prisma.creator.create({
      data: {
        userId,
        displayName: dto.displayName.trim(),
        bio: dto.bio?.trim(),
        avatarUrl: dto.avatarUrl?.trim(),
        country: dto.country?.trim() || 'Nigeria',
        state: dto.state?.trim(),
        city: dto.city?.trim(),
        categories: dto.categories ?? [],
        niches: dto.niches ?? [],
        isAvailable: dto.isAvailable ?? true,
        minRateKobo: dto.minRateKobo ?? 0,
        maxRateKobo: dto.maxRateKobo,
        payoutBankName: dto.payoutBankName?.trim(),
        payoutAccountName: dto.payoutAccountName?.trim(),
        payoutAccountLast4: dto.payoutAccountLast4?.trim(),
      },
      include: {
        socialAccounts: true,
        portfolioItems: true,
      },
    });
  }

  async getMine(userId: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { userId },
      include: {
        socialAccounts: true,
        portfolioItems: { orderBy: { createdAt: 'desc' } },
        _count: {
          select: {
            applications: true,
            assignments: true,
            submittedPosts: true,
          },
        },
      },
    });
    if (!creator) {
      throw new NotFoundException('Creator profile not found');
    }
    return creator;
  }

  async updateMine(userId: string, dto: UpdateCreatorDto) {
    const existing = await this.getMine(userId);
    return this.prisma.creator.update({
      where: { id: existing.id },
      data: {
        ...(dto.displayName !== undefined
          ? { displayName: dto.displayName.trim() }
          : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio?.trim() } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl?.trim() } : {}),
        ...(dto.country !== undefined ? { country: dto.country?.trim() } : {}),
        ...(dto.state !== undefined ? { state: dto.state?.trim() } : {}),
        ...(dto.city !== undefined ? { city: dto.city?.trim() } : {}),
        ...(dto.categories !== undefined ? { categories: dto.categories } : {}),
        ...(dto.niches !== undefined ? { niches: dto.niches } : {}),
        ...(dto.isAvailable !== undefined ? { isAvailable: dto.isAvailable } : {}),
        ...(dto.minRateKobo !== undefined ? { minRateKobo: dto.minRateKobo } : {}),
        ...(dto.maxRateKobo !== undefined ? { maxRateKobo: dto.maxRateKobo } : {}),
        ...(dto.payoutBankName !== undefined
          ? { payoutBankName: dto.payoutBankName?.trim() }
          : {}),
        ...(dto.payoutAccountName !== undefined
          ? { payoutAccountName: dto.payoutAccountName?.trim() }
          : {}),
        ...(dto.payoutAccountLast4 !== undefined
          ? { payoutAccountLast4: dto.payoutAccountLast4?.trim() }
          : {}),
      },
      include: {
        socialAccounts: true,
        portfolioItems: true,
      },
    });
  }

  async upsertSocialAccount(userId: string, dto: UpsertCreatorSocialAccountDto) {
    const creator = await this.getMine(userId);
    return this.prisma.creatorSocialAccount.upsert({
      where: {
        creatorId_platform: {
          creatorId: creator.id,
          platform: dto.platform,
        },
      },
      create: {
        creatorId: creator.id,
        platform: dto.platform,
        handle: dto.handle.trim().replace(/^@/, ''),
        profileUrl: dto.profileUrl?.trim(),
        followersCount: dto.followersCount,
        avgEngagementRate: dto.avgEngagementRate,
      },
      update: {
        handle: dto.handle.trim().replace(/^@/, ''),
        profileUrl: dto.profileUrl?.trim(),
        followersCount: dto.followersCount,
        avgEngagementRate: dto.avgEngagementRate,
      },
    });
  }

  async removeSocialAccount(userId: string, socialAccountId: string) {
    const creator = await this.getMine(userId);
    const deleted = await this.prisma.creatorSocialAccount.deleteMany({
      where: { id: socialAccountId, creatorId: creator.id },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Social account not found');
    }
    return { deleted: true };
  }

  async addPortfolioItem(userId: string, dto: CreatePortfolioItemDto) {
    const creator = await this.getMine(userId);
    return this.prisma.creatorPortfolioItem.create({
      data: {
        creatorId: creator.id,
        title: dto.title.trim(),
        platform: dto.platform,
        postUrl: dto.postUrl.trim(),
        description: dto.description?.trim(),
        viewsCount: dto.viewsCount,
        likesCount: dto.likesCount,
      },
    });
  }

  async removePortfolioItem(userId: string, itemId: string) {
    const creator = await this.getMine(userId);
    const deleted = await this.prisma.creatorPortfolioItem.deleteMany({
      where: { id: itemId, creatorId: creator.id },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Portfolio item not found');
    }
    return { deleted: true };
  }

  async discover(query: DiscoverCreatorsQueryDto) {
    const where: Prisma.CreatorWhereInput = {
      ...(query.country
        ? { country: { equals: query.country, mode: 'insensitive' } }
        : {}),
      ...(query.state
        ? { state: { contains: query.state, mode: 'insensitive' } }
        : {}),
      ...(query.city
        ? { city: { contains: query.city, mode: 'insensitive' } }
        : {}),
      ...(query.category ? { categories: { has: query.category } } : {}),
      ...(query.niche ? { niches: { has: query.niche } } : {}),
      ...(query.availableOnly !== undefined
        ? { isAvailable: query.availableOnly }
        : {}),
      ...(query.maxRateKobo !== undefined
        ? { minRateKobo: { lte: query.maxRateKobo } }
        : {}),
      ...(query.platform || query.minFollowers !== undefined
        ? {
            socialAccounts: {
              some: {
                ...(query.platform ? { platform: query.platform } : {}),
                ...(query.minFollowers !== undefined
                  ? { followersCount: { gte: query.minFollowers } }
                  : {}),
              },
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { displayName: { contains: query.q, mode: 'insensitive' } },
              { bio: { contains: query.q, mode: 'insensitive' } },
              { city: { contains: query.q, mode: 'insensitive' } },
              { state: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.creator.findMany({
      where,
      include: {
        socialAccounts: true,
        portfolioItems: { take: 3, orderBy: { createdAt: 'desc' } },
        _count: {
          select: { assignments: true, submittedPosts: true },
        },
      },
      orderBy: [{ verifiedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });
  }

  async getById(id: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { id },
      include: {
        socialAccounts: true,
        portfolioItems: { orderBy: { createdAt: 'desc' } },
        _count: {
          select: {
            assignments: true,
            submittedPosts: true,
          },
        },
      },
    });
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }
    return creator;
  }

  async getPerformance(id: string) {
    const creator = await this.getById(id);
    const [assignments, posts] = await Promise.all([
      this.prisma.campaignAssignment.findMany({
        where: { creatorId: creator.id },
        include: {
          campaign: {
            select: {
              id: true,
              title: true,
              status: true,
              platforms: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.campaignPost.findMany({
        where: { creatorId: creator.id },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

    return {
      creatorId: creator.id,
      displayName: creator.displayName,
      totalAssignments: assignments.length,
      completedAssignments: assignments.filter((a) => a.completedAt !== null).length,
      submittedPostsCount: posts.length,
      recentPosts: posts.slice(0, 10),
    };
  }
}
