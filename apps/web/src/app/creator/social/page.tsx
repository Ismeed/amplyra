'use client';

import { DashboardShell } from '@/components/dashboard-shell';
import { CREATOR_NAV } from '@/components/nav-configs';
import { SocialAccountsPanel } from '@/components/social-accounts-panel';

export default function CreatorSocialAccountsPage() {
  return (
    <DashboardShell
      title="Social Accounts (OAuth)"
      roleLabel="Creator Workspace"
      navItems={CREATOR_NAV}
    >
      <SocialAccountsPanel />
    </DashboardShell>
  );
}
