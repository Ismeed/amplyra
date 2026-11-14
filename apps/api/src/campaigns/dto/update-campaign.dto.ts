import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreatorTier, SocialPlatform } from '@amplyra/shared';
import { CampaignDeliverableDto } from './campaign.dto';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  productOrService?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(SocialPlatform, { each: true })
  platforms?: SocialPlatform[];

  @IsOptional()
  @IsEnum(CreatorTier)
  targetTier?: CreatorTier;

  @IsOptional()
  @IsInt()
  @Min(100)
  budgetKobo?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  creatorsNeeded?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CampaignDeliverableDto)
  deliverables?: CampaignDeliverableDto[];

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
