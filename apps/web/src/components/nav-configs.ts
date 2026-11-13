import { NavItem } from './dashboard-shell';

export const BUSINESS_NAV: NavItem[] = [
  { href: '/business', label: 'Overview' },
  { href: '/business/ai', label: 'AI Strategist & Analyst' },
  { href: '/business/content-studio', label: 'Content Studio' },
  { href: '/business/calendar', label: 'Content Calendar' },
  { href: '/business/social', label: 'Social Accounts' },
  { href: '/business/creators', label: 'Creator Marketplace' },
  { href: '/business/campaigns', label: 'Campaigns & Analytics' },
  { href: '/business/payments', label: 'Payments & Billing' },
];

export const CREATOR_NAV: NavItem[] = [
  { href: '/creator', label: 'Overview & Profile' },
  { href: '/creator/discover', label: 'Discover Campaigns' },
  { href: '/creator/work', label: 'Work & 5-Day Reports' },
  { href: '/creator/social', label: 'Social Accounts' },
  { href: '/creator/earnings', label: 'Earnings' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Platform Overview' },
];
