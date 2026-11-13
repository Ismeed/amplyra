import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { AiContentType, ContentCalendarStatus, SocialPlatform } from '@amplyra/shared';

export class GenerateStrategyDto {
  @IsString()
  @MinLength(3)
  objective!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetKobo?: number;

  @IsOptional()
  @IsString()
  focusRegion?: string;
}

export class GenerateContentDto {
  @IsEnum(AiContentType)
  contentType!: AiContentType;

  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @IsString()
  @MinLength(3)
  topic!: string;

  @IsOptional()
  @IsString()
  callToAction?: string;
}

export class AskAnalystDto {
  @IsString()
  @MinLength(3)
  question!: string;
}

export class CreateCalendarItemDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @IsString()
  @MinLength(3)
  caption!: string;

  @IsDateString()
  scheduledFor!: string;

  @IsOptional()
  @IsString()
  campaignId?: string;
}

export class UpdateCalendarItemDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsEnum(ContentCalendarStatus)
  status?: ContentCalendarStatus;
}
