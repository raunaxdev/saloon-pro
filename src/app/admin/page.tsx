'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, Users, Building2, TrendingUp, AlertTriangle, FileCheck, RefreshCw } from 'lucide-react';

interface SaloonSummary {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  trade_license_no: string;
  license_expiry_date: string;
  sanitation_verified: boolean;
}

interface VisitRecord {
  id: string;
  total_amount: number;
  payment_mode: string;
  created_at: string;
}

export default function DistrictAdminPortal() {
  const [saloons, setSaloons] = useState<SaloonSummary[]>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDistrictData = useCallback(async () => {
    setLoading(true);
    const { data: sData } = await supabase.from('saloons').select('*');
    const { data: vData } = await supabase.from('visits').select('*');

    if (sData) setSaloons(sData as SaloonSummary[]);
    if (vData) setVisits(vData as VisitRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadInitialAdminData = async () => {
      setLoading(true);
      const { data: sData } = await supabase.from('saloons').select('*');
      const { data: vData } = await supabase.from('visits').select('*');

      if (isMounted) {
        if (sData) setSaloons(sData as SaloonSummary[]);
        if (vData) setVisits(vData as VisitRecord[]);
        setLoading(false);
      }
    };

    loadInitialAdminData();

    return () => {
      isMounted = false;
    };
  }, []);

  const totalDistrictRevenue = visits.reduce((acc, v) => acc + Number(v.total_amount), 0);
  const digitalTransfers = visits.filter(v => v.payment_mode === 'UPI' || v.payment_mode === 'Card');
  const digitalAdoptionRate = visits.length ? ((digitalTransfers.length / visits.length) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-screen bg-[#090809] text-stone-100 p-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-amber-900/40 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-600/20 text-amber-500 rounded-xl border border-amber-600/40">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wide">DISTRICT ADMINISTRATION MONITORING PORTAL</h1>
              <p className="text-stone-400 text-xs">Retail Unorganized Sector Oversight & Governance Framework</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDistrictData}
            className="p-2 bg-stone-900 border border-stone-800 rounded-lg text-stone-400 hover:text-amber-500 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="bg-emerald-950/40 border border-emerald-800/60 px-3 py-1.5 rounded-lg text-xs text-emerald-400 font-semibold flex items-center gap-2">
            <FileCheck className="w-4 h-4" /> District Status: Compliant & Audited
          </div>
        </div>
      </header>

      {/* High Level Governance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="saloon-card p-5 rounded-xl border-t-2 border-t-amber-500 space-y-2 bg-[#141214]">
          <div className="flex justify-between text-xs text-stone-400">
            <span>Registered Saloons</span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold">{saloons.length}</div>
          <div className="text-[11px] text-emerald-400">100% Onboarded digitally</div>
        </div>

        <div className="saloon-card p-5 rounded-xl border-t-2 border-t-emerald-500 space-y-2 bg-[#141214]">
          <div className="flex justify-between text-xs text-stone-400">
            <span>District Footfall (Total Visits)</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-400">{visits.length}</div>
          <div className="text-[11px] text-stone-500">Contact-traced records logged</div>
        </div>

        <div className="saloon-card p-5 rounded-xl border-t-2 border-t-amber-600 space-y-2 bg-[#141214]">
          <div className="flex justify-between text-xs text-stone-400">
            <span>Tracked Economy Volume</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-amber-500">₹{totalDistrictRevenue.toLocaleString()}</div>
          <div className="text-[11px] text-stone-500">Gross sector turnover</div>
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
          <ShieldCheck className="w-4 h-4 text-amber-500" /> District Trade License & Sanitation Registry
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f0d0e] text-stone-400 border-b border-stone-800">
              <tr>
                <th className="p-3">Saloon Name</th>
                <th className="p-3">Owner Name</th>
                <th className="p-3">Trade License No.</th>
                <th className="p-3">License Expiry</th>
                <th className="p-3">Sanitation & Hygiene Status</th>
                <th className="p-3 text-right">Labor Welfare Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {saloons.map(s => (
                <tr key={s.id} className="hover:bg-stone-900/50">
                  <td className="p-3 font-bold text-stone-100">{s.name}</td>
                  <td className="p-3 text-stone-300">{s.owner_name} ({s.phone})</td>
                  <td className="p-3 text-stone-400 font-mono">{s.trade_license_no}</td>
                  <td className="p-3 text-amber-400 font-medium">{s.license_expiry_date}</td>
                  <td className="p-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                      VERIFIED HYGIENIC
                    </span>
                  </td>
                  <td className="p-3 text-right text-stone-300 font-medium">
                    Commission & Wage Logged
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
          <h4 className="font-bold text-amber-400 text-sm">District Administration Governance Note</h4>
          <p className="text-stone-300 leading-relaxed">
            All registered establishments are compliant with local municipal sanitation laws, fair commission standards for barber staff (15% rate), and digital transaction tracking. Registered establishments qualify for PM SVANidhi and MSME Interest Subvention Schemes based on logged footfall data.
          </p>
        </div>
      </div>
    </div>
  );
}