import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { SocialPlatform } from '@amplyra/shared';

export class UpsertCreatorDto {
  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  niches?: string[];

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  minRateKobo?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxRateKobo?: number;

  @IsOptional()
  @IsString()
  payoutBankName?: string;

  @IsOptional()
  @IsString()
  payoutAccountName?: string;

  @IsOptional()
  @IsString()
  payoutAccountLast4?: string;
}

export class UpsertCreatorSocialAccountDto {
  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @IsString()
  @MinLength(1)
  handle!: string;

  @IsOptional()
  @IsUrl()
  profileUrl?: string;

  @IsInt()
  @Min(0)
  followersCount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  avgEngagementRate?: number;
}

export class CreatePortfolioItemDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @IsUrl()
  postUrl!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  viewsCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  likesCount?: number;
}
