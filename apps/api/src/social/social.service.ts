import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialConnectionStatus, SocialPlatform } from '@prisma/client';
import { SocialPlatform as SharedPlatform } from '@amplyra/shared';
import { createHmac, timingSafeEqual } from 'crypto';
import { TokenCryptoService } from '../common/crypto/token-crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookAdapter, InstagramAdapter, TikTokAdapter } from './adapters';
import { SocialPlatformAdapter } from './social.adapter';

@Injectable()
export class SocialService {
  private readonly adapters: Map<SharedPlatform, SocialPlatformAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly crypto: TokenCryptoService,
  ) {
    this.adapters = new Map<SharedPlatform, SocialPlatformAdapter>([
      [SharedPlatform.INSTAGRAM, new InstagramAdapter(configService)],
      [SharedPlatform.TIKTOK, new TikTokAdapter(configService)],
      [SharedPlatform.FACEBOOK, new FacebookAdapter(configService)],
    ]);
  }

  getAdapter(platform: SharedPlatform): SocialPlatformAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new BadRequestException(
        `OAuth integration is currently supported for Instagram, TikTok, and Facebook (received ${platform})`,
      );
    }
    return adapter;
  }

  async getConnectUrl(
    userId: string,
    platform: SharedPlatform,
    handleHint?: string,
  ) {
    const adapter = this.getAdapter(platform);
    const statePayload = JSON.stringify({
      userId,
      platform,
      handleHint: handleHint?.trim() || undefined,
      ts: Date.now(),
    });
    const encodedState = Buffer.from(statePayload).toString('base64url');
    const sig = this.signState(encodedState);
    const state = `${encodedState}.${sig}`;

    const apiPublicBase = this.getApiPublicBase();
    const redirectUri = `${apiPublicBase}/social/${platform.toLowerCase()}/callback`;

    const authorizationUrl = await adapter.getAuthorizationUrl({
      state,
      redirectUri,
    });

    return {
      platform,
      mode: adapter.isConfiguredForLiveOAuth() ? 'official_oauth' : 'sandbox_oauth',
      authorizationUrl,
      state,
    };
  }

  async handleCallback(params: {
    platform: SharedPlatform;
    code: string;
    state: string;
    handleHint?: string;
    accountNameHint?: string;
  }) {
    const parsedState = this.verifyState(params.state);
    if (parsedState.platform !== params.platform) {
      throw new BadRequestException('OAuth state platform mismatch');
    }

    const adapter = this.getAdapter(params.platform);
    const apiPublicBase = this.getApiPublicBase();
    const redirectUri = `${apiPublicBase}/social/${params.platform.toLowerCase()}/callback`;

    const exchanged = await adapter.exchangeAuthorizationCode({
      code: params.code,
      redirectUri,
      handleHint: params.handleHint ?? parsedState.handleHint,
      accountNameHint: params.accountNameHint,
    });

    const tokenExpiresAt = exchanged.expiresInSeconds
      ? new Date(Date.now() + exchanged.expiresInSeconds * 1000)
      : null;

    const connection = await this.prisma.socialAccountConnection.upsert({
      where: {
        userId_platform_externalAccountId: {
          userId: parsedState.userId,
          platform: params.platform as SocialPlatform,
          externalAccountId: exchanged.externalAccountId,
        },
      },
      create: {
        userId: parsedState.userId,
        platform: params.platform as SocialPlatform,
        externalAccountId: exchanged.externalAccountId,
        accountName: exchanged.accountName,
        accountHandle: exchanged.accountHandle,
        scopes: exchanged.scopes,
        status: SocialConnectionStatus.CONNECTED,
        encryptedAccessToken: this.crypto.encrypt(exchanged.accessToken),
        encryptedRefreshToken: exchanged.refreshToken
          ? this.crypto.encrypt(exchanged.refreshToken)
          : null,
        tokenExpiresAt,
        lastSyncedAt: new Date(),
      },
      update: {
        accountName: exchanged.accountName,
        accountHandle: exchanged.accountHandle,
        scopes: exchanged.scopes,
        status: SocialConnectionStatus.CONNECTED,
        encryptedAccessToken: this.crypto.encrypt(exchanged.accessToken),
        encryptedRefreshToken: exchanged.refreshToken
          ? this.crypto.encrypt(exchanged.refreshToken)
          : undefined,
        tokenExpiresAt,
        lastSyncedAt: new Date(),
      },
    });

    // If user is a creator, mark matching CreatorSocialAccount as OAuth-connected
    const creator = await this.prisma.creator.findUnique({
      where: { userId: parsedState.userId },
    });
    if (creator) {
      await this.prisma.creatorSocialAccount.upsert({
        where: {
          creatorId_platform: {
            creatorId: creator.id,
            platform: params.platform as SocialPlatform,
          },
        },
        create: {
          creatorId: creator.id,
          platform: params.platform as SocialPlatform,
          handle: exchanged.accountHandle,
          followersCount: 0,
          isOAuthConnected: true,
        },
        update: {
          isOAuthConnected: true,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: parsedState.userId,
        action: 'SOCIAL_ACCOUNT_CONNECTED',
        entityType: 'SocialAccountConnection',
        entityId: connection.id,
        metadata: {
          platform: connection.platform,
          scopes: connection.scopes,
        },
      },
    });

    return this.sanitizeConnection(connection);
  }

  async listAccounts(userId: string) {
    const accounts = await this.prisma.socialAccountConnection.findMany({
      where: { userId, status: { not: SocialConnectionStatus.REVOKED } },
      orderBy: { createdAt: 'desc' },
    });
    return accounts.map((a) => this.sanitizeConnection(a));
  }

  async refreshAccount(userId: string, accountId: string) {
    const connection = await this.prisma.socialAccountConnection.findFirst({
      where: { id: accountId, userId },
    });
    if (!connection) {
      throw new NotFoundException('Social account connection not found');
    }
    if (connection.status === SocialConnectionStatus.REVOKED) {
      throw new BadRequestException('Cannot refresh a revoked social connection');
    }

    const adapter = this.getAdapter(connection.platform as SharedPlatform);
    const decryptedRefresh = connection.encryptedRefreshToken
      ? this.crypto.decrypt(connection.encryptedRefreshToken)
      : this.crypto.decrypt(connection.encryptedAccessToken);

    const refreshed = await adapter.refreshAccessToken(decryptedRefresh);
    const updated = await this.prisma.socialAccountConnection.update({
      where: { id: connection.id },
      data: {
        status: SocialConnectionStatus.CONNECTED,
        encryptedAccessToken: this.crypto.encrypt(refreshed.accessToken),
        encryptedRefreshToken: refreshed.refreshToken
          ? this.crypto.encrypt(refreshed.refreshToken)
          : connection.encryptedRefreshToken,
        tokenExpiresAt: refreshed.expiresInSeconds
          ? new Date(Date.now() + refreshed.expiresInSeconds * 1000)
          : connection.tokenExpiresAt,
        lastSyncedAt: new Date(),
      },
    });

    return this.sanitizeConnection(updated);
  }

  async disconnectAccount(userId: string, accountId: string) {
    const connection = await this.prisma.socialAccountConnection.findFirst({
      where: { id: accountId, userId },
    });
    if (!connection) {
      throw new NotFoundException('Social account connection not found');
    }

    const adapter = this.getAdapter(connection.platform as SharedPlatform);
    await adapter.revokeAccess(this.crypto.decrypt(connection.encryptedAccessToken));

    await this.prisma.socialAccountConnection.update({
      where: { id: connection.id },
      data: {
        status: SocialConnectionStatus.REVOKED,
        encryptedAccessToken: 'REVOKED',
        encryptedRefreshToken: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'SOCIAL_ACCOUNT_REVOKED',
        entityType: 'SocialAccountConnection',
        entityId: connection.id,
      },
    });

    return { disconnected: true };
  }

  async fetchLiveMetricsIfAvailable(
    userId: string,
    platform: SharedPlatform,
    postId: string,
  ) {
    const connection = await this.prisma.socialAccountConnection.findFirst({
      where: {
        userId,
        platform: platform as SocialPlatform,
        status: SocialConnectionStatus.CONNECTED,
      },
    });
    if (!connection) {
      return null;
    }
    const adapter = this.getAdapter(platform);
    const accessToken = this.crypto.decrypt(connection.encryptedAccessToken);
    return adapter.getPostMetrics({
      accessToken,
      externalAccountId: connection.externalAccountId,
      postId,
    });
  }

  private sanitizeConnection(c: {
    id: string;
    userId: string;
    platform: SocialPlatform;
    externalAccountId: string;
    accountName: string;
    accountHandle: string;
    scopes: string[];
    status: SocialConnectionStatus;
    tokenExpiresAt: Date | null;
    lastSyncedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: c.id,
      platform: c.platform,
      externalAccountId: c.externalAccountId,
      accountName: c.accountName,
      accountHandle: c.accountHandle,
      scopes: c.scopes,
      status: c.status,
      tokenExpiresAt: c.tokenExpiresAt,
      lastSyncedAt: c.lastSyncedAt,
      createdAt: c.createdAt,
    };
  }

  private signState(encodedState: string): string {
    const secret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'amplyra-dev-oauth-state-secret';
    return createHmac('sha256', secret).update(encodedState).digest('hex');
  }

  private verifyState(state: string): {
    userId: string;
    platform: SharedPlatform;
    handleHint?: string;
  } {
    const [encodedState, sig] = state.split('.');
    if (!encodedState || !sig) {
      throw new BadRequestException('Invalid OAuth state');
    }
    const expected = this.signState(encodedState);
    const sigBuf = Buffer.from(sig, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new BadRequestException('Invalid OAuth state signature');
    }
    return JSON.parse(Buffer.from(encodedState, 'base64url').toString('utf8'));
  }

  private getApiPublicBase(): string {
    const configured = this.configService.get<string>('API_PUBLIC_URL');
    if (configured) {
      return configured.replace(/\/$/, '');
    }
    const vercelHost =
      this.configService.get<string>('VERCEL_PROJECT_PRODUCTION_URL') ||
      this.configService.get<string>('VERCEL_URL');
    if (vercelHost) {
      return `https://${vercelHost}/api/v1`;
    }
    return `http://localhost:${this.configService.get<string>('PORT') || 4000}/api/v1`;
  }
}
