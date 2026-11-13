import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class SubmitCampaignReportDto {
  @IsString()
  postId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  milestoneDay!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  evidenceImageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  views?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reach?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  impressions?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  likes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  comments?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  shares?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  saves?: number;
}

export class FlagReportDto {
  @IsString()
  reason!: string;
}

export class VerifyPostEvidenceDto {
  @IsOptional()
  @IsUrl()
  postUrl?: string;
}
