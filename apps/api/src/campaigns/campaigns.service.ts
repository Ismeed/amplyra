import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  ApplicationType,
  CampaignStatus,
  NotificationType,
  Prisma,
  VerificationStatus,
} from '@prisma/client';
import {
  CampaignStatus as SharedCampaignStatus,
  UserRole,
  assertCampaignTransition,
  canTransitionCampaignStatus,
  parseSocialPostUrl,
} from '@amplyra/shared';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationService } from '../verification/verification.service';
import {
  ApplyToCampaignDto,
  CreateCampaignDto,
  InviteCreatorDto,
  ReviewApplicationDto,
  SubmitCampaignPostDto,
} from './dto/campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly verification: VerificationService,
  ) {}

  async create(userId: string, dto: CreateCampaignDto) {
    const business = await this.prisma.business.findUnique({
      where: { ownerUserId: userId },
    });
    if (!business) {
      throw new BadRequestException(
        'Please complete your business profile before creating a campaign',
      );
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        businessId: business.id,
        title: dto.title.trim(),
        productOrService: dto.productOrService.trim(),
        description: dto.description.trim(),
        objectives: dto.objectives?.trim(),
        targetAudience: dto.targetAudience?.trim(),
        preferredCategories: dto.preferredCategories ?? [],
        targetCountry: dto.targetCountry?.trim() || 'Nigeria',
        targetState: dto.targetState?.trim(),
        targetCity: dto.targetCity?.trim(),
        platforms: dto.platforms,
        budgetKobo: dto.budgetKobo,
        creatorsNeeded: dto.creatorsNeeded ?? 1,
        deliverables: dto.deliverables as unknown as Prisma.InputJsonValue,
        publicationDeadline: dto.publicationDeadline
          ? new Date(dto.publicationDeadline)
          : undefined,
        retentionDays: dto.retentionDays ?? 15,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: CampaignStatus.DRAFT,
      },
      include: {
        business: { select: { id: true, name: true, city: true, state: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'CAMPAIGN_CREATED',
        entityType: 'Campaign',
        entityId: campaign.id,
      },
    });

    return campaign;
  }

  async list(user: AuthUser, filters?: { category?: string; city?: string; q?: string }) {
    if (user.role === UserRole.BUSINESS) {
      const business = await this.prisma.business.findUnique({
        where: { ownerUserId: user.userId },
      });
      if (!business) return [];
      return this.prisma.campaign.findMany({
        where: { businessId: business.id },
        include: {
          business: { select: { id: true, name: true, industry: true, city: true, state: true } },
          _count: { select: { applications: true, assignments: true, posts: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === UserRole.CREATOR) {
      return this.prisma.campaign.findMany({
        where: {
          status: {
            in: [CampaignStatus.PUBLISHED, CampaignStatus.APPLICATIONS_OPEN],
          },
          ...(filters?.category
            ? { preferredCategories: { has: filters.category } }
            : {}),
          ...(filters?.city
            ? { targetCity: { contains: filters.city, mode: 'insensitive' } }
            : {}),
          ...(filters?.q
            ? {
                OR: [
                  { title: { contains: filters.q, mode: 'insensitive' } },
                  { description: { contains: filters.q, mode: 'insensitive' } },
                  { productOrService: { contains: filters.q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: {
          business: {
            select: {
              id: true,
              name: true,
              industry: true,
              city: true,
              state: true,
              country: true,
            },
          },
          _count: { select: { applications: true, assignments: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.campaign.findMany({
      include: {
        business: { select: { id: true, name: true } },
        _count: { select: { applications: true, assignments: true, posts: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getCreatorWork(userId: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { userId },
    });
    if (!creator) {
      return { applications: [], assignments: [] };
    }

    const [applications, assignments] = await Promise.all([
      this.prisma.campaignApplication.findMany({
        where: { creatorId: creator.id },
        include: {
          campaign: {
            include: {
              business: { select: { id: true, name: true, city: true, state: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.campaignAssignment.findMany({
        where: { creatorId: creator.id },
        include: {
          campaign: {
            include: {
              business: { select: { id: true, name: true, city: true, state: true } },
            },
          },
          posts: { orderBy: { submittedAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { applications, assignments };
  }

  async getById(user: AuthUser, campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        business: {
          select: {
            id: true,
            ownerUserId: true,
            name: true,
            industry: true,
            city: true,
            state: true,
            country: true,
          },
        },
        applications: {
          include: {
            creator: {
              include: { socialAccounts: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        assignments: {
          include: {
            creator: {
              include: { socialAccounts: true },
            },
            posts: true,
          },
        },
        posts: {
          include: {
            creator: { select: { id: true, displayName: true } },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const isOwner = campaign.business.ownerUserId === user.userId;
    if (user.role === UserRole.BUSINESS && !isOwner) {
      throw new ForbiddenException('You can only access your own business campaigns');
    }

    if (user.role === UserRole.CREATOR) {
      const creator = await this.prisma.creator.findUnique({
        where: { userId: user.userId },
      });
      const creatorId = creator?.id;
      const isParticipant =
        !!creatorId &&
        (campaign.applications.some((a) => a.creatorId === creatorId) ||
          campaign.assignments.some((a) => a.creatorId === creatorId));

      if (campaign.status === CampaignStatus.DRAFT && !isParticipant) {
        throw new ForbiddenException('Draft campaign is private');
      }

      return {
        ...campaign,
        applications: creatorId
          ? campaign.applications.filter((a) => a.creatorId === creatorId)
          : [],
        assignments: creatorId
          ? campaign.assignments.filter((a) => a.creatorId === creatorId)
          : [],
        posts: creatorId
          ? campaign.posts.filter((p) => p.creatorId === creatorId)
          : [],
      };
    }

    return campaign;
  }

  async update(userId: string, campaignId: string, dto: UpdateCampaignDto) {
    const campaign = await this.assertBusinessOwner(userId, campaignId);
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException(
        'Only campaigns in DRAFT status can be freely edited',
      );
    }

    return this.prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.productOrService !== undefined
          ? { productOrService: dto.productOrService.trim() }
          : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.objectives !== undefined
          ? { objectives: dto.objectives?.trim() }
          : {}),
        ...(dto.targetAudience !== undefined
          ? { targetAudience: dto.targetAudience?.trim() }
          : {}),
        ...(dto.preferredCategories !== undefined
          ? { preferredCategories: dto.preferredCategories }
          : {}),
        ...(dto.targetCountry !== undefined
          ? { targetCountry: dto.targetCountry?.trim() }
          : {}),
        ...(dto.targetState !== undefined
          ? { targetState: dto.targetState?.trim() }
          : {}),
        ...(dto.targetCity !== undefined ? { targetCity: dto.targetCity?.trim() } : {}),
        ...(dto.platforms !== undefined ? { platforms: dto.platforms } : {}),
        ...(dto.budgetKobo !== undefined ? { budgetKobo: dto.budgetKobo } : {}),
        ...(dto.creatorsNeeded !== undefined
          ? { creatorsNeeded: dto.creatorsNeeded }
          : {}),
        ...(dto.deliverables !== undefined
          ? { deliverables: dto.deliverables as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.retentionDays !== undefined
          ? { retentionDays: dto.retentionDays }
          : {}),
        ...(dto.publicationDeadline !== undefined
          ? {
              publicationDeadline: dto.publicationDeadline
                ? new Date(dto.publicationDeadline)
                : null,
            }
          : {}),
      },
    });
  }

  async publish(userId: string, campaignId: string) {
    const campaign = await this.assertBusinessOwner(userId, campaignId);

    try {
      assertCampaignTransition(
        campaign.status as unknown as SharedCampaignStatus,
        SharedCampaignStatus.APPLICATIONS_OPEN,
      );
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const updated = await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: CampaignStatus.APPLICATIONS_OPEN },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'CAMPAIGN_PUBLISHED',
        entityType: 'Campaign',
        entityId: campaign.id,
      },
    });

    return updated;
  }

  async apply(userId: string, campaignId: string, dto: ApplyToCampaignDto) {
    const creator = await this.prisma.creator.findUnique({
      where: { userId },
    });
    if (!creator) {
      throw new BadRequestException(
        'Please complete your creator profile before applying to campaigns',
      );
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { business: true },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (
      campaign.status !== CampaignStatus.APPLICATIONS_OPEN &&
      campaign.status !== CampaignStatus.PUBLISHED
    ) {
      throw new BadRequestException('Campaign is not currently accepting applications');
    }

    const existing = await this.prisma.campaignApplication.findUnique({
      where: {
        campaignId_creatorId: { campaignId, creatorId: creator.id },
      },
    });
    if (existing) {
      throw new ConflictException(
        'You have already applied or been invited to this campaign',
      );
    }

    const application = await this.prisma.campaignApplication.create({
      data: {
        campaignId,
        creatorId: creator.id,
        type: ApplicationType.APPLICATION,
        status: ApplicationStatus.PENDING,
        pitch: dto.pitch?.trim(),
        proposedRateKobo: dto.proposedRateKobo,
        deliverablePlan: dto.deliverablePlan?.trim(),
      },
    });

    await this.notifications.create({
      userId: campaign.business.ownerUserId,
      type: NotificationType.APPLICATION_RECEIVED,
      title: `New application for ${campaign.title}`,
      message: `${creator.displayName} applied to promote "${campaign.title}".`,
      metadata: { campaignId, creatorId: creator.id, applicationId: application.id },
    });

    return application;
  }

  async inviteCreator(
    userId: string,
    campaignId: string,
    dto: InviteCreatorDto,
  ) {
    const campaign = await this.assertBusinessOwner(userId, campaignId);
    if (campaign.status === CampaignStatus.DRAFT) {
      throw new BadRequestException('Publish the campaign before inviting creators');
    }

    const creator = await this.prisma.creator.findUnique({
      where: { id: dto.creatorId },
    });
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    const existing = await this.prisma.campaignApplication.findUnique({
      where: {
        campaignId_creatorId: { campaignId, creatorId: creator.id },
      },
    });
    if (existing) {
      throw new ConflictException('Creator already has an application or invitation for this campaign');
    }

    const invitation = await this.prisma.campaignApplication.create({
      data: {
        campaignId,
        creatorId: creator.id,
        type: ApplicationType.INVITATION,
        status: ApplicationStatus.INVITED,
        pitch: dto.message?.trim(),
        proposedRateKobo: dto.offeredRateKobo,
      },
    });

    await this.notifications.create({
      userId: creator.userId,
      type: NotificationType.CAMPAIGN_INVITATION,
      title: `Campaign invitation: ${campaign.title}`,
      message: `You have been invited to collaborate on "${campaign.title}".`,
      metadata: { campaignId, applicationId: invitation.id },
    });

    return invitation;
  }

  async reviewApplication(
    userId: string,
    campaignId: string,
    dto: ReviewApplicationDto,
  ) {
    const campaign = await this.assertBusinessOwner(userId, campaignId);

    const application = await this.prisma.campaignApplication.findUnique({
      where: { id: dto.applicationId },
      include: { creator: true },
    });
    if (!application || application.campaignId !== campaign.id) {
      throw new NotFoundException('Application not found for this campaign');
    }

    if (dto.decision === 'DECLINE') {
      const declined = await this.prisma.campaignApplication.update({
        where: { id: application.id },
        data: {
          status: ApplicationStatus.DECLINED,
          reviewedAt: new Date(),
        },
      });

      await this.notifications.create({
        userId: application.creator.userId,
        type: NotificationType.APPLICATION_DECLINED,
        title: `Application update: ${campaign.title}`,
        message: `Your application for "${campaign.title}" was not selected this time.`,
        metadata: { campaignId, applicationId: application.id },
      });

      return { application: declined };
    }

    const agreedRateKobo =
      dto.agreedRateKobo ?? application.proposedRateKobo ?? campaign.budgetKobo;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedApp = await tx.campaignApplication.update({
        where: { id: application.id },
        data: {
          status: ApplicationStatus.APPROVED,
          reviewedAt: new Date(),
        },
      });

      const assignment = await tx.campaignAssignment.upsert({
        where: {
          campaignId_creatorId: {
            campaignId: campaign.id,
            creatorId: application.creatorId,
          },
        },
        create: {
          campaignId: campaign.id,
          creatorId: application.creatorId,
          agreedRateKobo,
          deliverables: campaign.deliverables as Prisma.InputJsonValue,
        },
        update: {
          agreedRateKobo,
        },
      });

      if (
        canTransitionCampaignStatus(
          campaign.status as unknown as SharedCampaignStatus,
          SharedCampaignStatus.CREATOR_SELECTED,
        )
      ) {
        await tx.campaign.update({
          where: { id: campaign.id },
          data: { status: CampaignStatus.CREATOR_SELECTED },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'CREATOR_APPROVED',
          entityType: 'Campaign',
          entityId: campaign.id,
          metadata: {
            creatorId: application.creatorId,
            agreedRateKobo,
          },
        },
      });

      return { application: updatedApp, assignment };
    });

    await this.notifications.create({
      userId: application.creator.userId,
      type: NotificationType.APPLICATION_APPROVED,
      title: `You're selected for ${campaign.title}`,
      message: `Your application was approved. Accept the assignment to begin execution.`,
      metadata: { campaignId, assignmentId: result.assignment.id },
    });

    return result;
  }

  async acceptCampaign(userId: string, campaignId: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { userId },
    });
    if (!creator) {
      throw new NotFoundException('Creator profile not found');
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { business: true },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const application = await this.prisma.campaignApplication.findUnique({
      where: {
        campaignId_creatorId: { campaignId, creatorId: creator.id },
      },
    });

    const existingAssignment = await this.prisma.campaignAssignment.findUnique({
      where: {
        campaignId_creatorId: { campaignId, creatorId: creator.id },
      },
    });

    if (
      !existingAssignment &&
      (!application || application.status !== ApplicationStatus.INVITED)
    ) {
      throw new ForbiddenException(
        'You must be invited or approved before accepting this campaign',
      );
    }

    const assignment = await this.prisma.$transaction(async (tx) => {
      if (application) {
        await tx.campaignApplication.update({
          where: { id: application.id },
          data: {
            status: ApplicationStatus.ACCEPTED_BY_CREATOR,
            reviewedAt: new Date(),
          },
        });
      }

      const savedAssignment = await tx.campaignAssignment.upsert({
        where: {
          campaignId_creatorId: { campaignId, creatorId: creator.id },
        },
        create: {
          campaignId,
          creatorId: creator.id,
          agreedRateKobo: application?.proposedRateKobo ?? campaign.budgetKobo,
          deliverables: campaign.deliverables as Prisma.InputJsonValue,
          acceptedAt: new Date(),
        },
        update: {
          acceptedAt: new Date(),
        },
      });

      if (
        canTransitionCampaignStatus(
          campaign.status as unknown as SharedCampaignStatus,
          SharedCampaignStatus.CREATOR_ACCEPTED,
        )
      ) {
        await tx.campaign.update({
          where: { id: campaignId },
          data: { status: CampaignStatus.CREATOR_ACCEPTED },
        });
      }

      return savedAssignment;
    });

    await this.notifications.create({
      userId: campaign.business.ownerUserId,
      type: NotificationType.CREATOR_ACCEPTED,
      title: `Creator accepted: ${campaign.title}`,
      message: `${creator.displayName} accepted your campaign assignment.`,
      metadata: { campaignId, assignmentId: assignment.id },
    });

    return assignment;
  }

  async submitPost(
    userId: string,
    campaignId: string,
    dto: SubmitCampaignPostDto,
  ) {
    const creator = await this.prisma.creator.findUnique({
      where: { userId },
    });
    if (!creator) {
      throw new NotFoundException('Creator profile not found');
    }

    const assignment = await this.prisma.campaignAssignment.findUnique({
      where: {
        campaignId_creatorId: { campaignId, creatorId: creator.id },
      },
      include: {
        campaign: { include: { business: true } },
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'You do not have an active assignment for this campaign',
      );
    }

    let parsedUrl;
    try {
      parsedUrl = parseSocialPostUrl(dto.postUrl);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const existingPost = await this.prisma.campaignPost.findUnique({
      where: {
        campaignId_postUrl: {
          campaignId,
          postUrl: parsedUrl.normalizedUrl,
        },
      },
    });
    if (existingPost) {
      throw new ConflictException('This post URL has already been submitted for this campaign');
    }

    const retentionUntil = new Date(
      Date.now() + assignment.campaign.retentionDays * 24 * 60 * 60 * 1000,
    );

    const post = await this.prisma.$transaction(async (tx) => {
      const createdPost = await tx.campaignPost.create({
        data: {
          campaignId,
          assignmentId: assignment.id,
          creatorId: creator.id,
          platform: parsedUrl.platform,
          postUrl: parsedUrl.normalizedUrl,
          platformPostId: parsedUrl.platformPostId,
          caption: dto.caption?.trim(),
          verificationStatus: VerificationStatus.PENDING_VERIFICATION,
          retentionUntil,
        },
      });

      if (
        canTransitionCampaignStatus(
          assignment.campaign.status as unknown as SharedCampaignStatus,
          SharedCampaignStatus.PUBLISHED_ON_SOCIAL,
        )
      ) {
        await tx.campaign.update({
          where: { id: campaignId },
          data: { status: CampaignStatus.PUBLISHED_ON_SOCIAL },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'CAMPAIGN_POST_SUBMITTED',
          entityType: 'CampaignPost',
          entityId: createdPost.id,
          metadata: {
            campaignId,
            platform: parsedUrl.platform,
            platformPostId: parsedUrl.platformPostId,
          },
        },
      });

      return createdPost;
    });

    await this.verification.createScheduleForPost({
      campaignId,
      postId: post.id,
      creatorId: creator.id,
      retentionDays: assignment.campaign.retentionDays,
      submittedAt: post.submittedAt ?? new Date(),
    });

    await this.notifications.create({
      userId: assignment.campaign.business.ownerUserId,
      type: NotificationType.POST_SUBMITTED,
      title: `Deliverable submitted for ${assignment.campaign.title}`,
      message: `${creator.displayName} submitted a ${parsedUrl.platform} post URL.`,
      metadata: { campaignId, postId: post.id },
    });

    return post;
  }

  async listPosts(user: AuthUser, campaignId: string) {
    const campaign = await this.getById(user, campaignId);
    return campaign.posts;
  }

  private async assertBusinessOwner(userId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { business: true },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    if (campaign.business.ownerUserId !== userId) {
      throw new ForbiddenException('You do not own this campaign');
    }
    return campaign;
  }
}
