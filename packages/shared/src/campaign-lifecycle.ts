import { CampaignStatus } from './enums';

/**
 * Valid backend state transitions for the Amplyra Campaign Lifecycle (Section 10.1).
 * Transitions must always be validated on the backend rather than trusting client buttons.
 */
export const ALLOWED_CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  [CampaignStatus.DRAFT]: [
    CampaignStatus.PUBLISHED,
    CampaignStatus.APPLICATIONS_OPEN,
    CampaignStatus.CANCELLED,
  ],
  [CampaignStatus.PUBLISHED]: [
    CampaignStatus.APPLICATIONS_OPEN,
    CampaignStatus.CREATOR_SELECTED,
    CampaignStatus.CANCELLED,
    CampaignStatus.UNDER_REVIEW,
  ],
  [CampaignStatus.APPLICATIONS_OPEN]: [
    CampaignStatus.CREATOR_SELECTED,
    CampaignStatus.CANCELLED,
    CampaignStatus.UNDER_REVIEW,
  ],
  [CampaignStatus.CREATOR_SELECTED]: [
    CampaignStatus.FUNDED,
    CampaignStatus.CREATOR_ACCEPTED,
    CampaignStatus.APPLICATIONS_OPEN,
    CampaignStatus.CANCELLED,
    CampaignStatus.UNDER_REVIEW,
  ],
  [CampaignStatus.FUNDED]: [
    CampaignStatus.CREATOR_ACCEPTED,
    CampaignStatus.REFUNDED,
    CampaignStatus.DISPUTED,
    CampaignStatus.CANCELLED,
  ],
  [CampaignStatus.CREATOR_ACCEPTED]: [
    CampaignStatus.CONTENT_APPROVAL,
    CampaignStatus.PUBLISHED_ON_SOCIAL,
    CampaignStatus.DISPUTED,
    CampaignStatus.CANCELLED,
  ],
  [CampaignStatus.CONTENT_APPROVAL]: [
    CampaignStatus.PUBLISHED_ON_SOCIAL,
    CampaignStatus.DISPUTED,
    CampaignStatus.UNDER_REVIEW,
  ],
  [CampaignStatus.PUBLISHED_ON_SOCIAL]: [
    CampaignStatus.ACTIVE_REPORTING,
    CampaignStatus.FINAL_VERIFICATION,
    CampaignStatus.DISPUTED,
    CampaignStatus.UNDER_REVIEW,
  ],
  [CampaignStatus.ACTIVE_REPORTING]: [
    CampaignStatus.FINAL_VERIFICATION,
    CampaignStatus.DISPUTED,
    CampaignStatus.UNDER_REVIEW,
  ],
  [CampaignStatus.FINAL_VERIFICATION]: [
    CampaignStatus.COMPLETED,
    CampaignStatus.DISPUTED,
    CampaignStatus.FAILED,
    CampaignStatus.UNDER_REVIEW,
  ],
  [CampaignStatus.COMPLETED]: [
    CampaignStatus.PAYMENT_RELEASED,
    CampaignStatus.DISPUTED,
  ],
  [CampaignStatus.PAYMENT_RELEASED]: [],
  [CampaignStatus.CANCELLED]: [CampaignStatus.REFUNDED],
  [CampaignStatus.DISPUTED]: [
    CampaignStatus.UNDER_REVIEW,
    CampaignStatus.COMPLETED,
    CampaignStatus.REFUNDED,
    CampaignStatus.FAILED,
  ],
  [CampaignStatus.FAILED]: [CampaignStatus.REFUNDED],
  [CampaignStatus.REFUNDED]: [],
  [CampaignStatus.UNDER_REVIEW]: [
    CampaignStatus.APPLICATIONS_OPEN,
    CampaignStatus.ACTIVE_REPORTING,
    CampaignStatus.COMPLETED,
    CampaignStatus.DISPUTED,
    CampaignStatus.FAILED,
    CampaignStatus.CANCELLED,
  ],
};

export function canTransitionCampaignStatus(
  from: CampaignStatus,
  to: CampaignStatus,
): boolean {
  return ALLOWED_CAMPAIGN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertCampaignTransition(
  from: CampaignStatus,
  to: CampaignStatus,
): void {
  if (!canTransitionCampaignStatus(from, to)) {
    throw new Error(`Invalid campaign status transition from ${from} to ${to}`);
  }
}
