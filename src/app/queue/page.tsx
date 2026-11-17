'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllRows, getSaloonId } from '../../lib/supabase';
import { supabase } from '../../lib/supabase/client';
import { SALON_CONFIG } from '../../lib/salon-config';
import { Scissors, Clock } from 'lucide-react';

interface VisitItem {
  id: string;
  status: 'Waiting' | 'In-Progress' | 'Completed';
  stylist_name?: string | null;
  services_done?: unknown;
  customers?: { name: string };
}

function getServiceNames(value: unknown): string {
  if (!Array.isArray(value)) return 'No services recorded';
  const names = value.flatMap(item => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
    const serviceName = (item as Record<string, unknown>).service_name;
    return typeof serviceName === 'string' && serviceName.trim() ? [serviceName.trim()] : [];
  });
  return names.length ? names.join(', ') : 'No services recorded';
}

export default function QueueDisplayPage() {
  const [queue, setQueue] = useState<VisitItem[]>([]);
  const [dataError, setDataError] = useState('');
  const isMountedRef = useRef(false);
  const fetchRequestRef = useRef(0);
  const fetchInProgressRef = useRef(false);
  const fetchAbortControllerRef = useRef<AbortController | null>(null);

  const fetchQueue = useCallback(async () => {
    if (fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;
    const controller = new AbortController();
    fetchAbortControllerRef.current = controller;
    const requestId = ++fetchRequestRef.current;
    try {
      const saloonId = getSaloonId();
      const data = await fetchAllRows((from, to) => supabase
        .from('visits')
        .select('*, customers!visits_customer_id_fkey(name)')
        .eq('saloon_id', saloonId)
        .neq('status', 'Completed')
        .order('created_at', { ascending: true })
        .range(from, to)
        .abortSignal(controller.signal));
      if (isMountedRef.current && requestId === fetchRequestRef.current) {
        setQueue(data);
        setDataError('');
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Failed to load queue:', error);
      if (isMountedRef.current && requestId === fetchRequestRef.current) {
        setDataError('Could not load the live queue. Check your connection and membership, then retry.');
      }
    } finally {
      fetchInProgressRef.current = false;
      if (fetchAbortControllerRef.current === controller) fetchAbortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const initialLoad = window.setTimeout(() => {
      void fetchQueue();
    }, 0);
    const interval = setInterval(() => {
      void fetchQueue();
    }, 5000);

    return () => {
      isMountedRef.current = false;
      fetchRequestRef.current += 1;
      fetchAbortControllerRef.current?.abort();
      window.clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [fetchQueue]);

  return (
    <div className="min-h-screen bg-[#0f0d0e] text-stone-100 p-4 sm:p-8 flex flex-col justify-between">
      <header className="flex flex-col gap-4 border-b border-amber-900/40 pb-6 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-600/20 text-amber-500 rounded-xl border border-amber-600/40">
            <Scissors className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-stone-100">{SALON_CONFIG.fullName}</h1>
            <p className="text-amber-500 text-sm font-semibold tracking-widest uppercase">Live Waiting Queue</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-stone-400 bg-stone-900 px-4 py-2 rounded-lg border border-stone-800 text-sm">
          <Clock className="w-4 h-4 text-amber-500 animate-pulse" /> Auto Updating Live
        </div>
      </header>

      <main className="my-auto py-8">
        {dataError ? (
          <div role="alert" className="rounded-lg border border-red-800 bg-red-950/50 p-4 text-center text-red-200">
            {dataError}
          </div>
        ) : queue.length === 0 ? (
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
                    Services: {getServiceNames(v.services_done)}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-800/80 text-xs text-amber-500 font-semibold">
                  Stylist: {v.stylist_name || SALON_CONFIG.stylists[SALON_CONFIG.stylists.length - 1]}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-stone-600 border-t border-stone-900 pt-4">
        Thank you for choosing {SALON_CONFIG.fullName} • Please wait for your token call
      </footer>
    </div>
  );
}