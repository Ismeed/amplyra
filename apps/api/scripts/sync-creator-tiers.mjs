import { PrismaClient } from '@prisma/client';
import { computeCreatorTier, inferTierFromBudgetKobo } from '@amplyra/shared';

const prisma = new PrismaClient();

async function main() {
  const creators = await prisma.creator.findMany({
    include: { socialAccounts: true },
  });

  for (const creator of creators) {
    const maxFollowers = creator.socialAccounts.reduce(
      (max, sa) => Math.max(max, sa.followersCount),
      0,
    );
    const rated = creator.socialAccounts.filter(
      (sa) => typeof sa.avgEngagementRate === 'number',
    );
    const profileAvgEngagementPct =
      rated.length > 0
        ? rated.reduce((sum, sa) => sum + (sa.avgEngagementRate ?? 0), 0) /
          rated.length
        : null;

    const computed = computeCreatorTier({
      maxFollowers,
      profileAvgEngagementPct,
      overallAvgEngagementPct: creator.overallAvgEngagement,
      completedDealsCount: creator.completedDealsCount,
    });

    await prisma.creator.update({
      where: { id: creator.id },
      data: {
        tier: computed.tier,
        fixedPriceKobo: computed.fixedPriceKobo,
        minRateKobo: computed.fixedPriceKobo,
      },
    });
  }

  const campaigns = await prisma.campaign.findMany();
  for (const campaign of campaigns) {
    const inferred = inferTierFromBudgetKobo(
      Math.round(campaign.budgetKobo / Math.max(1, campaign.creatorsNeeded)),
    );
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { targetTier: inferred.tier },
    });
  }

  console.log(
    `Synchronized ${creators.length} creator(s) and ${campaigns.length} campaign(s) to fixed Tier definitions.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
