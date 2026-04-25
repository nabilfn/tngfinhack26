'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout, token } from '../lib/api';

export default function Shell({ children }) {
  const router = useRouter();
  const loggedIn = typeof window !== 'undefined' && Boolean(token());

  function signOut() {
    logout();
    router.push('/login');
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href={loggedIn ? '/dashboard' : '/'}>
            <h1 className="text-3xl font-bold tracking-tight">Face2Go</h1>
            <p className="text-sm text-slate-500">AI-powered biometric payment authorization</p>
          </Link>
          {loggedIn && (
            <button onClick={signOut} className="btn-soft px-4 py-2 text-sm">
              Logout
            </button>
          )}
        </header>
        {children}
      </div>
    </main>
  );
}
