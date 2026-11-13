import {
  CampaignStatus,
  PrismaClient,
  SocialPlatform,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('AmplyraDemo123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@amplyra.ai' },
    update: {},
    create: {
      email: 'admin@amplyra.ai',
      passwordHash,
      fullName: 'Amplyra Operations Admin',
      role: UserRole.ADMIN,
      emailVerifiedAt: new Date(),
    },
  });

  const businessUser = await prisma.user.upsert({
    where: { email: 'founder@katsinathreadz.ng' },
    update: {},
    create: {
      email: 'founder@katsinathreadz.ng',
      passwordHash,
      fullName: 'Amina Bello',
      role: UserRole.BUSINESS,
      emailVerifiedAt: new Date(),
    },
  });

  const business = await prisma.business.upsert({
    where: { ownerUserId: businessUser.id },
    update: {},
    create: {
      ownerUserId: businessUser.id,
      name: 'Katsina Threadz',
      industry: 'Fashion & Apparel',
      description:
        'Contemporary northern Nigerian womenswear and handcrafted modest fashion brand.',
      productsServices: 'Ready-to-wear kaftans, embroidered abayas, seasonal capsules',
      targetAudience: 'Style-conscious women aged 20-40 across Northern Nigeria & Lagos',
      country: 'Nigeria',
      state: 'Katsina',
      city: 'Katsina',
      brandTone: 'Warm, confident, culturally rooted, modern',
      monthlyBudgetKobo: 30_000_000, // ₦300,000
      verifiedAt: new Date(),
    },
  });

  const creatorSeedData = [
    {
      email: 'zainab@creators.amplyra.ai',
      fullName: 'Zainab Musa',
      displayName: 'Zainab Styles',
      bio: 'Modest fashion & beauty creator showcasing northern Nigerian style, lookbooks, and retail finds.',
      country: 'Nigeria',
      state: 'Katsina',
      city: 'Katsina',
      categories: ['Fashion', 'Beauty', 'Lifestyle'],
      niches: ['Modest Fashion', 'Retail Reviews'],
      minRateKobo: 2_500_000, // ₦25,000
      maxRateKobo: 7_500_000, // ₦75,000
      socials: [
        {
          platform: SocialPlatform.INSTAGRAM,
          handle: 'zainabstyles.ng',
          followersCount: 28400,
          avgEngagementRate: 5.4,
        },
        {
          platform: SocialPlatform.TIKTOK,
          handle: 'zainabstyles',
          followersCount: 41200,
          avgEngagementRate: 6.8,
        },
      ],
    },
    {
      email: 'tunde@creators.amplyra.ai',
      fullName: 'Tunde Adeyemi',
      displayName: 'Lagos Plate & Street',
      bio: 'Food & restaurant storyteller covering SME eateries, cafés, and weekend food spots across Lagos.',
      country: 'Nigeria',
      state: 'Lagos',
      city: 'Lagos',
      categories: ['Food', 'Lifestyle'],
      niches: ['Restaurant Reviews', 'Street Food'],
      minRateKobo: 4_000_000, // ₦40,000
      maxRateKobo: 12_000_000, // ₦120,000
      socials: [
        {
          platform: SocialPlatform.INSTAGRAM,
          handle: 'lagosplate',
          followersCount: 52000,
          avgEngagementRate: 4.9,
        },
        {
          platform: SocialPlatform.TIKTOK,
          handle: 'lagosplate',
          followersCount: 89000,
          avgEngagementRate: 7.2,
        },
      ],
    },
    {
      email: 'chidi@creators.amplyra.ai',
      fullName: 'Chidi Okafor',
      displayName: 'Chidi Commerce',
      bio: 'Consumer gadgets, fintech & local SME product reviewer helping Nigerian shoppers discover trusted brands.',
      country: 'Nigeria',
      state: 'FCT',
      city: 'Abuja',
      categories: ['Consumer Products', 'Local Services'],
      niches: ['Product Demos', 'Tech & Retail'],
      minRateKobo: 3_500_000,
      maxRateKobo: 9_000_000,
      socials: [
        {
          platform: SocialPlatform.TIKTOK,
          handle: 'chidicommerce',
          followersCount: 34500,
          avgEngagementRate: 5.9,
        },
        {
          platform: SocialPlatform.FACEBOOK,
          handle: 'ChidiCommerceNG',
          followersCount: 19200,
          avgEngagementRate: 3.8,
        },
      ],
    },
  ];

  for (const item of creatorSeedData) {
    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: {},
      create: {
        email: item.email,
        passwordHash,
        fullName: item.fullName,
        role: UserRole.CREATOR,
        emailVerifiedAt: new Date(),
      },
    });

    const creator = await prisma.creator.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        displayName: item.displayName,
        bio: item.bio,
        country: item.country,
        state: item.state,
        city: item.city,
        categories: item.categories,
        niches: item.niches,
        isAvailable: true,
        minRateKobo: item.minRateKobo,
        maxRateKobo: item.maxRateKobo,
        verifiedAt: new Date(),
      },
    });

    for (const s of item.socials) {
      await prisma.creatorSocialAccount.upsert({
        where: {
          creatorId_platform: {
            creatorId: creator.id,
            platform: s.platform,
          },
        },
        update: {},
        create: {
          creatorId: creator.id,
          platform: s.platform,
          handle: s.handle,
          followersCount: s.followersCount,
          avgEngagementRate: s.avgEngagementRate,
        },
      });
    }
  }

  const existingCampaign = await prisma.campaign.findFirst({
    where: { businessId: business.id },
  });

  if (!existingCampaign) {
    await prisma.campaign.create({
      data: {
        businessId: business.id,
        title: 'Katsina Harmattan Capsule Launch',
        productOrService: '2026 Harmattan Modest Linen & Kaftan Collection',
        description:
          'Looking for fashion & lifestyle creators in Katsina and northern Nigeria to showcase styling reels and outfit transitions for our new capsule drop.',
        objectives: 'Drive local showroom visits and WhatsApp catalogue orders',
        targetAudience: 'Women aged 20-38 in Katsina, Kano, and Kaduna',
        preferredCategories: ['Fashion', 'Lifestyle', 'Beauty'],
        targetCountry: 'Nigeria',
        targetState: 'Katsina',
        targetCity: 'Katsina',
        platforms: [SocialPlatform.INSTAGRAM, SocialPlatform.TIKTOK],
        budgetKobo: 5_000_000, // ₦50,000
        creatorsNeeded: 2,
        deliverables: [
          {
            platform: 'INSTAGRAM',
            format: '60s Styling Reel + 2 Story Frames',
            quantity: 1,
            notes: 'Tag @katsinathreadz and keep live for 15 days',
          },
          {
            platform: 'TIKTOK',
            format: '30-45s Outfit Transition Video',
            quantity: 1,
          },
        ],
        retentionDays: 15,
        status: CampaignStatus.APPLICATIONS_OPEN,
      },
    });
  }

  console.log('Seed completed:', { admin: admin.email, business: business.name });
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
