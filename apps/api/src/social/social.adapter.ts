import { SocialPlatform } from '@amplyra/shared';

export interface ConnectedSocialTokenResult {
  externalAccountId: string;
  accountName: string;
  accountHandle: string;
  scopes: string[];
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds?: number;
}

export interface NormalizedPostMetrics {
  views?: number;
  reach?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  metricSource: 'official_api' | 'creator_evidence' | 'public_observation';
  retrievedAt: string;
  platform: SocialPlatform;
  postId: string;
}

export interface SocialPlatformAdapter {
  readonly platform: SocialPlatform;
  isConfiguredForLiveOAuth(): boolean;
  getAuthorizationUrl(params: {
    state: string;
    redirectUri: string;
  }): Promise<string>;
  exchangeAuthorizationCode(params: {
    code: string;
    redirectUri: string;
    handleHint?: string;
    accountNameHint?: string;
  }): Promise<ConnectedSocialTokenResult>;
  refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresInSeconds?: number;
  }>;
  getPostMetrics(params: {
    accessToken: string;
    externalAccountId: string;
    postId: string;
  }): Promise<NormalizedPostMetrics>;
  revokeAccess(accessToken: string): Promise<void>;
}
