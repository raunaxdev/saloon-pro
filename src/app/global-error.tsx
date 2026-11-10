'use client';

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#0f0d0e] p-6 text-stone-100">
        <main className="max-w-md space-y-4 rounded-xl border border-red-900/50 bg-[#181517] p-6">
          <h1 className="text-xl font-bold text-amber-500">The application encountered an error</h1>
          <p className="text-sm text-stone-300">Try reloading the application. If the problem continues, contact your administrator.</p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-stone-950 hover:bg-amber-500"
          >
            Reload application
          </button>
        </main>
      </body>
    </html>
  );
}
