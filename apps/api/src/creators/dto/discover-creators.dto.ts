import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SocialPlatform } from '@amplyra/shared';

export class DiscoverCreatorsQueryDto {
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
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  niche?: string;

  @IsOptional()
  @IsEnum(SocialPlatform)
  platform?: SocialPlatform;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minFollowers?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxRateKobo?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  availableOnly?: boolean;

  @IsOptional()
  @IsString()
  q?: string;
}
