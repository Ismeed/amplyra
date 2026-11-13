import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StoragePurpose, UploadedFileStatus } from '@prisma/client';
import { StoragePurpose as SharedStoragePurpose, UserRole } from '@amplyra/shared';
import { StorageService } from './storage.service';

function makeConfig(values: Record<string, string | undefined> = {}): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('StorageService (Supabase Storage)', () => {
  it('rejects disallowed MIME types like SVG to prevent stored XSS', async () => {
    const mockPrisma: any = {};
    const service = new StorageService(mockPrisma, makeConfig());

    await expect(
      service.createUploadSession(
        { userId: 'u-1', email: 'c@test.com', role: UserRole.CREATOR, fullName: 'Creator One' },
        {
          purpose: SharedStoragePurpose.EVIDENCE_SCREENSHOT,
          fileName: 'payload.svg',
          mimeType: 'image/svg+xml',
          sizeBytes: 1024,
          campaignId: 'camp-1',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects evidence screenshot upload when creator is not assigned to campaign', async () => {
    const mockPrisma: any = {
      campaign: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'camp-1',
          business: { ownerUserId: 'biz-owner-1' },
        }),
      },
      creator: { findUnique: jest.fn().mockResolvedValue({ id: 'cr-1' }) },
      campaignAssignment: { findUnique: jest.fn().mockResolvedValue(null) },
    };

    const service = new StorageService(mockPrisma, makeConfig());

    await expect(
      service.createUploadSession(
        { userId: 'u-cr-1', email: 'c@test.com', role: UserRole.CREATOR, fullName: 'Creator One' },
        {
          purpose: SharedStoragePurpose.EVIDENCE_SCREENSHOT,
          fileName: 'day5.png',
          mimeType: 'image/png',
          sizeBytes: 2048,
          campaignId: 'camp-1',
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('fails cleanly when Supabase Storage credentials are missing', async () => {
    const mockPrisma: any = {};
    const service = new StorageService(mockPrisma, makeConfig());

    expect(service.isConfigured()).toBe(false);
    await expect(
      service.createUploadSession(
        { userId: 'u-cr-1', email: 'c@test.com', role: UserRole.CREATOR, fullName: 'Creator One' },
        {
          purpose: SharedStoragePurpose.CREATOR_AVATAR,
          fileName: 'avatar.png',
          mimeType: 'image/png',
          sizeBytes: 1024,
        },
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('creates signed upload URL in private bucket for assigned creator and resolves signed read URL only for authorized owners', async () => {
    const mockPrisma: any = {
      campaign: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'camp-1',
          business: { ownerUserId: 'biz-owner-1' },
        }),
      },
      creator: { findUnique: jest.fn().mockResolvedValue({ id: 'cr-1' }) },
      campaignAssignment: { findUnique: jest.fn().mockResolvedValue({ id: 'asgn-1' }) },
      uploadedFile: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'file-1',
          ...data,
        })),
        findUnique: jest.fn().mockResolvedValue({
          id: 'file-1',
          ownerUserId: 'u-cr-1',
          purpose: StoragePurpose.EVIDENCE_SCREENSHOT,
          bucket: 'amplyra-private',
          objectPath: 'evidence-screenshots/u-cr-1/abc.png',
          status: UploadedFileStatus.READY,
          campaignId: 'camp-1',
        }),
      },
    };

    const service = new StorageService(
      mockPrisma,
      makeConfig({
        SUPABASE_URL: 'https://demo.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret-key',
      }),
    );

    const bucketMock = {
      createSignedUploadUrl: jest.fn().mockResolvedValue({
        data: {
          signedUrl: 'https://demo.supabase.co/storage/v1/object/upload/sign/amplyra-private/obj?token=t1',
          token: 't1',
          path: 'evidence-screenshots/u-cr-1/abc.png',
        },
        error: null,
      }),
      createSignedUrl: jest.fn().mockResolvedValue({
        data: {
          signedUrl: 'https://demo.supabase.co/storage/v1/object/sign/amplyra-private/obj?token=read1',
        },
        error: null,
      }),
    };

    (service as any).client = {
      storage: {
        getBucket: jest.fn().mockResolvedValue({ data: { name: 'amplyra-private' }, error: null }),
        from: jest.fn().mockReturnValue(bucketMock),
      },
    };

    const session = await service.createUploadSession(
      { userId: 'u-cr-1', email: 'c@test.com', role: UserRole.CREATOR, fullName: 'Creator One' },
      {
        purpose: SharedStoragePurpose.EVIDENCE_SCREENSHOT,
        fileName: 'day5.png',
        mimeType: 'image/png',
        sizeBytes: 4096,
        campaignId: 'camp-1',
      },
    );

    expect(session.upload.bucket).toBe('amplyra-private');
    expect(session.publicUrl).toBeNull();
    expect(session.upload.signedUrl).toContain('token=t1');

    // Unrelated business cannot read creator's private evidence screenshot
    await expect(
      service.getAuthorizedAccessUrl(
        { userId: 'other-biz', email: 'o@test.com', role: UserRole.BUSINESS, fullName: 'Other Business' },
        'file-1',
      ),
    ).rejects.toThrow(ForbiddenException);

    // Campaign owner can fetch short-lived signed download URL
    const access = await service.getAuthorizedAccessUrl(
      { userId: 'biz-owner-1', email: 'b@test.com', role: UserRole.BUSINESS, fullName: 'Business Owner' },
      'file-1',
    );
    expect(access.isPublic).toBe(false);
    expect(access.expiresInSeconds).toBe(300);
    expect(access.url).toContain('token=read1');
  });
});
