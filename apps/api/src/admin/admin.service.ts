import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      businessesCount,
      creatorsCount,
      campaignsCount,
      postsCount,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.business.count(),
      this.prisma.creator.count(),
      this.prisma.campaign.count(),
      this.prisma.campaignPost.count(),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          actor: { select: { id: true, fullName: true, email: true, role: true } },
        },
      }),
    ]);

    return {
      metrics: {
        businessesCount,
        creatorsCount,
        campaignsCount,
        postsCount,
      },
      recentAuditLogs,
    };
  }

  async listBusinesses() {
    return this.prisma.business.findMany({
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        _count: { select: { campaigns: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyBusiness(actorUserId: string, businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Business not found');

    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: { verifiedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'BUSINESS_VERIFIED',
        entityType: 'Business',
        entityId: businessId,
      },
    });

    return updated;
  }

  async listCreators() {
    return this.prisma.creator.findMany({
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        socialAccounts: true,
        _count: { select: { assignments: true, submittedPosts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyCreator(actorUserId: string, creatorId: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { id: creatorId },
    });
    if (!creator) throw new NotFoundException('Creator not found');

    const updated = await this.prisma.creator.update({
      where: { id: creatorId },
      data: { verifiedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'CREATOR_VERIFIED',
        entityType: 'Creator',
        entityId: creatorId,
      },
    });

    return updated;
  }

  async listCampaigns() {
    return this.prisma.campaign.findMany({
      include: {
        business: { select: { id: true, name: true } },
        _count: { select: { applications: true, assignments: true, posts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
