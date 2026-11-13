import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SocialPlatform } from '@amplyra/shared';

export class CampaignDeliverableDto {
  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @IsString()
  @MinLength(2)
  format!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateCampaignDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(2)
  productOrService!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsOptional()
  @IsString()
  objectives?: string;

  @IsOptional()
  @IsString()
  targetAudience?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredCategories?: string[];

  @IsOptional()
  @IsString()
  targetCountry?: string;

  @IsOptional()
  @IsString()
  targetState?: string;

  @IsOptional()
  @IsString()
  targetCity?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(SocialPlatform, { each: true })
  platforms!: SocialPlatform[];

  @IsInt()
  @Min(100)
  budgetKobo!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  creatorsNeeded?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CampaignDeliverableDto)
  deliverables!: CampaignDeliverableDto[];

  @IsOptional()
  @IsDateString()
  publicationDeadline?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDays?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ApplyToCampaignDto {
  @IsOptional()
  @IsString()
  pitch?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  proposedRateKobo?: number;

  @IsOptional()
  @IsString()
  deliverablePlan?: string;
}

export class InviteCreatorDto {
  @IsString()
  creatorId!: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  offeredRateKobo?: number;
}

export class ReviewApplicationDto {
  @IsString()
  applicationId!: string;

  @IsIn(['APPROVE', 'DECLINE'])
  decision!: 'APPROVE' | 'DECLINE';

  @IsOptional()
  @IsInt()
  @Min(0)
  agreedRateKobo?: number;
}

export class SubmitCampaignPostDto {
  @IsUrl()
  postUrl!: string;

  @IsOptional()
  @IsString()
  caption?: string;
}
