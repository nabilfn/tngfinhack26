'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout, token } from '../lib/api';
import logoImg from '../app/Logo.PNG';

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
            <Image 
              src={logoImg} 
              alt="Face2Go Logo" 
              width={150} 
              height={50} 
              priority 
            />
            <p className="text-sm text-slate-500 mt-2">AI-powered biometric payment authorization</p>
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
