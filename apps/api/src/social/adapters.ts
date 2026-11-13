import { ConfigService } from '@nestjs/config';
import { SocialPlatform } from '@amplyra/shared';
import {
  ConnectedSocialTokenResult,
  NormalizedPostMetrics,
  SocialPlatformAdapter,
} from './social.adapter';

export class InstagramAdapter implements SocialPlatformAdapter {
  readonly platform = SocialPlatform.INSTAGRAM;

  constructor(private readonly configService: ConfigService) {}

  isConfiguredForLiveOAuth(): boolean {
    return Boolean(
      this.configService.get<string>('META_APP_ID') &&
        this.configService.get<string>('META_APP_SECRET'),
    );
  }

  async getAuthorizationUrl(params: {
    state: string;
    redirectUri: string;
  }): Promise<string> {
    const appId = this.configService.get<string>('META_APP_ID');
    if (!appId) {
      const q = new URLSearchParams({
        code: 'sandbox_instagram_code',
        state: params.state,
      });
      return `${params.redirectUri}?${q.toString()}`;
    }
    const q = new URLSearchParams({
      client_id: appId,
      redirect_uri: params.redirectUri,
      scope: 'instagram_basic,instagram_manage_insights,pages_show_list',
      response_type: 'code',
      state: params.state,
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${q.toString()}`;
  }

  async exchangeAuthorizationCode(params: {
    code: string;
    redirectUri: string;
    handleHint?: string;
    accountNameHint?: string;
  }): Promise<ConnectedSocialTokenResult> {
    if (!this.isConfiguredForLiveOAuth() || params.code.startsWith('sandbox_')) {
      const handle = (params.handleHint || 'creator_ig').replace(/^@/, '');
      return {
        externalAccountId: `sandbox_ig_${handle}`,
        accountName: params.accountNameHint || `${handle} (Instagram)`,
        accountHandle: handle,
        scopes: ['instagram_basic', 'instagram_manage_insights'],
        accessToken: `sandbox_ig_token_${Date.now()}`,
        expiresInSeconds: 60 * 24 * 60 * 60,
      };
    }

    const appId = this.configService.get<string>('META_APP_ID')!;
    const appSecret = this.configService.get<string>('META_APP_SECRET')!;
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
        client_id: appId,
        redirect_uri: params.redirectUri,
        client_secret: appSecret,
        code: params.code,
      })}`,
    );
    if (!tokenRes.ok) {
      throw new Error('Failed to exchange Instagram/Meta authorization code');
    }
    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      expires_in?: number;
    };

    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(tokenData.access_token)}`,
    );
    const me = meRes.ok
      ? ((await meRes.json()) as { id: string; name: string })
      : { id: `ig_${Date.now()}`, name: 'Instagram Professional' };

    return {
      externalAccountId: me.id,
      accountName: me.name,
      accountHandle: (params.handleHint || me.name.toLowerCase().replace(/\s+/g, '_')).replace(
        /^@/,
        '',
      ),
      scopes: ['instagram_basic', 'instagram_manage_insights'],
      accessToken: tokenData.access_token,
      expiresInSeconds: tokenData.expires_in ?? 60 * 24 * 60 * 60,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    return {
      accessToken: refreshToken,
      expiresInSeconds: 60 * 24 * 60 * 60,
    };
  }

  async getPostMetrics(params: {
    accessToken: string;
    externalAccountId: string;
    postId: string;
  }): Promise<NormalizedPostMetrics> {
    if (params.accessToken.startsWith('sandbox_')) {
      throw new Error(
        'Meta live API credentials are not configured; use creator-submitted evidence fallback in sandbox mode.',
      );
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(params.postId)}/insights?metric=reach,likes,comments,shares,saved,views&access_token=${encodeURIComponent(params.accessToken)}`,
    );
    if (!res.ok) {
      throw new Error('Failed to retrieve Instagram Graph API insights');
    }
    const payload = (await res.json()) as {
      data?: Array<{ name: string; values?: Array<{ value: number }> }>;
    };
    const metricMap = new Map<string, number>();
    for (const item of payload.data ?? []) {
      const val = item.values?.[0]?.value;
      if (typeof val === 'number') metricMap.set(item.name, val);
    }

    return {
      views: metricMap.get('views'),
      reach: metricMap.get('reach'),
      likes: metricMap.get('likes'),
      comments: metricMap.get('comments'),
      shares: metricMap.get('shares'),
      saves: metricMap.get('saved'),
      metricSource: 'official_api',
      retrievedAt: new Date().toISOString(),
      platform: SocialPlatform.INSTAGRAM,
      postId: params.postId,
    };
  }

  async revokeAccess(): Promise<void> {
    // Token deletion handled in database; live revocation can hit Graph /permissions
  }
}

export class TikTokAdapter implements SocialPlatformAdapter {
  readonly platform = SocialPlatform.TIKTOK;

  constructor(private readonly configService: ConfigService) {}

  isConfiguredForLiveOAuth(): boolean {
    return Boolean(
      this.configService.get<string>('TIKTOK_CLIENT_KEY') &&
        this.configService.get<string>('TIKTOK_CLIENT_SECRET'),
    );
  }

  async getAuthorizationUrl(params: {
    state: string;
    redirectUri: string;
  }): Promise<string> {
    const clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY');
    if (!clientKey) {
      const q = new URLSearchParams({
        code: 'sandbox_tiktok_code',
        state: params.state,
      });
      return `${params.redirectUri}?${q.toString()}`;
    }
    const q = new URLSearchParams({
      client_key: clientKey,
      scope: 'user.info.basic,video.list',
      response_type: 'code',
      redirect_uri: params.redirectUri,
      state: params.state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${q.toString()}`;
  }

  async exchangeAuthorizationCode(params: {
    code: string;
    redirectUri: string;
    handleHint?: string;
    accountNameHint?: string;
  }): Promise<ConnectedSocialTokenResult> {
    if (!this.isConfiguredForLiveOAuth() || params.code.startsWith('sandbox_')) {
      const handle = (params.handleHint || 'creator_tt').replace(/^@/, '');
      return {
        externalAccountId: `sandbox_tt_${handle}`,
        accountName: params.accountNameHint || `${handle} (TikTok)`,
        accountHandle: handle,
        scopes: ['user.info.basic', 'video.list'],
        accessToken: `sandbox_tt_token_${Date.now()}`,
        refreshToken: `sandbox_tt_refresh_${Date.now()}`,
        expiresInSeconds: 24 * 60 * 60,
      };
    }

    const clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY')!;
    const clientSecret = this.configService.get<string>('TIKTOK_CLIENT_SECRET')!;
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code: params.code,
        grant_type: 'authorization_code',
        redirect_uri: params.redirectUri,
      }),
    });
    if (!res.ok) {
      throw new Error('Failed to exchange TikTok authorization code');
    }
    const tokenData = (await res.json()) as {
      open_id: string;
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    const handle = (params.handleHint || tokenData.open_id).replace(/^@/, '');
    return {
      externalAccountId: tokenData.open_id,
      accountName: params.accountNameHint || handle,
      accountHandle: handle,
      scopes: tokenData.scope ? tokenData.scope.split(',') : ['user.info.basic', 'video.list'],
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresInSeconds: tokenData.expires_in ?? 24 * 60 * 60,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    return {
      accessToken: refreshToken,
      refreshToken,
      expiresInSeconds: 24 * 60 * 60,
    };
  }

  async getPostMetrics(params: {
    accessToken: string;
    externalAccountId: string;
    postId: string;
  }): Promise<NormalizedPostMetrics> {
    if (params.accessToken.startsWith('sandbox_')) {
      throw new Error(
        'TikTok Display API credentials are not configured; use creator-submitted evidence fallback in sandbox mode.',
      );
    }

    const res = await fetch(
      'https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filters: { video_ids: [params.postId] } }),
      },
    );
    if (!res.ok) {
      throw new Error('Failed to query TikTok Display API metrics');
    }
    const data = (await res.json()) as {
      data?: {
        videos?: Array<{
          id: string;
          view_count?: number;
          like_count?: number;
          comment_count?: number;
          share_count?: number;
        }>;
      };
    };
    const video = data.data?.videos?.[0];
    if (!video) {
      throw new Error(`TikTok video ${params.postId} not found in authorized account`);
    }

    return {
      views: video.view_count,
      likes: video.like_count,
      comments: video.comment_count,
      shares: video.share_count,
      metricSource: 'official_api',
      retrievedAt: new Date().toISOString(),
      platform: SocialPlatform.TIKTOK,
      postId: params.postId,
    };
  }

  async revokeAccess(): Promise<void> {}
}

export class FacebookAdapter implements SocialPlatformAdapter {
  readonly platform = SocialPlatform.FACEBOOK;

  constructor(private readonly configService: ConfigService) {}

  isConfiguredForLiveOAuth(): boolean {
    return Boolean(
      this.configService.get<string>('META_APP_ID') &&
        this.configService.get<string>('META_APP_SECRET'),
    );
  }

  async getAuthorizationUrl(params: {
    state: string;
    redirectUri: string;
  }): Promise<string> {
    const appId = this.configService.get<string>('META_APP_ID');
    if (!appId) {
      const q = new URLSearchParams({
        code: 'sandbox_facebook_code',
        state: params.state,
      });
      return `${params.redirectUri}?${q.toString()}`;
    }
    const q = new URLSearchParams({
      client_id: appId,
      redirect_uri: params.redirectUri,
      scope: 'pages_show_list,pages_read_engagement,read_insights',
      response_type: 'code',
      state: params.state,
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${q.toString()}`;
  }

  async exchangeAuthorizationCode(params: {
    code: string;
    redirectUri: string;
    handleHint?: string;
    accountNameHint?: string;
  }): Promise<ConnectedSocialTokenResult> {
    const handle = (params.handleHint || 'page_fb').replace(/^@/, '');
    return {
      externalAccountId: `sandbox_fb_${handle}`,
      accountName: params.accountNameHint || `${handle} (Facebook Page)`,
      accountHandle: handle,
      scopes: ['pages_show_list', 'pages_read_engagement', 'read_insights'],
      accessToken: `sandbox_fb_token_${Date.now()}`,
      expiresInSeconds: 60 * 24 * 60 * 60,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    return {
      accessToken: refreshToken,
      expiresInSeconds: 60 * 24 * 60 * 60,
    };
  }

  async getPostMetrics(params: {
    accessToken: string;
    externalAccountId: string;
    postId: string;
  }): Promise<NormalizedPostMetrics> {
    if (params.accessToken.startsWith('sandbox_')) {
      throw new Error(
        'Facebook Page API credentials are not configured; use creator-submitted evidence fallback in sandbox mode.',
      );
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(params.postId)}/insights?metric=post_impressions,post_reactions_by_type_total&access_token=${encodeURIComponent(params.accessToken)}`,
    );
    if (!res.ok) {
      throw new Error('Failed to retrieve Facebook Page post insights');
    }
    const payload = (await res.json()) as {
      data?: Array<{ name: string; values?: Array<{ value: number }> }>;
    };
    const impressions = payload.data?.find((d) => d.name === 'post_impressions')
      ?.values?.[0]?.value;

    return {
      impressions,
      metricSource: 'official_api',
      retrievedAt: new Date().toISOString(),
      platform: SocialPlatform.FACEBOOK,
      postId: params.postId,
    };
  }

  async revokeAccess(): Promise<void> {}
}
