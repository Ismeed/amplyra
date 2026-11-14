import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CampaignStatus,
  DisputeStatus,
  FundingStatus,
  PaymentTransactionType,
} from '@prisma/client';
import { UserRole } from '@amplyra/shared';
import { createHmac } from 'crypto';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const mockNotifications = {
    create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  };

  function buildService() {
    const mockPrisma: any = {
      business: { findUnique: jest.fn() },
      campaign: { findUnique: jest.fn(), update: jest.fn() },
      campaignFunding: { upsert: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      paymentTransaction: { findUnique: jest.fn(), create: jest.fn(), createMany: jest.fn(), upsert: jest.fn() },
      paymentDispute: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      campaignAssignment: { updateMany: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
    };

    const configService = new ConfigService({
      PAYSTACK_SECRET_KEY: '',
    });

    const service = new PaymentsService(
      mockPrisma,
      configService,
      mockNotifications as any,
    );
    return { service, mockPrisma };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('funds a campaign idempotently with 10% platform fee split in kobo', async () => {
    const { service, mockPrisma } = buildService();
    mockPrisma.business.findUnique.mockResolvedValue({
      id: 'biz-1',
      ownerUserId: 'user-biz-1',
      owner: { email: 'founder@katsinathreadz.ng' },
    });
    mockPrisma.campaign.findUnique.mockResolvedValue({
      id: 'camp-1',
      businessId: 'biz-1',
      title: 'Harmattan Launch',
      budgetKobo: 5_000_000,
      status: CampaignStatus.CREATOR_SELECTED,
      funding: null,
      assignments: [{ creator: { userId: 'user-creator-1' } }],
    });
    mockPrisma.paymentTransaction.findUnique.mockResolvedValue(null);
    mockPrisma.campaignFunding.upsert.mockImplementation(async ({ create }: any) => ({
      id: 'fund-1',
      ...create,
    }));

    const res = await service.fundCampaign('user-biz-1', {
      campaignId: 'camp-1',
      idempotencyKey: 'idem-1',
    });

    expect(res.funding.amountKobo).toBe(5_000_000);
    expect(res.funding.platformFeeKobo).toBe(500_000);
    expect(res.funding.creatorNetKobo).toBe(4_500_000);
    expect(res.funding.status).toBe(FundingStatus.HELD_BY_PARTNER);
    expect(mockPrisma.paymentTransaction.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ type: PaymentTransactionType.FUNDING, amountKobo: 5_000_000 }),
          expect.objectContaining({ type: PaymentTransactionType.FEE, amountKobo: 500_000 }),
        ]),
      }),
    );
  });

  it('blocks payout release when an open dispute exists', async () => {
    const { service, mockPrisma } = buildService();
    mockPrisma.campaign.findUnique.mockResolvedValue({
      id: 'camp-1',
      business: { ownerUserId: 'user-biz-1' },
      posts: [{ retentionUntil: new Date(Date.now() - 1000) }],
      assignments: [],
      funding: {
        id: 'fund-1',
        status: FundingStatus.DISPUTED,
        disputes: [{ status: DisputeStatus.OPEN }],
      },
    });

    await expect(
      service.releasePayment(
        {
          userId: 'user-biz-1',
          email: 'founder@katsinathreadz.ng',
          role: UserRole.BUSINESS,
          fullName: 'Amina',
        },
        'camp-1',
        {},
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('verifies Paystack HMAC-SHA512 webhook signature and rejects invalid signatures', async () => {
    const mockPrisma: any = {
      campaignFunding: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const configWithSecret = new ConfigService({
      PAYSTACK_SECRET_KEY: 'sk_test_amplyra_secret',
    });
    const service = new PaymentsService(
      mockPrisma,
      configWithSecret,
      mockNotifications as any,
    );

    const payload = { event: 'charge.success', data: { reference: 'AMP_123' } };
    const rawBody = JSON.stringify(payload);
    const validSig = createHmac('sha512', 'sk_test_amplyra_secret')
      .update(rawBody)
      .digest('hex');

    await expect(
      service.handlePaymentWebhook('paystack', rawBody, 'bad_signature', payload),
    ).rejects.toThrow(UnauthorizedException);

    const ok = await service.handlePaymentWebhook(
      'paystack',
      rawBody,
      validSig,
      payload,
    );
    expect(ok).toEqual({ received: true, provider: 'paystack' });
  });

  it('enforces 15-day post retention lock on creator withdrawal and recalculates AI benchmark after settlement', async () => {
    const mockVerification = {
      recalculateCreatorBenchmarkAndTier: jest.fn().mockResolvedValue({
        tier: 'TIER_3',
        overallAvgEngagement: 5.4,
      }),
    };
    const mockPrisma: any = {
      creator: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cr-1',
          userId: 'user-cr-1',
          displayName: 'Zainab Styles',
        }),
      },
      campaign: { findUnique: jest.fn(), update: jest.fn() },
      campaignFunding: { update: jest.fn() },
      paymentTransaction: { create: jest.fn() },
      campaignAssignment: { updateMany: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
    };

    const service = new PaymentsService(
      mockPrisma,
      new ConfigService({ PAYSTACK_SECRET_KEY: '' }),
      mockNotifications as any,
      mockVerification as any,
    );

    const futureUnlock = new Date(Date.now() + 7 * 86_400_000);
    mockPrisma.campaign.findUnique.mockResolvedValueOnce({
      id: 'camp-1',
      title: 'Harmattan Launch',
      business: { ownerUserId: 'user-biz-1' },
      assignments: [{ creatorId: 'cr-1', creator: { userId: 'user-cr-1' } }],
      posts: [{ retentionUntil: futureUnlock }],
      funding: {
        id: 'fund-1',
        status: FundingStatus.HELD_BY_PARTNER,
        creatorNetKobo: 4_500_000,
        providerReference: 'AMP_REF_1',
        disputes: [],
      },
    });

    await expect(
      service.withdrawCreatorEarnings('user-cr-1', 'camp-1'),
    ).rejects.toThrow(BadRequestException);

    const pastUnlock = new Date(Date.now() - 3_600_000);
    mockPrisma.campaign.findUnique.mockResolvedValueOnce({
      id: 'camp-1',
      title: 'Harmattan Launch',
      business: { ownerUserId: 'user-biz-1' },
      assignments: [{ creatorId: 'cr-1', creator: { userId: 'user-cr-1' } }],
      posts: [{ retentionUntil: pastUnlock }],
      funding: {
        id: 'fund-1',
        status: FundingStatus.HELD_BY_PARTNER,
        creatorNetKobo: 4_500_000,
        providerReference: 'AMP_REF_1',
        disputes: [],
      },
    });
    mockPrisma.campaignFunding.update.mockResolvedValue({
      id: 'fund-1',
      status: FundingStatus.RELEASED,
      creatorNetKobo: 4_500_000,
    });

    const withdrawn = await service.withdrawCreatorEarnings('user-cr-1', 'camp-1');
    expect(withdrawn.status).toBe(FundingStatus.RELEASED);
    expect(mockVerification.recalculateCreatorBenchmarkAndTier).toHaveBeenCalledWith(
      'cr-1',
    );
  });
});
