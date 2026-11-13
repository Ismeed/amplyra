'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, LogOut, Menu, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface NavItem {
  href: string;
  label: string;
  badge?: string;
}

interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export function DashboardShell({
  title,
  roleLabel,
  navItems,
  children,
}: {
  title: string;
  roleLabel: string;
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<NotificationRecord[]>('/notifications'),
    enabled: !!user,
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function markAllRead() {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-slate-950 text-slate-100 border-r border-slate-800">
        <div className="p-5 border-b border-slate-800 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <Link href="/" className="font-bold text-base tracking-tight text-white">
              AMPLYRA AI
            </Link>
            <p className="text-[11px] uppercase tracking-wider text-emerald-400 font-medium">
              {roleLabel}
            </p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="text-xs">
            <p className="font-semibold text-white truncate">{user?.fullName}</p>
            <p className="text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium transition cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <h1 className="text-lg font-semibold text-slate-900 truncate">{title}</h1>
          </div>

          <div className="relative flex items-center gap-3">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-30">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-sm font-semibold text-slate-900">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-emerald-700 hover:underline font-medium cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No notifications yet.
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-lg border text-xs ${
                          n.readAt
                            ? 'bg-white border-slate-100 text-slate-600'
                            : 'bg-emerald-50/70 border-emerald-200 text-slate-900'
                        }`}
                      >
                        <p className="font-semibold">{n.title}</p>
                        <p className="mt-0.5 text-slate-600">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-950 text-white p-3 space-y-1 border-b border-slate-800">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm ${
                  pathname === item.href
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-rose-300"
            >
              Sign out
            </button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
