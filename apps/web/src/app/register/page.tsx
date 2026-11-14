'use client';

import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { UserRole } from '@amplyra/shared';
import { useAuth } from '@/lib/auth-context';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole =
    searchParams.get('role') === UserRole.CREATOR
      ? UserRole.CREATOR
      : UserRole.BUSINESS;

  const { register } = useAuth();
  const [role, setRole] = useState<UserRole.BUSINESS | UserRole.CREATOR>(initialRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await register({ email, password, fullName, role });
      router.push(user.role === UserRole.BUSINESS ? '/business' : '/creator');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-900">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-bold text-base">AMPLYRA AI</span>
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose how you want to use Amplyra AI.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100">
          <button
            type="button"
            onClick={() => setRole(UserRole.BUSINESS)}
            className={`py-2 px-3 rounded-lg text-sm font-semibold transition cursor-pointer ${
              role === UserRole.BUSINESS
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Business / Brand
          </button>
          <button
            type="button"
            onClick={() => setRole(UserRole.CREATOR)}
            className={`py-2 px-3 rounded-lg text-sm font-semibold transition cursor-pointer ${
              role === UserRole.CREATOR
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Creator
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full name
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={role === UserRole.BUSINESS ? 'Amina Bello' : 'Zainab Musa'}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.ng"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password (minimum 8 characters)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-sm transition cursor-pointer"
          >
            {submitting
              ? 'Creating account...'
              : `Join as ${role === UserRole.BUSINESS ? 'Business' : 'Creator'}`}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-700 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <RegisterForm />
    </Suspense>
  );
}
