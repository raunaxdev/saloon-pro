'use client';

import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application route error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f0d0e] p-6 text-stone-100">
      <section className="max-w-md space-y-4 rounded-xl border border-red-900/50 bg-[#181517] p-6">
        <h1 className="text-xl font-bold text-amber-500">This page could not be loaded</h1>
        <p className="text-sm text-stone-300">An operation may have completed before this page failed. Check the records before retrying a save.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-stone-950 hover:bg-amber-500"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
