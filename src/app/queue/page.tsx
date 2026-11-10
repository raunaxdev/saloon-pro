'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Scissors, Clock } from 'lucide-react';

const SALOON_ID = process.env.NEXT_PUBLIC_SALOON_ID || '00000000-0000-0000-0000-000000000001';

interface VisitItem {
  id: string;
  status: string;
  stylist_name?: string;
  services_done: { service_name: string }[];
  customers?: { name: string };
}

export default function QueueDisplayPage() {
  const [queue, setQueue] = useState<VisitItem[]>([]);

  const fetchQueue = useCallback(async () => {
    const { data } = await supabase
      .from('visits')
      .select('*, customers(name)')
      .eq('saloon_id', SALOON_ID)
      .neq('status', 'Completed')
      .order('created_at', { ascending: true });

    if (data) setQueue(data as VisitItem[]);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadInitialQueue = async () => {
      const { data } = await supabase
        .from('visits')
        .select('*, customers(name)')
        .eq('saloon_id', SALOON_ID)
        .neq('status', 'Completed')
        .order('created_at', { ascending: true });

      if (isMounted && data) {
        setQueue(data as VisitItem[]);
      }
    };

    loadInitialQueue();

    const interval = setInterval(() => {
      fetchQueue();
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchQueue]);

  return (
    <div className="min-h-screen bg-[#0f0d0e] text-stone-100 p-8 flex flex-col justify-between">
      <header className="flex justify-between items-center border-b border-amber-900/40 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-600/20 text-amber-500 rounded-xl border border-amber-600/40">
            <Scissors className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-wider text-stone-100">VINTAGE BARBER LOUNGE</h1>
            <p className="text-amber-500 text-sm font-semibold tracking-widest uppercase">Live Waiting Queue</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-stone-400 bg-stone-900 px-4 py-2 rounded-lg border border-stone-800 text-sm">
          <Clock className="w-4 h-4 text-amber-500 animate-pulse" /> Auto Updating Live
        </div>
      </header>

      <main className="my-auto py-8">
        {queue.length === 0 ? (
          <div className="text-center space-y-4 py-20">
            <h2 className="text-4xl font-bold text-stone-500">No Customers Waiting</h2>
            <p className="text-stone-600 text-lg">Walk-ins Welcome! Please proceed to reception.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {queue.map((v, index) => (
              <div
                key={v.id}
                className={`saloon-card p-6 rounded-2xl border-2 space-y-4 ${
                  v.status === 'In-Progress'
                    ? 'border-amber-500 bg-amber-950/20'
                    : 'border-stone-800 bg-[#181517]'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-stone-400 bg-stone-900 px-3 py-1 rounded-full border border-stone-800">
                    Token #{index + 1}
                  </span>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                      v.status === 'In-Progress'
                        ? 'bg-amber-500 text-stone-950 animate-pulse'
                        : 'bg-stone-800 text-stone-300'
                    }`}
                  >
                    {v.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-stone-100">{v.customers?.name || 'Valued Client'}</h3>
                  <p className="text-sm text-stone-400">
                    Services: {v.services_done?.map(s => s.service_name).join(', ')}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-800/80 text-xs text-amber-500 font-semibold">
                  Stylist: {v.stylist_name || 'Assigned Barber'}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-stone-600 border-t border-stone-900 pt-4">
        Thank you for choosing Vintage Barber Lounge • Please wait for your token call
      </footer>
    </div>
  );
}