'use client';

import { DashboardShell } from '@/components/dashboard-shell';
import { BUSINESS_NAV } from '@/components/nav-configs';
import { SocialAccountsPanel } from '@/components/social-accounts-panel';

export default function BusinessSocialAccountsPage() {
  return (
    <DashboardShell
      title="Social Accounts"
      roleLabel="Business Workspace"
      navItems={BUSINESS_NAV}
    >
      <SocialAccountsPanel />
    </DashboardShell>
  );
}
