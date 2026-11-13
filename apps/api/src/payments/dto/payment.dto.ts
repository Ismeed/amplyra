import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class FundCampaignDto {
  @IsString()
  campaignId!: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class ReleasePaymentDto {
  @IsOptional()
  @IsBoolean()
  confirmEarlyRelease?: boolean;
}

export class OpenDisputeDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}

export class ResolveDisputeDto {
  @IsIn(['RESOLVED_RELEASE', 'RESOLVED_REFUND', 'DISMISSED'])
  resolution!: 'RESOLVED_RELEASE' | 'RESOLVED_REFUND' | 'DISMISSED';

  @IsString()
  @MinLength(3)
  resolutionNotes!: string;
}
