import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CampaignStatus,
  DisputeStatus,
  FundingStatus,
  NotificationType,
  PaymentTransactionStatus,
  PaymentTransactionType,
  Prisma,
} from '@prisma/client';
import {
  CampaignStatus as SharedCampaignStatus,
  UserRole,
  calculatePlatformFeeSplit,
  canTransitionCampaignStatus,
} from '@amplyra/shared';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  FundCampaignDto,
  OpenDisputeDto,
  ReleasePaymentDto,
  ResolveDisputeDto,
} from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async fundCampaign(userId: string, dto: FundCampaignDto) {
    const business = await this.prisma.business.findUnique({
      where: { ownerUserId: userId },
      include: { owner: true },
    });
    if (!business) {
      throw new NotFoundException('Business profile not found');
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: dto.campaignId },
      include: {
        funding: true,
        assignments: { include: { creator: true } },
      },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    if (campaign.businessId !== business.id) {
      throw new ForbiddenException('You can only fund your own campaigns');
    }
    if (campaign.status === CampaignStatus.DRAFT) {
      throw new BadRequestException('Publish the campaign before funding');
    }

    const idempotencyKey =
      dto.idempotencyKey?.trim() || `fund_${campaign.id}_${campaign.budgetKobo}`;

    const existingTx = await this.prisma.paymentTransaction.findUnique({
      where: { idempotencyKey },
      include: { campaignFunding: true },
    });
    if (existingTx) {
      return {
        idempotentReplay: true,
        funding: existingTx.campaignFunding,
      };
    }

    if (
      campaign.funding &&
      campaign.funding.status !== FundingStatus.PENDING_PAYMENT
    ) {
      throw new ConflictException('Campaign has already been funded');
    }

    const split = calculatePlatformFeeSplit(campaign.budgetKobo, 1000);
    const paystackSecret = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    const providerReference = `AMP_${randomBytes(6).toString('hex').toUpperCase()}`;

    if (paystackSecret) {
      const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: business.owner.email,
          amount: split.grossAmountKobo,
          reference: providerReference,
          metadata: { campaignId: campaign.id, businessId: business.id },
        }),
      });
      if (!initRes.ok) {
        throw new BadRequestException('Failed to initialize Paystack checkout');
      }
      const initJson = (await initRes.json()) as {
        data: { authorization_url: string; reference: string };
      };

      const funding = await this.prisma.campaignFunding.upsert({
        where: { campaignId: campaign.id },
        create: {
          campaignId: campaign.id,
          businessId: business.id,
          amountKobo: split.grossAmountKobo,
          platformFeeKobo: split.platformFeeKobo,
          creatorNetKobo: split.creatorNetKobo,
          provider: 'PAYSTACK_PARTNER',
          providerReference: initJson.data.reference,
          status: FundingStatus.PENDING_PAYMENT,
        },
        update: {
          providerReference: initJson.data.reference,
          status: FundingStatus.PENDING_PAYMENT,
        },
      });

      return {
        funding,
        authorizationUrl: initJson.data.authorization_url,
      };
    }

    // Sandbox partner ledger flow for local MVP testing
    const funding = await this.prisma.$transaction(async (tx) => {
      const savedFunding = await tx.campaignFunding.upsert({
        where: { campaignId: campaign.id },
        create: {
          campaignId: campaign.id,
          businessId: business.id,
          amountKobo: split.grossAmountKobo,
          platformFeeKobo: split.platformFeeKobo,
          creatorNetKobo: split.creatorNetKobo,
          provider: 'SANDBOX_PARTNER_LEDGER',
          providerReference,
          status: FundingStatus.HELD_BY_PARTNER,
          fundedAt: new Date(),
        },
        update: {
          providerReference,
          status: FundingStatus.HELD_BY_PARTNER,
          fundedAt: new Date(),
        },
      });

      await tx.paymentTransaction.createMany({
        data: [
          {
            campaignFundingId: savedFunding.id,
            type: PaymentTransactionType.FUNDING,
            amountKobo: split.grossAmountKobo,
            providerReference,
            idempotencyKey,
            status: PaymentTransactionStatus.SUCCEEDED,
            metadata: { note: 'Sandbox partner-held campaign funding' } as Prisma.InputJsonValue,
          },
          {
            campaignFundingId: savedFunding.id,
            type: PaymentTransactionType.FEE,
            amountKobo: split.platformFeeKobo,
            providerReference,
            idempotencyKey: `${idempotencyKey}_fee`,
            status: PaymentTransactionStatus.SUCCEEDED,
            metadata: { feeRateBps: split.feeRateBps } as Prisma.InputJsonValue,
          },
        ],
      });

      if (
        canTransitionCampaignStatus(
          campaign.status as unknown as SharedCampaignStatus,
          SharedCampaignStatus.FUNDED,
        )
      ) {
        await tx.campaign.update({
          where: { id: campaign.id },
          data: { status: CampaignStatus.FUNDED },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'CAMPAIGN_FUNDED',
          entityType: 'CampaignFunding',
          entityId: savedFunding.id,
          metadata: {
            campaignId: campaign.id,
            amountKobo: split.grossAmountKobo,
            platformFeeKobo: split.platformFeeKobo,
            creatorNetKobo: split.creatorNetKobo,
          },
        },
      });

      return savedFunding;
    });

    for (const assignment of campaign.assignments) {
      await this.notifications.create({
        userId: assignment.creator.userId,
        type: NotificationType.PAYMENT_FUNDED,
        title: `Campaign funded: ${campaign.title}`,
        message: `Partner holding confirmed for "${campaign.title}".`,
        metadata: { campaignId: campaign.id, fundingId: funding.id },
      });
    }

    return { funding };
  }

  async getCampaignPayment(user: AuthUser, campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        business: true,
        assignments: true,
        funding: {
          include: {
            transactions: { orderBy: { createdAt: 'desc' } },
            disputes: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const isOwner = campaign.business.ownerUserId === user.userId;
    if (user.role === UserRole.BUSINESS && !isOwner) {
      throw new ForbiddenException('Access denied');
    }
    if (user.role === UserRole.CREATOR) {
      const creator = await this.prisma.creator.findUnique({
        where: { userId: user.userId },
      });
      const assigned =
        creator && campaign.assignments.some((a) => a.creatorId === creator.id);
      if (!assigned) {
        throw new ForbiddenException('Access denied');
      }
    }

    return {
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      campaignStatus: campaign.status,
      funding: campaign.funding,
    };
  }

  async getBusinessLedger(userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { ownerUserId: userId },
    });
    if (!business) return [];

    return this.prisma.campaignFunding.findMany({
      where: { businessId: business.id },
      include: {
        campaign: { select: { id: true, title: true, status: true } },
        transactions: { orderBy: { createdAt: 'desc' } },
        disputes: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCreatorEarnings(userId: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { userId },
    });
    if (!creator) {
      return {
        summary: {
          heldKobo: 0,
          releasedKobo: 0,
          disputedKobo: 0,
        },
        items: [],
      };
    }

    const assignments = await this.prisma.campaignAssignment.findMany({
      where: { creatorId: creator.id },
      include: {
        campaign: {
          include: {
            business: { select: { id: true, name: true } },
            funding: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let heldKobo = 0;
    let releasedKobo = 0;
    let disputedKobo = 0;

    const items = assignments.map((a) => {
      const split = calculatePlatformFeeSplit(a.agreedRateKobo, 1000);
      const fundingStatus = a.campaign.funding?.status ?? null;
      if (fundingStatus === FundingStatus.HELD_BY_PARTNER) {
        heldKobo += split.creatorNetKobo;
      } else if (fundingStatus === FundingStatus.RELEASED) {
        releasedKobo += split.creatorNetKobo;
      } else if (fundingStatus === FundingStatus.DISPUTED) {
        disputedKobo += split.creatorNetKobo;
      }

      return {
        assignmentId: a.id,
        campaignId: a.campaignId,
        campaignTitle: a.campaign.title,
        campaignStatus: a.campaign.status,
        businessName: a.campaign.business.name,
        grossRateKobo: split.grossAmountKobo,
        platformFeeKobo: split.platformFeeKobo,
        netEarningsKobo: split.creatorNetKobo,
        fundingStatus,
        releasedAt: a.campaign.funding?.releasedAt ?? null,
      };
    });

    return {
      summary: { heldKobo, releasedKobo, disputedKobo },
      items,
    };
  }

  async releasePayment(
    user: AuthUser,
    campaignId: string,
    dto: ReleasePaymentDto,
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        business: true,
        posts: true,
        assignments: { include: { creator: true } },
        funding: { include: { disputes: true } },
      },
    });
    if (!campaign || !campaign.funding) {
      throw new NotFoundException('Campaign funding record not found');
    }

    if (
      user.role === UserRole.BUSINESS &&
      campaign.business.ownerUserId !== user.userId
    ) {
      throw new ForbiddenException('You do not own this campaign');
    }

    if (campaign.funding.status === FundingStatus.RELEASED) {
      throw new ConflictException('Payment has already been released');
    }

    if (
      campaign.funding.disputes.some(
        (d) =>
          d.status === DisputeStatus.OPEN ||
          d.status === DisputeStatus.UNDER_REVIEW,
      )
    ) {
      throw new BadRequestException(
        'Cannot release payment while an open dispute exists',
      );
    }

    if (campaign.posts.length === 0) {
      throw new BadRequestException(
        'At least one deliverable post must be submitted before payment release',
      );
    }

    const retentionMet = campaign.posts.every(
      (p) => p.retentionUntil <= new Date(),
    );
    if (!retentionMet && !dto.confirmEarlyRelease && user.role !== UserRole.ADMIN) {
      throw new BadRequestException(
        'Retention period has not completed yet; pass confirmEarlyRelease=true to authorize early payout',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const releasedFunding = await tx.campaignFunding.update({
        where: { id: campaign.funding!.id },
        data: {
          status: FundingStatus.RELEASED,
          releasedAt: new Date(),
        },
      });

      await tx.paymentTransaction.create({
        data: {
          campaignFundingId: releasedFunding.id,
          type: PaymentTransactionType.PAYOUT_RELEASE,
          amountKobo: releasedFunding.creatorNetKobo,
          providerReference: `${releasedFunding.providerReference}_PAYOUT`,
          idempotencyKey: `release_${releasedFunding.id}`,
          status: PaymentTransactionStatus.SUCCEEDED,
          metadata: { releasedBy: user.userId } as Prisma.InputJsonValue,
        },
      });

      await tx.campaign.update({
        where: { id: campaign.id },
        data: { status: CampaignStatus.PAYMENT_RELEASED },
      });

      await tx.campaignAssignment.updateMany({
        where: { campaignId: campaign.id, completedAt: null },
        data: { completedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.userId,
          action: 'PAYMENT_RELEASED',
          entityType: 'CampaignFunding',
          entityId: releasedFunding.id,
          metadata: {
            campaignId: campaign.id,
            creatorNetKobo: releasedFunding.creatorNetKobo,
          },
        },
      });

      return releasedFunding;
    });

    for (const assignment of campaign.assignments) {
      await this.notifications.create({
        userId: assignment.creator.userId,
        type: NotificationType.PAYMENT_RELEASED,
        title: `Payout released: ${campaign.title}`,
        message: `Partner payout release authorized for "${campaign.title}".`,
        metadata: { campaignId: campaign.id, fundingId: updated.id },
      });
    }

    return updated;
  }

  async openDispute(
    user: AuthUser,
    campaignId: string,
    dto: OpenDisputeDto,
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        business: true,
        assignments: { include: { creator: true } },
        funding: true,
      },
    });
    if (!campaign || !campaign.funding) {
      throw new NotFoundException('Funded campaign not found');
    }

    const isOwner = campaign.business.ownerUserId === user.userId;
    const isAssignedCreator = campaign.assignments.some(
      (a) => a.creator.userId === user.userId,
    );
    if (user.role !== UserRole.ADMIN && !isOwner && !isAssignedCreator) {
      throw new ForbiddenException('You are not a party to this campaign');
    }

    const dispute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.paymentDispute.create({
        data: {
          campaignId,
          campaignFundingId: campaign.funding!.id,
          openedByUserId: user.userId,
          reason: dto.reason.trim(),
          status: DisputeStatus.OPEN,
        },
      });

      await tx.campaignFunding.update({
        where: { id: campaign.funding!.id },
        data: { status: FundingStatus.DISPUTED },
      });

      if (
        canTransitionCampaignStatus(
          campaign.status as unknown as SharedCampaignStatus,
          SharedCampaignStatus.DISPUTED,
        )
      ) {
        await tx.campaign.update({
          where: { id: campaignId },
          data: { status: CampaignStatus.DISPUTED },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: user.userId,
          action: 'PAYMENT_DISPUTE_OPENED',
          entityType: 'PaymentDispute',
          entityId: created.id,
          metadata: { campaignId, reason: dto.reason.trim() },
        },
      });

      return created;
    });

    if (!isOwner) {
      await this.notifications.create({
        userId: campaign.business.ownerUserId,
        type: NotificationType.DISPUTE_OPENED,
        title: `Dispute opened: ${campaign.title}`,
        message: `A campaign dispute has been submitted for review.`,
        metadata: { campaignId, disputeId: dispute.id },
      });
    }

    return dispute;
  }

  async requestRefund(user: AuthUser, campaignId: string, reason?: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { business: true, funding: true },
    });
    if (!campaign || !campaign.funding) {
      throw new NotFoundException('Funded campaign not found');
    }
    if (
      user.role !== UserRole.ADMIN &&
      campaign.business.ownerUserId !== user.userId
    ) {
      throw new ForbiddenException('Only the campaign business owner can request a refund');
    }
    if (campaign.funding.status === FundingStatus.RELEASED) {
      throw new BadRequestException('Cannot refund after payout has been released');
    }

    return this.openDispute(user, campaignId, {
      reason: reason?.trim() || 'Business requested campaign refund review',
    });
  }

  async listAllDisputes() {
    return this.prisma.paymentDispute.findMany({
      include: {
        campaign: {
          select: {
            id: true,
            title: true,
            status: true,
            business: { select: { id: true, name: true } },
          },
        },
        campaignFunding: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveDispute(
    adminUserId: string,
    disputeId: string,
    dto: ResolveDisputeDto,
  ) {
    const dispute = await this.prisma.paymentDispute.findUnique({
      where: { id: disputeId },
      include: { campaignFunding: true, campaign: true },
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const resolved = await tx.paymentDispute.update({
        where: { id: dispute.id },
        data: {
          status: dto.resolution as DisputeStatus,
          resolutionNotes: dto.resolutionNotes.trim(),
          resolvedByUserId: adminUserId,
          resolvedAt: new Date(),
        },
      });

      if (dto.resolution === 'RESOLVED_RELEASE') {
        await tx.campaignFunding.update({
          where: { id: dispute.campaignFundingId },
          data: { status: FundingStatus.RELEASED, releasedAt: new Date() },
        });
        await tx.paymentTransaction.create({
          data: {
            campaignFundingId: dispute.campaignFundingId,
            type: PaymentTransactionType.PAYOUT_RELEASE,
            amountKobo: dispute.campaignFunding.creatorNetKobo,
            idempotencyKey: `dispute_release_${dispute.id}`,
            status: PaymentTransactionStatus.SUCCEEDED,
          },
        });
        await tx.campaign.update({
          where: { id: dispute.campaignId },
          data: { status: CampaignStatus.PAYMENT_RELEASED },
        });
      } else if (dto.resolution === 'RESOLVED_REFUND') {
        await tx.campaignFunding.update({
          where: { id: dispute.campaignFundingId },
          data: { status: FundingStatus.REFUNDED },
        });
        await tx.paymentTransaction.create({
          data: {
            campaignFundingId: dispute.campaignFundingId,
            type: PaymentTransactionType.REFUND,
            amountKobo: dispute.campaignFunding.amountKobo,
            idempotencyKey: `dispute_refund_${dispute.id}`,
            status: PaymentTransactionStatus.SUCCEEDED,
          },
        });
        await tx.campaign.update({
          where: { id: dispute.campaignId },
          data: { status: CampaignStatus.REFUNDED },
        });
      } else {
        await tx.campaignFunding.update({
          where: { id: dispute.campaignFundingId },
          data: { status: FundingStatus.HELD_BY_PARTNER },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: adminUserId,
          action: 'PAYMENT_DISPUTE_RESOLVED',
          entityType: 'PaymentDispute',
          entityId: dispute.id,
          metadata: {
            resolution: dto.resolution,
            resolutionNotes: dto.resolutionNotes.trim(),
          },
        },
      });

      return resolved;
    });
  }

  async handlePaymentWebhook(
    provider: string,
    rawBody: string,
    signatureHeader: string | undefined,
    payload: { event?: string; data?: { reference?: string; amount?: number } },
  ) {
    if (provider.toLowerCase() === 'paystack') {
      const secret = this.configService.get<string>('PAYSTACK_SECRET_KEY');
      if (secret) {
        if (!signatureHeader) {
          throw new UnauthorizedException('Missing webhook signature');
        }
        const computed = createHmac('sha512', secret)
          .update(rawBody)
          .digest('hex');
        const sigBuf = Buffer.from(signatureHeader, 'utf8');
        const expBuf = Buffer.from(computed, 'utf8');
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          throw new UnauthorizedException('Invalid Paystack webhook signature');
        }
      }
    }

    const reference = payload?.data?.reference;
    if (payload?.event === 'charge.success' && reference) {
      const funding = await this.prisma.campaignFunding.findUnique({
        where: { providerReference: reference },
      });
      if (funding && funding.status === FundingStatus.PENDING_PAYMENT) {
        await this.prisma.$transaction(async (tx) => {
          await tx.campaignFunding.update({
            where: { id: funding.id },
            data: { status: FundingStatus.HELD_BY_PARTNER, fundedAt: new Date() },
          });
          await tx.paymentTransaction.upsert({
            where: { idempotencyKey: `webhook_${reference}` },
            create: {
              campaignFundingId: funding.id,
              type: PaymentTransactionType.FUNDING,
              amountKobo: funding.amountKobo,
              providerReference: reference,
              idempotencyKey: `webhook_${reference}`,
              status: PaymentTransactionStatus.SUCCEEDED,
            },
            update: {},
          });
          await tx.campaign.update({
            where: { id: funding.campaignId },
            data: { status: CampaignStatus.FUNDED },
          });
        });
      }
    }

    return { received: true, provider };
  }
}
