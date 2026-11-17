'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { SALON_CONFIG } from '../lib/salon-config';
import { getSaloonId, getSupabasePublicConfig } from '../lib/supabase';
import type { Database } from '../lib/database.types';

interface ServiceItem {
  id: string;
  service_name: string;
  price: number;
  category: string;
}

const FALLBACK_SERVICES: ServiceItem[] = [
  { id: 'fallback-haircut', service_name: 'Classic Haircut', price: 250, category: 'Hair' },
  { id: 'fallback-beard', service_name: 'Beard Grooming', price: 200, category: 'Beard' },
  { id: 'fallback-facial', service_name: 'Signature Facial', price: 799, category: 'Skin' },
  { id: 'fallback-head-massage', service_name: 'Head Massage', price: 399, category: 'Spa' },
  { id: 'fallback-hair-spa', service_name: 'Hair Spa', price: 999, category: 'Hair' },
  { id: 'fallback-cleanup', service_name: 'Face Cleanup', price: 499, category: 'Skin' },
];

const TIME_SLOTS = [
  '9:30 AM', '10:30 AM', '11:30 AM', '12:30 PM', '1:30 PM', '2:30 PM',
  '3:30 PM', '4:30 PM', '5:30 PM', '6:30 PM', '7:30 PM', '8:30 PM',
];

export default function PublicBookingPage() {
  const [services, setServices] = useState<ServiceItem[]>(FALLBACK_SERVICES);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [serviceNotice, setServiceNotice] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [bookingError, setBookingError] = useState('');
  const total = useMemo(
    () => services.reduce((sum, service) => selectedIds.includes(service.id) ? sum + Number(service.price) : sum, 0),
    [selectedIds, services],
  );

  useEffect(() => {
    let active = true;
    try {
      const { url, anonKey } = getSupabasePublicConfig();
      const supabase = createBrowserClient<Database>(url, anonKey);
      void supabase
        .from('services')
        .select('id,service_name,price,category')
        .eq('saloon_id', getSaloonId())
        .order('category')
        .limit(100)
        .then(({ data, error }) => {
          if (!active) return;
          if (error) {
            console.warn('Public service menu is unavailable; using the sample menu.', error);
            setServiceNotice('Showing a sample menu. Please confirm current prices when you arrive.');
          } else if (data?.length) {
            setServices(data);
            setSelectedIds([]);
            setServiceNotice('');
          } else {
            setServiceNotice('Showing a sample menu. Please confirm current prices when you arrive.');
          }
        });
    } catch (error) {
      console.warn('Public service menu is unavailable; using the sample menu.', error);
    }

    return () => {
      active = false;
    };
  }, []);

  const toggleService = (id: string) => {
    setSelectedIds(current => current.includes(id)
      ? current.filter(selectedId => selectedId !== id)
      : [...current, id]);
  };

  const confirmBooking = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedServices = services.filter(service => selectedIds.includes(service.id));
    if (!selectedServices.length) return;
    if (!customerName.trim()) {
      setBookingError('Enter your name to request an appointment.');
      return;
    }
    const selectedDate = new Date(`${bookingDate}T00:00:00`);
    const earliestDate = new Date();
    earliestDate.setHours(0, 0, 0, 0);
    if (selectedDate < earliestDate) {
      setBookingError('Choose today or a future date for your appointment.');
      return;
    }
    setBookingError('');

    const message = [
      `Hello ${SALON_CONFIG.fullName}, I would like to book an appointment.`,
      '',
      `Name: ${customerName.trim()}`,
      `Date: ${bookingDate}`,
      `Time: ${timeSlot}`,
      'Services:',
      ...selectedServices.map(service => `- ${service.service_name} (₹${Number(service.price).toLocaleString('en-IN')})`),
      `Estimated total: ₹${total.toLocaleString('en-IN')}`,
    ].join('\n');

    window.open(
      `https://wa.me/${SALON_CONFIG.phone}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  return (
    <main className="min-h-screen bg-[#0f0d0e] text-stone-100">
      <nav className="sticky top-0 z-30 border-b border-amber-900/30 bg-[#0f0d0e]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <a href="#" className="leading-tight" aria-label={SALON_CONFIG.fullName}>
            <span className="block text-sm font-black tracking-[0.18em] text-amber-400 sm:text-base">{SALON_CONFIG.name}</span>
            <span className="text-xs text-stone-400">{SALON_CONFIG.subName}</span>
          </a>
          <div className="flex items-center gap-3 sm:gap-6">
            <a href="#booking" className="rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-stone-950 transition hover:bg-amber-400 sm:text-sm">
              Book Slot
            </a>
            <Link href="/admin" className="text-xs font-semibold text-stone-300 transition hover:text-amber-400 sm:text-sm">
              Staff Login
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden border-b border-amber-900/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(217,119,6,0.17),transparent_55%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:py-28 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-700/50 bg-emerald-950/40 px-4 py-2 text-xs font-semibold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              UV equipment sterilization for your peace of mind
            </div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-amber-500">Grooming, Hair & Skin Studio · {SALON_CONFIG.city}</p>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              Your style, elevated at <span className="text-amber-400">{SALON_CONFIG.fullName}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-stone-400 sm:text-lg">{SALON_CONFIG.tagline}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#booking" className="rounded-lg bg-amber-500 px-6 py-3.5 text-center text-sm font-bold text-stone-950 transition hover:bg-amber-400">
                Book on WhatsApp Instantly
              </a>
              <a href={SALON_CONFIG.googleMapsDirectionsUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-stone-700 px-6 py-3.5 text-center text-sm font-semibold text-stone-200 transition hover:border-amber-600 hover:text-amber-300">
                Get Google Maps Directions
              </a>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-3 border-t border-stone-800 pt-6">
              {[
                ['4.9★', 'Google Rating'],
                ['1,500+', 'Happy Clients'],
                ['100%', 'UV Sanitized'],
              ].map(([value, label]) => (
                <div key={label}>
                  <div className="text-xl font-black text-amber-400 sm:text-2xl">{value}</div>
                  <div className="mt-1 text-[10px] text-stone-500 sm:text-xs">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-900/40 bg-[#181517] p-7 shadow-2xl shadow-black/30 sm:p-9">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500">The experience</div>
            <h2 className="mt-4 text-2xl font-bold leading-snug sm:text-3xl">A little time for yourself goes a long way.</h2>
            <p className="mt-4 leading-7 text-stone-400">From a sharp, classic cut to a restorative facial, enjoy thoughtful care from a team that puts comfort and cleanliness first.</p>
            <a href="#services" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-amber-400 hover:text-amber-300">
              Explore our services <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 sm:py-20">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-500">Service menu</p>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">Pick your perfect reset</h2>
          <p className="mt-3 text-sm leading-6 text-stone-400">Choose one or more services to see your estimated total and request your preferred slot.</p>
        </div>
        {serviceNotice && <p className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/30 p-3 text-xs text-amber-200">{serviceNotice}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(service => {
            const selected = selectedIds.includes(service.id);
            return (
              <button
                type="button"
                key={service.id}
                aria-pressed={selected}
                onClick={() => toggleService(service.id)}
                className={`flex items-center justify-between rounded-xl border p-5 text-left transition ${selected ? 'border-amber-500 bg-amber-950/30' : 'border-stone-800 bg-[#181517] hover:border-stone-600'}`}
              >
                <span>
                  <span className="block font-bold text-stone-100">{service.service_name}</span>
                  <span className="mt-1 block text-xs text-stone-500">{service.category}</span>
                </span>
                <span className="ml-3 whitespace-nowrap font-bold text-amber-400">₹{Number(service.price).toLocaleString('en-IN')}</span>
              </button>
            );
          })}
        </div>

        <form id="booking" onSubmit={confirmBooking} className="mt-10 scroll-mt-24 rounded-2xl border border-amber-900/40 bg-[#181517] p-5 sm:p-8">
          <div className="flex flex-col justify-between gap-3 border-b border-stone-800 pb-5 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-bold">Request your appointment</h3>
              <p className="mt-1 text-xs text-stone-500">Your booking is confirmed directly with our team on WhatsApp.</p>
            </div>
            <div className="text-lg font-black text-amber-400">Estimated total: ₹{total.toLocaleString('en-IN')}</div>
          </div>
          <div className="grid gap-4 py-5 sm:grid-cols-3">
            <label className="text-xs font-semibold text-stone-300">
              Your name
              <input required maxLength={120} value={customerName} onChange={event => setCustomerName(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-700 bg-[#0f0d0e] px-3 py-3 text-sm text-stone-100 outline-none focus:border-amber-500" placeholder="Enter your name" />
            </label>
            <label className="text-xs font-semibold text-stone-300">
              Preferred date
              <input required type="date" value={bookingDate} onChange={event => { setBookingDate(event.target.value); setBookingError(''); }} className="mt-2 w-full rounded-lg border border-stone-700 bg-[#0f0d0e] px-3 py-3 text-sm text-stone-100 outline-none focus:border-amber-500" />
            </label>
            <label className="text-xs font-semibold text-stone-300">
              Time slot
              <select required value={timeSlot} onChange={event => setTimeSlot(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-700 bg-[#0f0d0e] px-3 py-3 text-sm text-stone-100 outline-none focus:border-amber-500">
                <option value="" disabled>Select a time</option>
                {TIME_SLOTS.map(slot => <option key={slot} value={slot}>{slot}</option>)}
              </select>
            </label>
          </div>
          {bookingError && <p role="alert" className="mb-4 text-sm text-red-300">{bookingError}</p>}
          <button type="submit" disabled={!selectedIds.length} className="w-full rounded-lg bg-amber-500 px-6 py-3.5 text-sm font-black text-stone-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
            Confirm via WhatsApp
          </button>
        </form>
      </section>

      <section className="border-y border-stone-800 bg-[#141214]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-500">Come visit</p>
            <h2 className="mt-3 text-3xl font-black">Find us in {SALON_CONFIG.city}</h2>
            <address className="mt-5 not-italic leading-7 text-stone-300">{SALON_CONFIG.address}</address>
            <p className="mt-3 text-sm text-stone-400">{SALON_CONFIG.timings}</p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
              <a href={`tel:+${SALON_CONFIG.phone}`} className="text-amber-400 hover:text-amber-300">{SALON_CONFIG.displayPhone}</a>
              <a href={SALON_CONFIG.googleMapsDirectionsUrl} target="_blank" rel="noreferrer" className="text-stone-300 hover:text-amber-300">Open directions ↗</a>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-stone-700">
            <iframe
              title={`Map to ${SALON_CONFIG.fullName}`}
              src={SALON_CONFIG.googleMapsEmbedUrl}
              className="h-72 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-5 py-7 text-xs text-stone-500 sm:flex-row sm:justify-between">
        <span>© {SALON_CONFIG.fullName}</span>
        <span>{SALON_CONFIG.address}</span>
      </footer>
    </main>
  );
}
