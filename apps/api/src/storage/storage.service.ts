import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StoragePurpose, UploadedFileStatus } from '@prisma/client';
import {
  StoragePurpose as SharedStoragePurpose,
  UserRole,
} from '@amplyra/shared';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUploadUrlDto } from './dto/storage.dto';

const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const CAMPAIGN_MEDIA_MIME_EXTENSIONS: Record<string, string> = {
  ...IMAGE_MIME_EXTENSIONS,
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
};

interface PurposePolicy {
  allowedRoles: UserRole[];
  bucketKind: 'private' | 'public';
  folder: string;
  maxBytes: number;
  allowedMimes: Record<string, string>;
  requiresCampaign: boolean;
}

const PURPOSE_POLICIES: Record<SharedStoragePurpose, PurposePolicy> = {
  [SharedStoragePurpose.EVIDENCE_SCREENSHOT]: {
    allowedRoles: [UserRole.CREATOR, UserRole.ADMIN],
    bucketKind: 'private',
    folder: 'evidence-screenshots',
    maxBytes: 10 * 1024 * 1024,
    allowedMimes: IMAGE_MIME_EXTENSIONS,
    requiresCampaign: true,
  },
  [SharedStoragePurpose.CAMPAIGN_MEDIA]: {
    allowedRoles: [UserRole.BUSINESS, UserRole.ADMIN],
    bucketKind: 'private',
    folder: 'campaign-media',
    maxBytes: 20 * 1024 * 1024,
    allowedMimes: CAMPAIGN_MEDIA_MIME_EXTENSIONS,
    requiresCampaign: false,
  },
  [SharedStoragePurpose.CREATOR_AVATAR]: {
    allowedRoles: [UserRole.CREATOR, UserRole.ADMIN],
    bucketKind: 'public',
    folder: 'creator-avatars',
    maxBytes: 5 * 1024 * 1024,
    allowedMimes: IMAGE_MIME_EXTENSIONS,
    requiresCampaign: false,
  },
  [SharedStoragePurpose.BUSINESS_LOGO]: {
    allowedRoles: [UserRole.BUSINESS, UserRole.ADMIN],
    bucketKind: 'public',
    folder: 'business-logos',
    maxBytes: 5 * 1024 * 1024,
    allowedMimes: IMAGE_MIME_EXTENSIONS,
    requiresCampaign: false,
  },
};

@Injectable()
export class StorageService {
  private client: SupabaseClient | null = null;
  private readonly ensuredBuckets = new Set<string>();
  private readonly bucketInFlight = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.getSupabaseUrl() && this.getSupabaseServiceKey());
  }

  getBucketNames() {
    return {
      privateBucket:
        this.configService.get<string>('SUPABASE_STORAGE_PRIVATE_BUCKET') ||
        'amplyra-private',
      publicBucket:
        this.configService.get<string>('SUPABASE_STORAGE_PUBLIC_BUCKET') ||
        'amplyra-public',
    };
  }

  getStatus() {
    const { privateBucket, publicBucket } = this.getBucketNames();
    return {
      provider: 'supabase-storage',
      configured: this.isConfigured(),
      privateBucket,
      publicBucket,
    };
  }

  /** Creates a Supabase signed upload URL and tracks a pending file record. */
  async createUploadSession(user: AuthUser, dto: CreateUploadUrlDto) {
    const policy = PURPOSE_POLICIES[dto.purpose];
    if (!policy) {
      throw new BadRequestException('Unsupported storage upload purpose');
    }

    if (!policy.allowedRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Role ${user.role} cannot upload ${dto.purpose} files`,
      );
    }

    const normalizedMime = dto.mimeType.trim().toLowerCase();
    const ext = policy.allowedMimes[normalizedMime];
    if (!ext) {
      throw new BadRequestException(
        `Unsupported file type ${normalizedMime}. Allowed: ${Object.keys(policy.allowedMimes).join(', ')}`,
      );
    }

    if (dto.sizeBytes > policy.maxBytes) {
      const maxMb = Math.round(policy.maxBytes / (1024 * 1024));
      throw new BadRequestException(
        `File exceeds maximum size of ${maxMb}MB for ${dto.purpose}`,
      );
    }

    if (policy.requiresCampaign && !dto.campaignId) {
      throw new BadRequestException(
        `campaignId is required when uploading ${dto.purpose}`,
      );
    }

    if (dto.campaignId) {
      await this.assertCampaignUploadPermission(user, dto.campaignId, dto.purpose);
    }

    const supabase = this.requireSupabaseClient();
    const { privateBucket, publicBucket } = this.getBucketNames();
    const bucket = policy.bucketKind === 'public' ? publicBucket : privateBucket;
    await this.ensureBucket(supabase, bucket, policy.bucketKind === 'public');

    const objectPath = `${policy.folder}/${user.userId}/${randomUUID()}.${ext}`;
    const fileRecord = await this.prisma.uploadedFile.create({
      data: {
        ownerUserId: user.userId,
        purpose: dto.purpose as unknown as StoragePurpose,
        bucket,
        objectPath,
        originalName: dto.fileName.trim(),
        mimeType: normalizedMime,
        sizeBytes: dto.sizeBytes,
        status: UploadedFileStatus.PENDING,
        campaignId: dto.campaignId ?? null,
      },
    });

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(objectPath, { upsert: false });

    if (error || !data) {
      await this.prisma.uploadedFile
        .delete({ where: { id: fileRecord.id } })
        .catch(() => undefined);
      throw new ServiceUnavailableException(
        `Failed to create Supabase signed upload URL: ${error?.message || 'unknown error'}`,
      );
    }

    const publicUrl =
      policy.bucketKind === 'public'
        ? supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl
        : null;

    return {
      file: fileRecord,
      upload: {
        signedUrl: data.signedUrl,
        token: data.token,
        path: data.path,
        bucket,
        method: 'PUT' as const,
        maxBytes: policy.maxBytes,
      },
      publicUrl,
    };
  }

  /** Verifies that an uploaded object exists in Supabase Storage and marks it READY. */
  async confirmUpload(user: AuthUser, fileId: string) {
    const file = await this.prisma.uploadedFile.findUnique({
      where: { id: fileId },
    });
    if (!file) {
      throw new NotFoundException('Uploaded file record not found');
    }

    if (file.ownerUserId !== user.userId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only confirm your own uploads');
    }

    const supabase = this.requireSupabaseClient();
    const { data: exists, error: existsError } = await supabase.storage
      .from(file.bucket)
      .exists(file.objectPath);

    if (existsError) {
      throw new ServiceUnavailableException(
        `Unable to verify file in Supabase Storage: ${existsError.message}`,
      );
    }

    if (!exists) {
      throw new BadRequestException(
        'Uploaded file object was not found in Supabase Storage yet',
      );
    }

    const updated = await this.prisma.uploadedFile.update({
      where: { id: file.id },
      data: { status: UploadedFileStatus.READY },
    });

    const access = await this.buildAccessPayload(supabase, updated);
    return {
      file: updated,
      ...access,
    };
  }

  /** Issues a short-lived signed download URL (private buckets) or public URL after RBAC checks. */
  async getAuthorizedAccessUrl(user: AuthUser, fileId: string) {
    const file = await this.prisma.uploadedFile.findUnique({
      where: { id: fileId },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    await this.assertFileReadAccess(user, file);
    const supabase = this.requireSupabaseClient();
    return this.buildAccessPayload(supabase, file);
  }

  /** Lists campaign-scoped uploaded files with authorized preview URLs when Storage is configured. */
  async listCampaignFiles(user: AuthUser, campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { business: { select: { ownerUserId: true } } },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (user.role === UserRole.BUSINESS && campaign.business.ownerUserId !== user.userId) {
      throw new ForbiddenException('You can only inspect files for your own campaigns');
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

    const files = await this.prisma.uploadedFile.findMany({
      where: {
        campaignId,
        status: UploadedFileStatus.READY,
        ...(user.role === UserRole.CREATOR
          ? {
              OR: [
                { purpose: StoragePurpose.CAMPAIGN_MEDIA },
                { ownerUserId: user.userId },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!this.isConfigured()) {
      return files.map((file) => ({ ...file, accessUrl: null }));
    }

    const supabase = this.requireSupabaseClient();
    return Promise.all(
      files.map(async (file) => {
        const access = await this.buildAccessPayload(supabase, file).catch(() => null);
        return {
          ...file,
          accessUrl: access?.url ?? null,
        };
      }),
    );
  }

  private getSupabaseUrl(): string | undefined {
    return this.configService.get<string>('SUPABASE_URL')?.trim() || undefined;
  }

  private getSupabaseServiceKey(): string | undefined {
    return (
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
      this.configService.get<string>('SUPABASE_SECRET_KEY')?.trim() ||
      undefined
    );
  }

  private requireSupabaseClient(): SupabaseClient {
    const url = this.getSupabaseUrl();
    const key = this.getSupabaseServiceKey();
    if (!url || !key) {
      throw new ServiceUnavailableException(
        'Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    if (!this.client) {
      this.client = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
    return this.client;
  }

  private async ensureBucket(
    supabase: SupabaseClient,
    bucketName: string,
    isPublic: boolean,
  ): Promise<void> {
    if (this.ensuredBuckets.has(bucketName)) {
      return;
    }

    const pending = this.bucketInFlight.get(bucketName);
    if (pending) {
      return pending;
    }

    const promise = (async () => {
      const { data: existing, error: getError } =
        await supabase.storage.getBucket(bucketName);

      if (existing) {
        this.ensuredBuckets.add(bucketName);
        return;
      }

      const notFound =
        getError?.message?.toLowerCase().includes('not found') ||
        (getError as { statusCode?: string | number } | null)?.statusCode === 404 ||
        (getError as { statusCode?: string | number } | null)?.statusCode === '404';

      if (getError && !notFound) {
        throw new ServiceUnavailableException(
          `Unable to check Supabase Storage bucket "${bucketName}": ${getError.message}`,
        );
      }

      const { error: createError } = await supabase.storage.createBucket(
        bucketName,
        {
          public: isPublic,
          fileSizeLimit: 20 * 1024 * 1024,
          allowedMimeTypes: Object.keys(CAMPAIGN_MEDIA_MIME_EXTENSIONS),
        },
      );

      if (
        createError &&
        !createError.message.toLowerCase().includes('already exists')
      ) {
        throw new ServiceUnavailableException(
          `Unable to create Supabase Storage bucket "${bucketName}": ${createError.message}`,
        );
      }

      this.ensuredBuckets.add(bucketName);
    })().finally(() => {
      this.bucketInFlight.delete(bucketName);
    });

    this.bucketInFlight.set(bucketName, promise);
    return promise;
  }

  private async assertCampaignUploadPermission(
    user: AuthUser,
    campaignId: string,
    purpose: SharedStoragePurpose,
  ): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { business: { select: { ownerUserId: true } } },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (user.role === UserRole.ADMIN) {
      return;
    }

    if (purpose === SharedStoragePurpose.EVIDENCE_SCREENSHOT) {
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
        throw new ForbiddenException(
          'You must be assigned to this campaign to upload evidence',
        );
      }
      return;
    }

    if (campaign.business.ownerUserId !== user.userId) {
      throw new ForbiddenException(
        'Only the campaign business owner can upload media to this campaign',
      );
    }
  }

  private async assertFileReadAccess(
    user: AuthUser,
    file: {
      ownerUserId: string;
      purpose: StoragePurpose;
      campaignId: string | null;
    },
  ): Promise<void> {
    if (
      file.purpose === StoragePurpose.CREATOR_AVATAR ||
      file.purpose === StoragePurpose.BUSINESS_LOGO
    ) {
      return;
    }

    if (file.ownerUserId === user.userId || user.role === UserRole.ADMIN) {
      return;
    }

    if (!file.campaignId) {
      throw new ForbiddenException('You do not have access to this file');
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: file.campaignId },
      include: { business: { select: { ownerUserId: true } } },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (
      user.role === UserRole.BUSINESS &&
      campaign.business.ownerUserId === user.userId
    ) {
      return;
    }

    if (
      user.role === UserRole.CREATOR &&
      file.purpose === StoragePurpose.CAMPAIGN_MEDIA
    ) {
      const creator = await this.prisma.creator.findUnique({
        where: { userId: user.userId },
      });
      if (creator) {
        const assignment = await this.prisma.campaignAssignment.findUnique({
          where: {
            campaignId_creatorId: {
              campaignId: file.campaignId,
              creatorId: creator.id,
            },
          },
        });
        if (assignment) {
          return;
        }
      }
    }

    throw new ForbiddenException('You do not have access to this private file');
  }

  private async buildAccessPayload(
    supabase: SupabaseClient,
    file: {
      id: string;
      bucket: string;
      objectPath: string;
      purpose: StoragePurpose;
    },
  ) {
    const isPublic =
      file.purpose === StoragePurpose.CREATOR_AVATAR ||
      file.purpose === StoragePurpose.BUSINESS_LOGO;

    if (isPublic) {
      const { data } = supabase.storage
        .from(file.bucket)
        .getPublicUrl(file.objectPath);
      return {
        fileId: file.id,
        url: data.publicUrl,
        expiresInSeconds: null,
        isPublic: true,
      };
    }

    const expiresInSeconds = 300;
    const { data, error } = await supabase.storage
      .from(file.bucket)
      .createSignedUrl(file.objectPath, expiresInSeconds);

    if (error || !data) {
      throw new ServiceUnavailableException(
        `Failed to create signed download URL: ${error?.message || 'unknown error'}`,
      );
    }

    return {
      fileId: file.id,
      url: data.signedUrl,
      expiresInSeconds,
      isPublic: false,
    };
  }
}
