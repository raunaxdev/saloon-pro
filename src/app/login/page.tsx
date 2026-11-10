'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError('Sign-in failed. Check your credentials or ask your saloon administrator.');
        setPending(false);
        return;
      }

      const requestedPath = new URLSearchParams(window.location.search).get('next');
      let safePath = '/';
      if (requestedPath) {
        const candidate = new URL(requestedPath, window.location.origin);
        if (candidate.origin === window.location.origin) {
          safePath = `${candidate.pathname}${candidate.search}${candidate.hash}`;
        }
      }
      router.replace(safePath);
      router.refresh();
    } catch (signInError) {
      console.error('Sign-in request failed:', signInError);
      setError('Sign-in failed. Check your credentials or ask your saloon administrator.');
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f0d0e] p-5 text-stone-100">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 rounded-xl border border-amber-900/40 bg-[#181517] p-6">
        <header>
          <h1 className="text-xl font-bold text-amber-500">Saloon OS sign in</h1>
          <p className="mt-1 text-sm text-stone-400">Use your authorized staff account.</p>
        </header>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-stone-300">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            value={email}
            onChange={event => setEmail(event.target.value)}
            className="w-full rounded-lg border border-stone-700 bg-[#0f0d0e] px-3 py-2.5"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm text-stone-300">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={event => setPassword(event.target.value)}
            className="w-full rounded-lg border border-stone-700 bg-[#0f0d0e] px-3 py-2.5"
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-amber-600 px-4 py-2.5 font-bold text-stone-950 hover:bg-amber-500 disabled:opacity-50"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
