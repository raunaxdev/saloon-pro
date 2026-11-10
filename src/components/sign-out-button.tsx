'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    setError('');
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.replace('/login');
      router.refresh();
    } catch (signOutError) {
      console.error('Sign-out request failed:', signOutError);
      setError('Could not sign out. Please try again.');
      setPending(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="rounded border border-stone-700 px-3 py-1.5 text-xs text-stone-300 hover:border-amber-600 hover:text-amber-400 disabled:opacity-50"
      >
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
