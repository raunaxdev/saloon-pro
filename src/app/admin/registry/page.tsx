'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { fetchAllRows, getSaloonId } from '../../../lib/supabase';
import { supabase } from '../../../lib/supabase/client';
import type { PaymentMode, VisitStatus } from '../../../lib/database.types';
import { ShieldCheck, Users, Building2, TrendingUp, AlertTriangle, FileCheck, RefreshCw } from 'lucide-react';

interface SaloonSummary {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  trade_license_no: string;
  license_expiry_date: string | null;
  sanitation_verified: boolean;
}

interface VisitRecord {
  id: string;
  total_amount: number;
  payment_mode: PaymentMode;
  status: VisitStatus;
  created_at: string;
}

export default function SaloonAdminPortal() {
  const [saloons, setSaloons] = useState<SaloonSummary[]>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const isMountedRef = React.useRef(false);
  const fetchRequestRef = React.useRef(0);

  const fetchSaloonData = useCallback(async () => {
    const requestId = ++fetchRequestRef.current;
    try {
      const saloonId = getSaloonId();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Authentication required.');
      const { data: membership, error: membershipError } = await supabase
        .from('saloon_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('saloon_id', saloonId)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        if (isMountedRef.current && requestId === fetchRequestRef.current) {
          setDataError('This page is available to saloon owners and administrators only.');
        }
        return;
      }
      const [saloonsData, visitsData] = await Promise.all([
        fetchAllRows((from, to) => supabase.from('saloons').select('*').eq('id', saloonId).range(from, to)),
        fetchAllRows((from, to) => supabase
          .from('visits')
          .select('id,total_amount,payment_mode,status,created_at')
          .eq('saloon_id', saloonId)
          .order('created_at', { ascending: false })
          .range(from, to)),
      ]);
      if (isMountedRef.current && requestId === fetchRequestRef.current) {
        setSaloons(saloonsData);
        setVisits(visitsData);
        setDataError('');
      }
    } catch (error) {
      console.error('Failed to load saloon administration data:', error);
      if (isMountedRef.current && requestId === fetchRequestRef.current) {
        setDataError('Could not load saloon administration data. Check access policies and try again.');
      }
    } finally {
      if (isMountedRef.current && requestId === fetchRequestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const initialLoad = window.setTimeout(() => {
      void fetchSaloonData();
    }, 0);
    return () => {
      window.clearTimeout(initialLoad);
      isMountedRef.current = false;
      fetchRequestRef.current += 1;
    };
  }, [fetchSaloonData]);

  const completedVisits = visits.filter(v => v.status === 'Completed');
  const totalSaloonRevenue = completedVisits.reduce((acc, v) => acc + Number(v.total_amount || 0), 0);
  const digitalTransfers = completedVisits.filter(v => v.payment_mode === 'UPI' || v.payment_mode === 'Card');
  const digitalAdoptionRate = completedVisits.length
    ? ((digitalTransfers.length / completedVisits.length) * 100).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-[#090809] p-4 text-stone-100 sm:p-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-amber-900/40 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-600/20 text-amber-500 rounded-xl border border-amber-600/40">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wide">SALOON ADMINISTRATION PORTAL</h1>
              <p className="text-stone-400 text-xs">Authenticated, saloon-scoped operations and reporting</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setLoading(true);
              void fetchSaloonData();
            }}
            disabled={loading}
            aria-label="Refresh saloon data"
            className="p-2 bg-stone-900 border border-stone-800 rounded-lg text-stone-400 hover:text-amber-500 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="bg-stone-900 border border-stone-800 px-3 py-1.5 rounded-lg text-xs text-stone-300 font-semibold flex items-center gap-2">
            <FileCheck className="w-4 h-4" /> Registry dashboard
          </div>
        </div>
      </header>

      {dataError && (
        <div role="alert" className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">
          {dataError}
        </div>
      )}

      {/* High Level Governance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="saloon-card p-5 rounded-xl border-t-2 border-t-amber-500 space-y-2 bg-[#141214]">
          <div className="flex justify-between text-xs text-stone-400">
            <span>Saloon Records</span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold">{saloons.length}</div>
          <div className="text-[11px] text-stone-500">Registered entries in this database</div>
        </div>

        <div className="saloon-card p-5 rounded-xl border-t-2 border-t-emerald-500 space-y-2 bg-[#141214]">
          <div className="flex justify-between text-xs text-stone-400">
            <span>Completed Visits</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-400">{completedVisits.length}</div>
          <div className="text-[11px] text-stone-500">Completed visits recorded</div>
        </div>

        <div className="saloon-card p-5 rounded-xl border-t-2 border-t-amber-600 space-y-2 bg-[#141214]">
          <div className="flex justify-between text-xs text-stone-400">
            <span>Tracked Economy Volume</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-amber-500">₹{totalSaloonRevenue.toLocaleString()}</div>
          <div className="text-[11px] text-stone-500">Recorded completed-visit revenue</div>
        </div>

        <div className="saloon-card p-5 rounded-xl border-t-2 border-t-purple-500 space-y-2 bg-[#141214]">
          <div className="flex justify-between text-xs text-stone-400">
            <span>Digital Payment Adoption</span>
            <FileCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-purple-400">{digitalAdoptionRate}%</div>
          <div className="text-[11px] text-stone-500">UPI / Card transaction ratio</div>
        </div>
      </div>

      {/* Saloon Master Audit & Sanitation Verification Table */}
      <div className="saloon-card p-6 rounded-xl space-y-4 bg-[#141214]">
        <h3 className="text-stone-200 font-semibold text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-500" /> Saloon Trade License & Sanitation Records
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f0d0e] text-stone-400 border-b border-stone-800">
              <tr>
                <th className="p-3">Saloon Name</th>
                <th className="p-3">Owner Name</th>
                <th className="p-3">Trade License No.</th>
                <th className="p-3">License Expiry (recorded)</th>
                <th className="p-3">Sanitation Attestation</th>
                <th className="p-3 text-right">Commission / wage records</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {saloons.map(s => (
                <tr key={s.id} className="hover:bg-stone-900/50">
                  <td className="p-3 font-bold text-stone-100">{s.name}</td>
                  <td className="p-3 text-stone-300">{s.owner_name} ({s.phone})</td>
                  <td className="p-3 text-stone-400 font-mono">{s.trade_license_no}</td>
                  <td className="p-3 text-amber-400 font-medium">{s.license_expiry_date || 'Not recorded'}</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      s.sanitation_verified
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-stone-900 text-stone-400 border border-stone-700'
                    }`}>
                      {s.sanitation_verified ? 'VERIFIED' : 'NOT VERIFIED'}
                    </span>
                  </td>
                  <td className="p-3 text-right text-stone-300 font-medium">
                    Not tracked
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Policy & Subsidy Compliance Notice */}
      <div className="saloon-card p-5 rounded-xl bg-amber-950/20 border border-amber-900/40 flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <h4 className="font-bold text-amber-400 text-sm">Records and compliance note</h4>
          <p className="text-stone-300 leading-relaxed">
            This dashboard reports records available in the database; it does not verify legal compliance, wage payments, or eligibility for government schemes. Confirm those independently with the responsible authorities.
          </p>
        </div>
      </div>
    </div>
  );
}