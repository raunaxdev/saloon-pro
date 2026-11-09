'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Scissors, UserPlus, CreditCard, LayoutDashboard,
  Users, Clock, Award, CheckCircle2, Sparkles, RefreshCw
} from 'lucide-react';

const SALOON_ID = process.env.NEXT_PUBLIC_SALOON_ID || '00000000-0000-0000-0000-000000000001';

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
  last_visit: string;
}

interface VisitItem {
  id: string;
  saloon_id: string;
  customer_id: string;
  services_done: ServiceItem[];
  total_amount: number;
  payment_mode: 'Cash' | 'UPI' | 'Card';
  status: 'Waiting' | 'In-Progress' | 'Completed';
  notes?: string;
  created_at: string;
  customers?: CustomerItem;
}

interface DashboardData {
  services: ServiceItem[];
  customers: CustomerItem[];
  visits: VisitItem[];
}

export default function SaloonApp() {
  const [activeTab, setActiveTab] = useState<'billing' | 'queue' | 'analytics' | 'ai'>('billing');
  
  // Data States
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [dataError, setDataError] = useState('');

  // Form States
  const [phone, setPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [existingClient, setExistingClient] = useState<CustomerItem | null>(null);
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card'>('UPI');
  const [notes, setNotes] = useState('');

  // AI Assistant State
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const loadData = useCallback(async (): Promise<DashboardData> => {
    const [
      { data: serviceData, error: serviceError },
      { data: customerData, error: customerError },
      { data: visitData, error: visitError },
    ] = await Promise.all([
      supabase.from('services').select('*').eq('saloon_id', SALOON_ID),
      supabase.from('customers').select('*').eq('saloon_id', SALOON_ID),
      supabase
        .from('visits')
        .select('*, customers(*)')
        .eq('saloon_id', SALOON_ID)
        .order('created_at', { ascending: false }),
    ]);

    const queryError = serviceError ?? customerError ?? visitError;
    if (queryError) {
      throw new Error(`Failed to load salon data: ${queryError.message}`);
    }

    return {
      services: (serviceData ?? []) as ServiceItem[],
      customers: (customerData ?? []) as CustomerItem[],
      visits: (visitData ?? []) as VisitItem[],
    };
  }, []);

  const fetchInitialData = useCallback(async (isMounted: () => boolean = () => true): Promise<void> => {
    try {
      const data = await loadData();
      if (!isMounted()) return;

      setServices(data.services);
      setCustomers(data.customers);
      setVisits(data.visits);
      setDataError('');
    } catch (error: unknown) {
      if (isMounted()) {
        setDataError(error instanceof Error ? error.message : 'Failed to load salon data.');
      }
    }
  }, [loadData]);

  useEffect(() => {
    let isMounted = true;
    const hydrateDashboard = async () => {
      try {
        const data = await loadData();
        if (!isMounted) return;

        setServices(data.services);
        setCustomers(data.customers);
        setVisits(data.visits);
        setDataError('');
      } catch (error: unknown) {
        if (isMounted) {
          setDataError(error instanceof Error ? error.message : 'Failed to load salon data.');
        }
      }
    };

    void hydrateDashboard();

    return () => {
      isMounted = false;
    };
  }, [loadData]);

  // Phone Lookup for Auto-Fill & Past Visit Detection
  const handlePhoneChange = (val: string) => {
    setPhone(val);
    const found = customers.find((customer: CustomerItem) => customer.phone === val.trim());
    if (found) {
      setExistingClient(found);
      setClientName(found.name);
    } else {
      setExistingClient(null);
    }
  };

  const toggleService = (service: ServiceItem) => {
    if (selectedServices.find((item: ServiceItem) => item.id === service.id)) {
      setSelectedServices(selectedServices.filter((item: ServiceItem) => item.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const totalBill = selectedServices.reduce<number>(
    (sum: number, item: ServiceItem) => sum + Number(item.price),
    0,
  );

  // Submit Billing / Entry
  const handleCreateVisit = async (status: 'Completed' | 'Waiting') => {
    if (!phone || !clientName || selectedServices.length === 0) {
      alert('Kripya Client Name, Phone aur kam se kam 1 service select karein!');
      return;
    }

    const normalizedPhone = phone.trim();
    let customerId = existingClient?.id;

    if (!existingClient) {
      const { data: newCust, error: cErr } = await supabase
        .from('customers')
        .insert([{ saloon_id: SALOON_ID, name: clientName.trim(), phone: normalizedPhone, total_visits: 1, total_spent: totalBill }])
        .select()
        .single();
      if (cErr || !newCust) {
        alert(`Customer record banane me error aaya: ${cErr?.message ?? 'No customer was returned.'}`);
        return;
      }
      customerId = newCust.id;
    } else {
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          total_visits: existingClient.total_visits + 1,
          total_spent: Number(existingClient.total_spent) + totalBill,
          last_visit: new Date().toISOString()
        })
        .eq('id', existingClient.id);
      if (customerError) {
        alert(`Customer record update nahi hua: ${customerError.message}`);
        return;
      }
    }

    const { error: vErr } = await supabase.from('visits').insert([{
      saloon_id: SALOON_ID,
      customer_id: customerId,
      services_done: selectedServices,
      total_amount: totalBill,
      payment_mode: paymentMode,
      status,
      notes
    }]);

    if (vErr) {
      alert(`Visit save nahi hui: ${vErr.message}`);
      return;
    }

    alert(status === 'Completed' ? 'Bill generate ho gaya aur visit save ho gayi!' : 'Queue me add kar diya gaya hai!');
    setPhone('');
    setClientName('');
    setSelectedServices([]);
    setExistingClient(null);
    setNotes('');
    await fetchInitialData();
  };

  // Queue Status Updates
  const updateQueueStatus = async (visitId: string, newStatus: VisitItem['status']) => {
    const { error } = await supabase.from('visits').update({ status: newStatus }).eq('id', visitId);
    if (error) {
      setDataError(`Queue status update failed: ${error.message}`);
      return;
    }
    await fetchInitialData();
  };

  // Ask AI Assistant
  const askAiAssistant = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiResponse('');

    try {
      const res = await fetch('/api/ai-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery })
      });
      const data: { text?: string; error?: string } = await res.json();
      if (!res.ok) {
        setAiResponse(data.error ?? `AI request failed with status ${res.status}.`);
        return;
      }
      setAiResponse(data.text ?? 'AI Advisor did not return a response.');
    } catch (error: unknown) {
      setAiResponse(error instanceof Error ? error.message : 'AI Advisor connect karne me dikkat aayi.');
    } finally {
      setAiLoading(false);
    }
  };

  // Analytics Metrics
  const completedVisits = visits.filter((visit: VisitItem) => visit.status === 'Completed');
  const totalRevenue = completedVisits.reduce<number>(
    (total: number, visit: VisitItem) => total + Number(visit.total_amount),
    0,
  );
  const totalVisitsCount = completedVisits.length;
  const regularClients = customers.filter((customer: CustomerItem) => customer.total_visits >= 2);
  const oneTimeClients = customers.filter((customer: CustomerItem) => customer.total_visits === 1);

  return (
    <div className="min-h-screen bg-[#0f0d0e] text-stone-200 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#181517] border-r border-amber-900/30 p-5 flex flex-col justify-between">
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
                {visits.filter((visit: VisitItem) => visit.status !== 'Completed').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'analytics' ? 'bg-amber-600 text-stone-950 font-semibold shadow-lg shadow-amber-600/20' : 'text-stone-400 hover:bg-stone-900 hover:text-amber-500'}`}
            >
              <LayoutDashboard className="w-4 h-4" /> Owner Analytics
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
          <span>Saloon OS v1.0</span>
          <button onClick={() => void fetchInitialData()} aria-label="Refresh dashboard data" className="p-1 hover:text-amber-500 transition"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {dataError && (
          <div role="alert" className="max-w-5xl mx-auto mb-6 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
            {dataError}
          </div>
        )}
        {/* TAB 1: BILLING & RECEPTION */}
        {activeTab === 'billing' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <header className="flex justify-between items-center pb-4 border-b border-stone-800">
              <div>
                <h2 className="text-2xl font-bold text-amber-500">Reception Desk</h2>
                <p className="text-stone-400 text-sm">Quick Client Entry & Instant Invoice Generation</p>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="saloon-card p-5 rounded-xl space-y-4">
                  <h3 className="text-stone-200 font-semibold flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-amber-500" /> Client Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-stone-400 block mb-1">Phone Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 9876543210"
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className="w-full bg-[#0f0d0e] border border-stone-800 rounded-lg px-3.5 py-2.5 text-stone-100 focus:outline-none focus:border-amber-600 transition"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-400 block mb-1">Client Full Name</label>
                      <input
                        type="text"
                        placeholder="Client Name"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full bg-[#0f0d0e] border border-stone-800 rounded-lg px-3.5 py-2.5 text-stone-100 focus:outline-none focus:border-amber-600 transition"
                      />
                    </div>
                  </div>

                  {existingClient && (
                    <div className="bg-amber-950/30 border border-amber-800/40 p-3 rounded-lg flex items-center justify-between text-xs text-amber-400">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Award className="w-4 h-4" /> Returning Customer ({existingClient.total_visits} Visits)
                      </span>
                      <span>Total Spent: ₹{existingClient.total_spent}</span>
                    </div>
                  )}
                </div>

                <div className="saloon-card p-5 rounded-xl space-y-4">
                  <h3 className="text-stone-200 font-semibold flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-amber-500" /> Select Services
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {services.map((service: ServiceItem) => {
                      const isSelected = selectedServices.some((item: ServiceItem) => item.id === service.id);
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
                      selectedServices.map((s: ServiceItem) => (
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
                        {(['UPI', 'Cash', 'Card'] as const).map((mode) => (
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
                    className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-amber-600/10"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Complete & Generate Bill
                  </button>
                  <button
                    onClick={() => handleCreateVisit('Waiting')}
                    className="w-full bg-stone-900 hover:bg-stone-800 text-stone-300 font-medium py-2.5 rounded-lg border border-stone-700 text-xs transition"
                  >
                    Add to Waiting Queue
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE QUEUE */}
        {activeTab === 'queue' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <header className="pb-4 border-b border-stone-800">
              <h2 className="text-2xl font-bold text-amber-500">Live Customer Queue</h2>
              <p className="text-stone-400 text-sm">Real-time waiting room & status management</p>
            </header>

            <div className="space-y-3">
              {visits.filter((visit: VisitItem) => visit.status !== 'Completed').length === 0 ? (
                <div className="saloon-card p-12 text-center rounded-xl space-y-2">
                  <Clock className="w-10 h-10 text-stone-600 mx-auto" />
                  <p className="text-stone-400 font-medium">Abhi queue me koi client nahi hai!</p>
                </div>
              ) : (
                visits.filter((visit: VisitItem) => visit.status !== 'Completed').map((v: VisitItem) => (
                  <div key={v.id} className="saloon-card p-4 rounded-xl flex items-center justify-between border-l-4 border-l-amber-500">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-stone-100">{v.customers?.name || 'Client'}</span>
                        <span className="text-xs text-stone-400">({v.customers?.phone})</span>
                      </div>
                      <div className="text-xs text-stone-400">
                        Services: {v.services_done.map((service: ServiceItem) => service.service_name).join(', ')}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
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

        {/* TAB 3: OWNER ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <header className="pb-4 border-b border-stone-800">
              <h2 className="text-2xl font-bold text-amber-500">Owner Business Dashboard</h2>
              <p className="text-stone-400 text-sm">Revenue metrics, lifetime spend & retention analysis</p>
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
                <div className="text-xs text-stone-500">{((regularClients.length / (customers.length || 1)) * 100).toFixed(0)}% Retention Rate</div>
              </div>

              <div className="saloon-card p-5 rounded-xl border-t-2 border-t-amber-700 space-y-2">
                <div className="text-stone-400 text-xs font-medium">One-Time Visitors</div>
                <div className="text-3xl font-bold text-stone-100">{oneTimeClients.length}</div>
                <div className="text-xs text-amber-500/80">Target for Re-engagement</div>
              </div>
            </div>

            <div className="saloon-card p-5 rounded-xl space-y-4">
              <h3 className="text-stone-200 font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" /> Customer Lifetime Value
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0f0d0e] text-stone-400 border-b border-stone-800">
                    <tr>
                      <th className="p-3">Customer Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Total Visits</th>
                      <th className="p-3">Lifetime Spend</th>
                      <th className="p-3">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60">
                    {customers.map((c: CustomerItem) => (
                      <tr key={c.id} className="hover:bg-stone-900/50">
                        <td className="p-3 font-medium text-stone-200">{c.name}</td>
                        <td className="p-3 text-stone-400">{c.phone}</td>
                        <td className="p-3 text-stone-300">{c.total_visits}</td>
                        <td className="p-3 font-bold text-amber-500">₹{c.total_spent}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.total_visits >= 2 ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-stone-800 text-stone-400'}`}>
                            {c.total_visits >= 2 ? 'REGULAR VIP' : 'ONE-TIME'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AI BUSINESS ADVISOR */}
        {activeTab === 'ai' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <header className="pb-4 border-b border-stone-800">
              <h2 className="text-2xl font-bold text-amber-500 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" /> AI Business Advisor
              </h2>
              <p className="text-stone-400 text-sm">Ask any question about revenue, lost customers, or profit trends</p>
            </header>

            <div className="saloon-card p-5 rounded-xl space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-stone-400">Ask your database anything (Hindi / Hinglish / English):</label>
                <textarea
                  rows={3}
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="e.g. Aaj total kitna revenue hua aur sabse regular customer kaun hai?"
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