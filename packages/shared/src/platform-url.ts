import { SocialPlatform } from './enums';

export interface ParsedSocialPostUrl {
  platform: SocialPlatform;
  normalizedUrl: string;
  platformPostId: string | null;
}

/**
 * Validates a creator-submitted public post URL, detects the social platform,
 * and extracts the platform-specific post ID when present in standard URL formats.
 */
export function parseSocialPostUrl(rawUrl: string): ParsedSocialPostUrl {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid post URL format');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Post URL must use http or https');
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  const path = parsed.pathname;

  if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
    const match = path.match(/^\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    return {
      platform: SocialPlatform.INSTAGRAM,
      normalizedUrl: parsed.toString(),
      platformPostId: match ? match[1] : null,
    };
  }

  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    const match = path.match(/\/video\/(\d+)/);
    return {
      platform: SocialPlatform.TIKTOK,
      normalizedUrl: parsed.toString(),
      platformPostId: match ? match[1] : null,
    };
  }

  if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch') {
    const postMatch = path.match(/\/(?:posts|videos|reel)\/([A-Za-z0-9_-]+)/);
    const pfbid = parsed.searchParams.get('story_fbid') ?? parsed.searchParams.get('v');
    return {
      platform: SocialPlatform.FACEBOOK,
      normalizedUrl: parsed.toString(),
      platformPostId: postMatch ? postMatch[1] : pfbid,
    };
  }

  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') {
    const shortMatch = host === 'youtu.be' ? path.match(/^\/([A-Za-z0-9_-]+)/) : null;
    const shortsMatch = path.match(/^\/shorts\/([A-Za-z0-9_-]+)/);
    const watchId = parsed.searchParams.get('v');
    return {
      platform: SocialPlatform.YOUTUBE,
      normalizedUrl: parsed.toString(),
      platformPostId: shortMatch?.[1] ?? shortsMatch?.[1] ?? watchId ?? null,
    };
  }

  if (host === 'x.com' || host === 'twitter.com') {
    const match = path.match(/\/status\/(\d+)/);
    return {
      platform: SocialPlatform.X,
      normalizedUrl: parsed.toString(),
      platformPostId: match ? match[1] : null,
    };
  }

  throw new Error(
    `Unsupported social platform host "${parsed.hostname}". Supported platforms: Instagram, TikTok, Facebook, YouTube, X.`,
  );
}
