import { NavItem } from './dashboard-shell';

export const BUSINESS_NAV: NavItem[] = [
  { href: '/business', label: 'Overview & AI Insights' },
  { href: '/business/campaigns', label: 'Adverts & Offers' },
  { href: '/business/creators', label: 'Browse Creators' },
  { href: '/business/payments', label: 'Escrow & Billing' },
];

export const CREATOR_NAV: NavItem[] = [
  { href: '/creator/discover', label: 'Available Offers' },
  { href: '/creator/work', label: 'Active Jobs & Post Link' },
  { href: '/creator/earnings', label: 'Earnings & Withdraw' },
  { href: '/creator', label: 'Profile & Tier' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Platform Overview' },
];
