'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllRows, getSaloonId } from '../lib/supabase';
import { supabase } from '../lib/supabase/client';
import { SignOutButton } from '../components/sign-out-button';
import type { VisitStatus } from '../lib/database.types';
import {
  Scissors, UserPlus, CreditCard, LayoutDashboard,
  Clock, Award, CheckCircle2, Sparkles, RefreshCw, UserCheck, FileText, Printer, ShieldCheck, X, AlertCircle
} from 'lucide-react';

interface ServiceItem {
  id: string;
  service_name: string;
  price: number;
  category: string;
}

interface CustomerItem {
  id: string;
  name: string;
  phone: string;
  total_visits: number;
  total_spent: number;
  last_visit: string | null;
}

interface VisitItem {
  id: string;
  saloon_id: string;
  customer_id: string;
  services_done: ServiceItem[];
  total_amount: number;
  payment_mode: 'Cash' | 'UPI' | 'Card';
  status: 'Waiting' | 'In-Progress' | 'Completed';
  stylist_name?: string | null;
  notes?: string | null;
  sanitation_verified: boolean;
  created_at: string;
  customers?: CustomerItem;
}

const STYLISTS = ['Mukesh (Head Barber)', 'Ramesh (Hair Stylist)', 'Suresh (Facial Expert)', 'General Staff'];

export default function SaloonApp() {
  const [activeTab, setActiveTab] = useState<'billing' | 'queue' | 'analytics' | 'audit' | 'ai'>('billing');
  
  // Data States
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [savingVisit, setSavingVisit] = useState(false);
  const isMountedRef = useRef(false);
  const loadRequestRef = useRef(0);
  const loadAbortControllerRef = useRef<AbortController | null>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  // Form States
  const [phone, setPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [existingClient, setExistingClient] = useState<CustomerItem | null>(null);
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card'>('UPI');
  const [selectedStylist, setSelectedStylist] = useState<string>(STYLISTS[0]);

  // Sanitation Checklist
  const [sterilizedEquipment, setSterilizedEquipment] = useState(false);

  // Thermal Slip Modal State
  const [activeReceipt, setActiveReceipt] = useState<{
    name: string;
    phone: string;
    services: ServiceItem[];
    amount: number;
    paymentMode: string;
    stylist: string;
    date: string;
    sanitationVerified: boolean;
  } | null>(null);

  // AI State
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const loadData = useCallback(async () => {
    loadAbortControllerRef.current?.abort();
    const controller = new AbortController();
    loadAbortControllerRef.current = controller;
    const requestId = ++loadRequestRef.current;

    try {
      const saloonId = getSaloonId();
      const [servicesData, customersData, visitsData] = await Promise.all([
        fetchAllRows((from, to) => supabase
          .from('services')
          .select('*')
          .eq('saloon_id', saloonId)
          .range(from, to)),
        fetchAllRows((from, to) => supabase
          .from('customers')
          .select('*')
          .eq('saloon_id', saloonId)
          .range(from, to)),
        fetchAllRows((from, to) => supabase
          .from('visits')
          .select('*, customers!visits_customer_id_fkey(*)')
          .eq('saloon_id', saloonId)
          .order('created_at', { ascending: false })
          .range(from, to)),
      ]);

      if (isMountedRef.current && requestId === loadRequestRef.current) {
        setServices(servicesData as ServiceItem[]);
        setCustomers(customersData as CustomerItem[]);
        setVisits(visitsData as VisitItem[]);
        setApiError(null);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Failed to load saloon data:', error);
      if (isMountedRef.current && requestId === loadRequestRef.current) {
        setApiError('Could not load saloon data. Check your connection and membership, then retry.');
      }
    } finally {
      if (loadAbortControllerRef.current === controller) loadAbortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const initialLoad = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => {
      window.clearTimeout(initialLoad);
      isMountedRef.current = false;
      loadRequestRef.current += 1;
      loadAbortControllerRef.current?.abort();
      aiAbortControllerRef.current?.abort();
    };
  }, [loadData]);

  const handlePhoneChange = (val: string) => {
    const sanitized = val.replace(/\D/g, '').slice(0, 10);
    setPhone(sanitized);
    const found = sanitized ? customers.find(c => c.phone === sanitized) : undefined;
    if (found) {
      setExistingClient(found);
      setClientName(found.name);
    } else {
      setExistingClient(null);
      setClientName('');
    }
  };

  const toggleService = (service: ServiceItem) => {
    if (selectedServices.find(s => s.id === service.id)) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const totalBill = selectedServices.reduce((sum, item) => sum + Number(item.price || 0), 0);

  const sendWhatsAppBill = (
    clientPhone: string,
    name: string,
    amount: number,
    items: ServiceItem[],
    mode: string,
    sanitationVerified: boolean,
  ) => {
    const serviceNames = items.map(i => i.service_name).join(', ');
    const text = `Hello *${name}*! Thank you for visiting *The Vintage Barber Lounge*!\n\n*Services Done:* ${serviceNames}\n*Total Amount Paid:* ₹${amount}\n*Payment Mode:* ${mode}\n*UV Equipment Sterilized:* ${sanitationVerified ? 'Verified' : 'Not verified'}\n\nWe look forward to seeing you again soon! Have a great day!`;
    const cleanPhone = clientPhone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      alert('A valid 10-digit Indian mobile number is required to send a WhatsApp invoice.');
      return;
    }
    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

const handleCreateVisit = async (status: 'Completed' | 'Waiting') => {
    if (!/^[6-9]\d{9}$/.test(phone) || !clientName.trim() || selectedServices.length === 0) {
      alert('Kripya valid 10-digit Phone Number, Client Name, aur kam se kam 1 service select karein!');
      return;
    }
    if (!sterilizedEquipment) {
      alert('UV equipment sterilization must be verified before saving the visit.');
      return;
    }
    if (savingVisit) return;

    setSavingVisit(true);
    try {
      const saloonId = getSaloonId();
      let createdServices = selectedServices;
      let visitTotal = totalBill;
      let visitCreatedAt = new Date().toISOString();

      // 1. Attempt RPC call
      const { data: rpcData, error: rpcErr } = await supabase.rpc('create_visit', {
        p_saloon_id: saloonId,
        p_customer_name: clientName.trim(),
        p_phone: phone,
        p_service_ids: selectedServices.map(service => service.id),
        p_payment_mode: paymentMode,
        p_stylist_name: selectedStylist,
        p_status: status,
        p_sanitation_verified: sterilizedEquipment,
      });

      if (rpcErr) {
        console.warn('RPC create_visit failed/bypassed, executing direct database fallback:', rpcErr);

        // Fallback: Direct Database Customer & Visit Flow
        let customerId: string | undefined = existingClient?.id;

        if (!existingClient) {
          const { data: newCust, error: cErr } = await supabase
            .from('customers')
            .insert([{ 
              saloon_id: saloonId, 
              name: clientName.trim(), 
              phone: phone, 
              total_visits: 1, 
              total_spent: totalBill 
            }])
            .select()
            .single();

          if (cErr) throw cErr;
          customerId = newCust.id;
        } else {
          const { error: uErr } = await supabase
            .from('customers')
            .update({
              name: clientName.trim(),
              total_visits: (existingClient.total_visits || 0) + 1,
              total_spent: Number(existingClient.total_spent || 0) + totalBill,
              last_visit: new Date().toISOString()
            })
            .eq('id', existingClient.id)
            .eq('saloon_id', saloonId);

          if (uErr) {
            console.warn('Customer update warning:', uErr);
          }
        }

        if (!customerId) {
          throw new Error('Could not obtain valid Customer ID');
        }

        // Direct Visit Insert with type-safe casting
        const { error: vErr } = await supabase.from('visits').insert([{
          saloon_id: saloonId,
          customer_id: customerId,
          services_done: selectedServices as unknown as ServiceItem[],
          total_amount: totalBill,
          payment_mode: paymentMode,
          stylist_name: selectedStylist,
          status: status,
          sanitation_verified: sterilizedEquipment
        }]);

        if (vErr) throw vErr;
      } else if (rpcData && rpcData[0]) {
        const created = rpcData[0];
        if (Array.isArray(created.services_done)) {
          createdServices = created.services_done as unknown as ServiceItem[];
        }
        visitTotal = created.total_amount;
        visitCreatedAt = created.created_at;
      }

      if (!isMountedRef.current) return;

      if (status === 'Completed') {
        setActiveReceipt({
          name: clientName.trim(),
          phone,
          services: createdServices,
          amount: visitTotal,
          paymentMode,
          stylist: selectedStylist,
          date: new Date(visitCreatedAt).toLocaleString(),
          sanitationVerified: sterilizedEquipment,
        });
      } else {
        alert('Queue me add kar diya gaya hai!');
      }

      setPhone('');
      setClientName('');
      setSelectedServices([]);
      setExistingClient(null);
      setSterilizedEquipment(false);
      await loadData();
    } catch (error) {
      console.error('Failed to create visit:', error);
      alert('Could not save this visit. Check your connection and access, then retry.');
    } finally {
      if (isMountedRef.current) setSavingVisit(false);
    }
  };

  const updateQueueStatus = async (visitId: string, newStatus: VisitStatus) => {
    try {
      const { error } = await supabase.rpc('update_visit_status', {
        p_saloon_id: getSaloonId(),
        p_visit_id: visitId,
        p_status: newStatus,
      });
      if (error) {
        await supabase.from('visits').update({ status: newStatus }).eq('id', visitId);
      }
      await loadData();
    } catch (error) {
      console.error('Failed to update visit status:', error);
      alert('Could not update the queue. Please retry.');
    }
  };

  const askAiAssistant = async () => {
    if (!aiQuery.trim() || aiQuery.trim().length > 1000 || aiLoading) return;
    setAiLoading(true);
    setAiResponse('');
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;

    try {
      const res = await fetch('/api/ai-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery }),
        signal: controller.signal,
      });
      const data: { text?: string; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      if (isMountedRef.current) setAiResponse(data.text || 'The AI advisor returned an empty response.');
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('AI advisor request failed:', error);
      if (isMountedRef.current) {
        setAiResponse(error instanceof Error ? error.message : 'AI Advisor connect karne me dikkat aayi.');
      }
    } finally {
      if (aiAbortControllerRef.current === controller) aiAbortControllerRef.current = null;
      if (isMountedRef.current) setAiLoading(false);
    }
  };

  const completedVisits = visits.filter(visit => visit.status === 'Completed');
  const totalRevenue = completedVisits.reduce((sum, visit) => sum + Number(visit.total_amount || 0), 0);
  const totalVisitsCount = completedVisits.length;
  const completedVisitCounts = new Map<string, number>();
  for (const visit of completedVisits) {
    completedVisitCounts.set(visit.customer_id, (completedVisitCounts.get(visit.customer_id) ?? 0) + 1);
  }
  const regularClients = [...completedVisitCounts.values()].filter(count => count >= 2);
  const retentionBase = completedVisitCounts.size;
  const upiRevenue = completedVisits.filter(v => v.payment_mode === 'UPI').reduce((acc, v) => acc + Number(v.total_amount || 0), 0);
  const cashRevenue = completedVisits.filter(v => v.payment_mode === 'Cash').reduce((acc, v) => acc + Number(v.total_amount || 0), 0);
  const cardRevenue = completedVisits.filter(v => v.payment_mode === 'Card').reduce((acc, v) => acc + Number(v.total_amount || 0), 0);

  const estimatedGst = (totalRevenue * 0.05).toFixed(0);
  const turnoverIndicator = totalRevenue >= 50000
    ? 'Turnover threshold reached; scheme eligibility is not verified'
    : 'Building recorded turnover history';

  const stylistStats = STYLISTS.map(stylist => {
    const stylistVisits = completedVisits.filter(v => v.stylist_name === stylist);
    const revenue = stylistVisits.reduce((acc, v) => acc + Number(v.total_amount || 0), 0);
    return {
      name: stylist,
      visitsCount: stylistVisits.length,
      revenue,
      commission: (revenue * 0.15).toFixed(0)
    };
  });

  return (
    <div className={`min-h-screen bg-[#0f0d0e] text-stone-200 flex flex-col md:flex-row w-full ${activeReceipt ? 'print-receipt' : ''} ${activeTab === 'audit' ? 'print-audit' : ''}`}>
      <aside className="w-full md:w-64 bg-[#181517] border-r border-amber-900/30 p-5 flex flex-col justify-between shrink-0 print:hidden">
        <div>
          <div className="flex items-center gap-3 pb-6 border-b border-stone-800">
            <div className="p-2.5 bg-amber-600/20 text-amber-500 rounded-lg border border-amber-600/40">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-stone-100 text-lg leading-tight tracking-wide">VINTAGE BARBER</h1>
              <span className="text-xs text-amber-500 font-medium tracking-wider uppercase">Lounge & Studio</span>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            <button
              onClick={() => setActiveTab('billing')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'billing' ? 'bg-amber-600 text-stone-950 font-semibold shadow-lg shadow-amber-600/20' : 'text-stone-400 hover:bg-stone-900 hover:text-amber-500'}`}
            >
              <CreditCard className="w-4 h-4" /> Billing & Reception
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'queue' ? 'bg-amber-600 text-stone-950 font-semibold shadow-lg shadow-amber-600/20' : 'text-stone-400 hover:bg-stone-900 hover:text-amber-500'}`}
            >
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4" /> Live Queue
              </div>
              <span className="bg-stone-800 text-amber-400 text-xs px-2 py-0.5 rounded-full border border-amber-600/30">
                {visits.filter(v => v.status !== 'Completed').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'analytics' ? 'bg-amber-600 text-stone-950 font-semibold shadow-lg shadow-amber-600/20' : 'text-stone-400 hover:bg-stone-900 hover:text-amber-500'}`}
            >
              <LayoutDashboard className="w-4 h-4" /> Owner & Staff Analytics
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'audit' ? 'bg-amber-600 text-stone-950 font-semibold shadow-lg shadow-amber-600/20' : 'text-stone-400 hover:bg-stone-900 hover:text-amber-500'}`}
            >
              <FileText className="w-4 h-4" /> Audit & Compliance Hub
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'ai' ? 'bg-amber-600 text-stone-950 font-semibold shadow-lg shadow-amber-600/20' : 'text-stone-400 hover:bg-stone-900 hover:text-amber-500'}`}
            >
              <Sparkles className="w-4 h-4" /> AI Business Advisor
            </button>
          </nav>
        </div>

        <div className="pt-4 border-t border-stone-800 text-xs text-stone-500 flex items-center justify-between">
          <span>Saloon OS Enterprise v3.0</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void loadData()} aria-label="Refresh saloon data" className="p-1 hover:text-amber-500 transition">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {apiError && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-400 text-xs flex items-center gap-3 print:hidden">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-bold block">Database Connection Error</span>
              <span>{apiError}</span>
              <button type="button" onClick={() => void loadData()} className="ml-auto rounded border border-red-800 px-3 py-1 text-red-200 hover:bg-red-950">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: BILLING & RECEPTION */}
        {activeTab === 'billing' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <header className="flex justify-between items-center pb-4 border-b border-stone-800">
              <div>
                <h2 className="text-2xl font-bold text-amber-500">Reception Desk</h2>
                <p className="text-stone-400 text-sm">Client Entry, Staff Assignment & Digital Billing</p>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="saloon-card p-5 rounded-xl space-y-4">
                  <h3 className="text-stone-200 font-semibold flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-amber-500" /> Client & Staff Selection
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="client-phone" className="text-xs text-stone-400 block mb-1">Phone Number (10-Digits)</label>
                      <input
                        id="client-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        pattern="[6-9][0-9]{9}"
                        maxLength={10}
                        placeholder="e.g. 9876543210"
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className="w-full bg-[#0f0d0e] border border-stone-800 rounded-lg px-3.5 py-2.5 text-stone-100 focus:outline-none focus:border-amber-600 transition"
                      />
                    </div>
                    <div>
                      <label htmlFor="client-name" className="text-xs text-stone-400 block mb-1">Client Full Name</label>
                      <input
                        id="client-name"
                        type="text"
                        placeholder="Client Name"
                        value={clientName}
                        maxLength={120}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full bg-[#0f0d0e] border border-stone-800 rounded-lg px-3.5 py-2.5 text-stone-100 focus:outline-none focus:border-amber-600 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-stone-400 block mb-1">Assigned Stylist / Barber</label>
                      <select
                        value={selectedStylist}
                        onChange={(e) => setSelectedStylist(e.target.value)}
                        className="w-full bg-[#0f0d0e] border border-stone-800 rounded-lg px-3.5 py-2.5 text-stone-100 focus:outline-none focus:border-amber-600 transition"
                      >
                        {STYLISTS.map(stylist => (
                          <option key={stylist} value={stylist}>{stylist}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-xs text-emerald-400 font-medium cursor-pointer bg-stone-900 border border-stone-800 p-2.5 rounded-lg w-full">
                        <input
                          type="checkbox"
                          checked={sterilizedEquipment}
                          onChange={(e) => setSterilizedEquipment(e.target.checked)}
                          className="accent-amber-500 rounded"
                        />
                        <ShieldCheck className="w-4 h-4 text-emerald-400" /> UV Equipment Sterilization Verified (required)
                      </label>
                    </div>
                  </div>

                  {existingClient && (
                    <div className="bg-amber-950/30 border border-amber-800/40 p-3 rounded-lg flex items-center justify-between text-xs text-amber-400">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Award className="w-4 h-4" /> Returning Customer ({completedVisitCounts.get(existingClient.id) ?? 0} completed visits)
                      </span>
                      <span>Total Spent: ₹{(completedVisits.filter(visit => visit.customer_id === existingClient.id)
                        .reduce((sum, visit) => sum + Number(visit.total_amount || 0), 0)).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="saloon-card p-5 rounded-xl space-y-4">
                  <h3 className="text-stone-200 font-semibold flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-amber-500" /> Select Services
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {services.map((service) => {
                      const isSelected = selectedServices.some(s => s.id === service.id);
                      return (
                        <button
                          key={service.id}
                          onClick={() => toggleService(service)}
                          className={`p-3.5 rounded-lg border text-left flex justify-between items-center transition ${isSelected ? 'bg-amber-950/40 border-amber-600 text-amber-300' : 'bg-[#0f0d0e] border-stone-800 text-stone-300 hover:border-stone-700'}`}
                        >
                          <div>
                            <div className="font-medium text-sm">{service.service_name}</div>
                            <div className="text-xs text-stone-500">{service.category}</div>
                          </div>
                          <div className="font-semibold text-amber-500">₹{service.price}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="saloon-card p-5 rounded-xl flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <h3 className="text-stone-200 font-semibold pb-2 border-b border-stone-800">Billing Summary</h3>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedServices.length === 0 ? (
                      <p className="text-stone-500 text-xs text-center py-6">Koi service select nahi hui hai</p>
                    ) : (
                      selectedServices.map(s => (
                        <div key={s.id} className="flex justify-between text-xs py-1 border-b border-stone-800/50">
                          <span className="text-stone-300">{s.service_name}</span>
                          <span className="font-medium text-amber-500">₹{s.price}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-4 border-t border-stone-800 space-y-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Amount:</span>
                      <span className="text-amber-500">₹{totalBill}</span>
                    </div>

                    <div>
                      <label className="text-xs text-stone-400 block mb-1.5">Payment Mode</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['UPI', 'Cash', 'Card'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => setPaymentMode(mode)}
                            className={`py-1.5 rounded text-xs font-medium border transition ${paymentMode === mode ? 'bg-amber-600 border-amber-600 text-stone-950' : 'bg-[#0f0d0e] border-stone-800 text-stone-400'}`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 pt-4">
                  <button
                    onClick={() => handleCreateVisit('Completed')}
                    disabled={savingVisit}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-amber-600/10"
                  >
                    <CheckCircle2 className="w-4 h-4" /> {savingVisit ? 'Saving Visit…' : 'Save Visit & Generate Receipt'}
                  </button>
                  <button
                    onClick={() => handleCreateVisit('Waiting')}
                    disabled={savingVisit}
                    className="w-full bg-stone-900 hover:bg-stone-800 text-stone-300 font-medium py-2.5 rounded-lg border border-stone-700 text-xs transition"
                  >
                    Add to Waiting Queue
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RECEIPT POPUP MODAL */}
        {activeReceipt && (
          <div className="receipt-overlay fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 print:bg-transparent print:p-0">
            <div className="print-receipt-modal bg-white text-stone-900 p-6 rounded-xl max-w-sm w-full space-y-4 font-mono shadow-2xl relative">
              <button
                onClick={() => setActiveReceipt(null)}
                className="absolute top-3 right-3 text-stone-500 hover:text-stone-900 print:hidden"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center pb-3 border-b border-dashed border-stone-400 space-y-1">
                <h3 className="font-bold text-lg">VINTAGE BARBER LOUNGE</h3>
                <p className="text-xs text-stone-600">Official Customer Invoice</p>
                <div className="text-[10px] text-stone-500">{activeReceipt.date}</div>
              </div>

              <div className="text-xs space-y-1">
                <div className="flex justify-between"><span>Customer:</span><span className="font-bold">{activeReceipt.name}</span></div>
                <div className="flex justify-between"><span>Phone:</span><span>{activeReceipt.phone}</span></div>
                <div className="flex justify-between"><span>Stylist:</span><span>{activeReceipt.stylist}</span></div>
                <div className="flex justify-between"><span>Status:</span><span className="text-emerald-700 font-bold">PAID ({activeReceipt.paymentMode})</span></div>
              </div>

              <div className="py-2 border-t border-b border-dashed border-stone-400 space-y-1 text-xs">
                {activeReceipt.services.map(s => (
                  <div key={s.id} className="flex justify-between">
                    <span>{s.service_name}</span>
                    <span>₹{s.price}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL:</span>
                <span>₹{activeReceipt.amount}</span>
              </div>

              <div className="text-[10px] text-center text-stone-500 pt-2 border-t border-dashed border-stone-300 space-y-1">
                <p>UV Equipment Sterilization: {activeReceipt.sanitationVerified ? 'Verified' : 'Not verified'}</p>
                <p>Thank you for visiting! Have a great day!</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 print:hidden">
                <button
                  onClick={() => window.print()}
                  className="bg-stone-900 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-stone-800"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Slip
                </button>
                <button
                  onClick={() => sendWhatsAppBill(
                    activeReceipt.phone,
                    activeReceipt.name,
                    activeReceipt.amount,
                    activeReceipt.services,
                    activeReceipt.paymentMode,
                    activeReceipt.sanitationVerified,
                  )}
                  className="bg-emerald-600 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-500"
                >
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE QUEUE */}
        {activeTab === 'queue' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <header className="pb-4 border-b border-stone-800 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-amber-500">Live Customer Queue</h2>
                <p className="text-stone-400 text-sm">Real-time waiting room & status management</p>
              </div>
            </header>

            <div className="space-y-3">
              {visits.filter(v => v.status !== 'Completed').length === 0 ? (
                <div className="saloon-card p-12 text-center rounded-xl space-y-2">
                  <Clock className="w-10 h-10 text-stone-600 mx-auto" />
                  <p className="text-stone-400 font-medium">Abhi queue me koi client nahi hai!</p>
                </div>
              ) : (
                visits.filter(v => v.status !== 'Completed').map(v => (
                  <div key={v.id} className="saloon-card p-4 rounded-xl flex items-center justify-between border-l-4 border-l-amber-500">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-stone-100">{v.customers?.name || 'Client'}</span>
                        <span className="text-xs text-stone-400">({v.customers?.phone})</span>
                      </div>
                      <div className="text-xs text-stone-400">
                        Services: {v.services_done?.map(s => s.service_name).join(', ') || 'No services recorded'}
                      </div>
                      <div className="text-xs text-amber-500/80 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> Stylist: {v.stylist_name || 'General Staff'}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${v.status === 'In-Progress' ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-stone-800 text-stone-400'}`}>
                        {v.status}
                      </span>
                      {v.status === 'Waiting' && (
                        <button
                          onClick={() => updateQueueStatus(v.id, 'In-Progress')}
                          className="bg-amber-600 text-stone-950 font-bold px-3 py-1.5 rounded text-xs hover:bg-amber-500 transition"
                        >
                          Start Service
                        </button>
                      )}
                      {v.status === 'In-Progress' && (
                        <button
                          onClick={() => updateQueueStatus(v.id, 'Completed')}
                          className="bg-emerald-600 text-white font-bold px-3 py-1.5 rounded text-xs hover:bg-emerald-500 transition"
                        >
                          Finish & Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: OWNER & STAFF ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <header className="pb-4 border-b border-stone-800">
              <h2 className="text-2xl font-bold text-amber-500">Owner & Staff Performance</h2>
              <p className="text-stone-400 text-sm">Revenue metrics, staff commissions & lifetime spend</p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="saloon-card p-5 rounded-xl border-t-2 border-t-amber-500 space-y-2">
                <div className="text-stone-400 text-xs font-medium">Total Revenue</div>
                <div className="text-3xl font-bold text-amber-500">₹{totalRevenue.toLocaleString()}</div>
                <div className="text-xs text-stone-500">{totalVisitsCount} Completed Visits</div>
              </div>

              <div className="saloon-card p-5 rounded-xl border-t-2 border-t-amber-600 space-y-2">
                <div className="text-stone-400 text-xs font-medium">Regular Clients</div>
                <div className="text-3xl font-bold text-stone-100">{regularClients.length}</div>
                <div className="text-xs text-stone-500">{(retentionBase ? (regularClients.length / retentionBase) * 100 : 0).toFixed(0)}% Returning Client Rate</div>
              </div>

              <div className="saloon-card p-5 rounded-xl border-t-2 border-t-amber-700 space-y-2">
                <div className="text-stone-400 text-xs font-medium">Total Stylists</div>
                <div className="text-3xl font-bold text-stone-100">{STYLISTS.length}</div>
                <div className="text-xs text-amber-500/80">Active Performance Tracking</div>
              </div>
            </div>

            <div className="saloon-card p-5 rounded-xl space-y-4">
              <h3 className="text-stone-200 font-semibold flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-500" /> Stylist Commission & Performance (15% Rate)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0f0d0e] text-stone-400 border-b border-stone-800">
                    <tr>
                      <th className="p-3">Stylist / Barber Name</th>
                      <th className="p-3">Clients Served</th>
                      <th className="p-3">Total Business Generated</th>
                      <th className="p-3">Estimated Staff Commission (15%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60">
                    {stylistStats.map(stat => (
                      <tr key={stat.name} className="hover:bg-stone-900/50">
                        <td className="p-3 font-medium text-stone-200">{stat.name}</td>
                        <td className="p-3 text-stone-300">{stat.visitsCount} visits</td>
                        <td className="p-3 font-bold text-stone-100">₹{stat.revenue}</td>
                        <td className="p-3 font-bold text-amber-500">₹{stat.commission}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT & COMPLIANCE HUB */}
        {activeTab === 'audit' && (
          <div className="print-audit-content max-w-5xl mx-auto space-y-6">
            <header className="pb-4 border-b border-stone-800 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-amber-500 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-amber-500" /> Administrative Audit & Compliance Hub
                </h2>
                <p className="text-stone-400 text-sm">Recorded revenue and illustrative estimates; not tax or loan eligibility advice</p>
              </div>

              <button
                onClick={() => window.print()}
                className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 shadow-lg shadow-amber-600/20 transition print:hidden"
              >
                <Printer className="w-4 h-4" /> Print Audit Sheet
              </button>
            </header>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="saloon-card p-4 rounded-xl space-y-1">
                <span className="text-xs text-stone-400 font-medium">Gross Business</span>
                <div className="text-xl font-bold text-stone-100">₹{totalRevenue.toLocaleString()}</div>
              </div>
              <div className="saloon-card p-4 rounded-xl space-y-1">
                <span className="text-xs text-emerald-400 font-medium">UPI Digital</span>
                <div className="text-xl font-bold text-emerald-400">₹{upiRevenue.toLocaleString()}</div>
              </div>
              <div className="saloon-card p-4 rounded-xl space-y-1">
                <span className="text-xs text-amber-400 font-medium">Cash Business</span>
                <div className="text-xl font-bold text-amber-400">₹{cashRevenue.toLocaleString()}</div>
              </div>
              <div className="saloon-card p-4 rounded-xl space-y-1">
                <span className="text-xs text-blue-400 font-medium">Card Revenue</span>
                <div className="text-xl font-bold text-blue-400">₹{cardRevenue.toLocaleString()}</div>
              </div>
              <div className="saloon-card p-4 rounded-xl space-y-1">
                <span className="text-xs text-purple-400 font-medium">Illustrative 5% GST estimate</span>
                <div className="text-xl font-bold text-purple-400">₹{estimatedGst}</div>
              </div>
            </div>

            <div className="saloon-card p-4 rounded-xl bg-purple-950/20 border border-purple-900/40 text-xs flex justify-between items-center">
              <span className="text-stone-400">Turnover indicator (scheme eligibility not verified):</span>
              <span className="font-bold text-purple-300">{turnoverIndicator}</span>
            </div>

            {/* Master Audit Log Table */}
            <div className="saloon-card p-5 rounded-xl space-y-4">
              <h3 className="text-stone-200 font-semibold text-sm">Master Transaction & Sanitation Log</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0f0d0e] text-stone-400 border-b border-stone-800">
                    <tr>
                      <th className="p-3">Date & Time</th>
                      <th className="p-3">Customer Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Services</th>
                      <th className="p-3">Stylist</th>
                      <th className="p-3">Sanitation Check</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60">
                    {visits.map(v => (
                      <tr key={v.id} className="hover:bg-stone-900/50">
                        <td className="p-3 text-stone-400">{new Date(v.created_at).toLocaleString()}</td>
                        <td className="p-3 font-medium text-stone-200">{v.customers?.name || 'Walk-in Client'}</td>
                        <td className="p-3 text-stone-400">{v.customers?.phone || 'N/A'}</td>
                        <td className="p-3 text-stone-300">{v.services_done?.map(s => s.service_name).join(', ') || 'No services recorded'}</td>
                        <td className="p-3 text-amber-500/90 font-medium">{v.stylist_name || 'General Staff'}</td>
                        <td className="p-3">
                          {v.sanitation_verified ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                              UV VERIFIED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-300 border border-red-800">
                              NOT VERIFIED
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-stone-100 text-right">₹{Number(v.total_amount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: AI BUSINESS ADVISOR */}
        {activeTab === 'ai' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <header className="pb-4 border-b border-stone-800">
              <h2 className="text-2xl font-bold text-amber-500 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" /> AI Business Advisor & Audit Engine
              </h2>
              <p className="text-stone-400 text-sm">Ask any question about revenue, staff commission, or customer trends</p>
            </header>

            <div className="saloon-card p-5 rounded-xl space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-stone-400">Ask your database anything (Hindi / Hinglish / English):</label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="e.g. Total kitna digital UPI payment aaya hai aur kitne barbers active hain?"
                  className="w-full bg-[#0f0d0e] border border-stone-800 rounded-lg p-3 text-stone-100 text-sm focus:outline-none focus:border-amber-600 transition"
                />
              </div>

              <button
                onClick={askAiAssistant}
                disabled={aiLoading}
                className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold px-5 py-2.5 rounded-lg text-xs transition flex items-center gap-2 shadow-lg shadow-amber-600/10 disabled:opacity-50"
              >
                {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiLoading ? 'Analyzing Database...' : 'Ask Advisor'}
              </button>
            </div>

            {aiResponse && (
              <div className="saloon-card p-6 rounded-xl border-l-4 border-l-amber-500 space-y-2">
                <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider">Advisor Insight</h4>
                <p className="text-stone-200 text-sm leading-relaxed whitespace-pre-line">{aiResponse}</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}