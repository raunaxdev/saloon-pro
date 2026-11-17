'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import { getSalonWhatsAppPhone, SALON_CONFIG } from '../lib/salon-config';
import { getSaloonId, getSupabasePublicConfig } from '../lib/supabase';
import type { Database } from '../lib/database.types';

interface ServiceItem {
  id: string;
  service_name: string;
  price: number;
  category: string;
}

type StyleAdvisorResult = {
  faceShape: { value: string; explanation: string };
  undertone: { value: string; explanation: string };
  recommendations: {
    haircut: { name: string; why: string };
    beardOrSkin: { name: string; why: string };
    barberInstructions: string;
  }[];
  serviceRecommendation: { serviceId: string; reason: string };
};

const FACE_SHAPES = ['Oval', 'Round', 'Square', 'Heart', 'Diamond', 'Oblong', 'Not sure'];
const HAIR_TYPES = ['Straight', 'Wavy', 'Curly', 'Coily', 'Fine', 'Thick', 'Not sure'];

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
  const [serviceNotice, setServiceNotice] = useState(
    'Showing a sample menu. Please confirm current prices when you arrive.',
  );
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [selfie, setSelfie] = useState('');
  const [selfieProcessing, setSelfieProcessing] = useState(false);
  const [faceShape, setFaceShape] = useState('');
  const [hairType, setHairType] = useState('');
  const [advisorResult, setAdvisorResult] = useState<StyleAdvisorResult | null>(null);
  const [advisorError, setAdvisorError] = useState('');
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [bookingHighlighted, setBookingHighlighted] = useState(false);
  const bookingFormRef = useRef<HTMLFormElement>(null);
  const bookingHighlightTimeoutRef = useRef<number | null>(null);
  const total = useMemo(
    () => services.reduce((sum, service) => selectedIds.includes(service.id) ? sum + Number(service.price) : sum, 0),
    [selectedIds, services],
  );
  const salonWhatsAppPhone = getSalonWhatsAppPhone();

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
        }, (error: unknown) => {
          if (!active) return;
          console.warn('Public service menu is unavailable; using the sample menu.', error);
          setServiceNotice('Showing a sample menu. Please confirm current prices when you arrive.');
        });
    } catch (error) {
      console.warn('Public service menu is unavailable; using the sample menu.', error);
    }

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => {
    if (bookingHighlightTimeoutRef.current !== null) {
      window.clearTimeout(bookingHighlightTimeoutRef.current);
    }
  }, []);

  const toggleService = (id: string) => {
    setSelectedIds(current => current.includes(id)
      ? current.filter(selectedId => selectedId !== id)
      : [...current, id]);
  };

  const resizeSelfie = async (file: File) => {
    setSelfie('');
    setAdvisorResult(null);
    setAdvisorError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAdvisorError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAdvisorError('Choose an image smaller than 10 MB.');
      return;
    }

    setSelfieProcessing(true);
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new window.Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('The image could not be opened.'));
        image.src = objectUrl;
      });
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 20_000_000) {
        throw new Error('Choose a valid image with no more than 20 megapixels.');
      }

      const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image resizing is not supported in this browser.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      setSelfie(canvas.toDataURL('image/jpeg', 0.75));
      setAdvisorError('');
      setAdvisorResult(null);
    } catch (error) {
      setAdvisorError(error instanceof Error ? error.message : 'The image could not be processed.');
    } finally {
      URL.revokeObjectURL(objectUrl);
      setSelfieProcessing(false);
    }
  };

  const requestStyleAdvice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selfie && !faceShape && !hairType) {
      setAdvisorError('Upload a selfie or choose your face shape or hair type first.');
      return;
    }
    setAdvisorLoading(true);
    setAdvisorError('');
    setAdvisorResult(null);
    try {
      const response = await fetch('/api/style-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: selfie ? selfie.split(',')[1] : '',
          faceShape,
          hairType,
          services,
        }),
      });
      const payload = await response.json() as StyleAdvisorResult | { error?: string };
      if (!response.ok) {
        throw new Error('error' in payload && payload.error ? payload.error : 'Style advice could not be generated.');
      }
      setAdvisorResult(payload as StyleAdvisorResult);
    } catch (error) {
      setAdvisorError(error instanceof Error ? error.message : 'Style advice could not be generated.');
    } finally {
      setAdvisorLoading(false);
    }
  };

  const addRecommendedService = () => {
    const recommendedId = advisorResult?.serviceRecommendation.serviceId;
    if (!recommendedId || !services.some(service => service.id === recommendedId)) {
      setAdvisorError('That recommendation is no longer on the current service menu. Please try again.');
      return;
    }
    setSelectedIds(current => current.includes(recommendedId) ? current : [...current, recommendedId]);
    setServiceNotice('Recommended service added to your booking.');
    bookingFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setBookingHighlighted(true);
    if (bookingHighlightTimeoutRef.current !== null) {
      window.clearTimeout(bookingHighlightTimeoutRef.current);
    }
    bookingHighlightTimeoutRef.current = window.setTimeout(() => {
      setBookingHighlighted(false);
      bookingHighlightTimeoutRef.current = null;
    }, 2200);
  };

  const confirmBooking = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedServices = services.filter(service => selectedIds.includes(service.id));
    if (!selectedServices.length) {
      setBookingError('Choose at least one service before requesting an appointment.');
      return;
    }
    if (!customerName.trim()) {
      setBookingError('Enter your name to request an appointment.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(customerPhone)) {
      setBookingError('Enter a valid 10-digit Indian mobile number for the salon to call you back.');
      return;
    }
    const selectedDate = new Date(`${bookingDate}T00:00:00`);
    const earliestDate = new Date();
    earliestDate.setHours(0, 0, 0, 0);
    if (!bookingDate || Number.isNaN(selectedDate.getTime()) || selectedDate < earliestDate) {
      setBookingError('Choose today or a future date for your appointment.');
      return;
    }
    if (!TIME_SLOTS.includes(timeSlot)) {
      setBookingError('Choose a valid appointment time.');
      return;
    }
    if (!salonWhatsAppPhone) {
      setBookingError('The salon WhatsApp number is not configured correctly. Please contact the salon by phone.');
      return;
    }
    setBookingError('');

    const message = [
      `Hello ${SALON_CONFIG.fullName}, I would like to book an appointment.`,
      '',
      `Name: ${customerName.trim()}`,
      `Callback phone: +91 ${customerPhone}`,
      `Date: ${bookingDate}`,
      `Time: ${timeSlot}`,
      'Services:',
      ...selectedServices.map(service => `- ${service.service_name} (₹${Number(service.price).toLocaleString('en-IN')})`),
      `Estimated total: ₹${total.toLocaleString('en-IN')}`,
    ].join('\n');

    window.open(
      `https://wa.me/${salonWhatsAppPhone}?text=${encodeURIComponent(message)}`,
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
            <a href="#style-advisor" className="hidden text-xs font-semibold text-stone-300 transition hover:text-amber-400 sm:inline-flex sm:text-sm">
              AI Style Advisor
            </a>
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
              <a href="#style-advisor" className="rounded-lg border border-amber-700/60 px-6 py-3.5 text-center text-sm font-semibold text-amber-300 transition hover:border-amber-500 hover:text-amber-200">
                Get AI Style Advice
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

      <section id="style-advisor" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-900/40 bg-[#181517] p-5 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-500">AI Face-Shape &amp; Style Advisor</p>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">Find a style that fits you</h2>
          <p className="mt-3 text-sm leading-6 text-stone-400">
            Upload a selfie for a visual suggestion, or choose details yourself. Your image is resized in your browser and sent to Gemini for this request; this app does not store it.
          </p>
          <form onSubmit={requestStyleAdvice} className="mt-6 space-y-5">
            <label className="block text-xs font-semibold text-stone-300">
              Selfie (optional)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void resizeSelfie(file);
                  else setSelfie('');
                }}
                className="mt-2 block w-full rounded-lg border border-stone-700 bg-[#0f0d0e] px-3 py-3 text-sm text-stone-300 file:mr-3 file:rounded-md file:border-0 file:bg-amber-500 file:px-3 file:py-2 file:text-xs file:font-bold file:text-stone-950"
              />
              {selfie && <NextImage src={selfie} alt="Resized selfie preview" width={128} height={128} unoptimized className="mt-3 h-32 w-32 rounded-lg object-cover" />}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-stone-300">
                Face shape
                <select value={faceShape} onChange={event => { setFaceShape(event.target.value); setAdvisorResult(null); }} className="mt-2 w-full rounded-lg border border-stone-700 bg-[#0f0d0e] px-3 py-3 text-sm text-stone-100 outline-none focus:border-amber-500">
                  <option value="">Choose if you know it</option>
                  {FACE_SHAPES.map(shape => <option key={shape} value={shape}>{shape}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-stone-300">
                Hair type
                <select value={hairType} onChange={event => { setHairType(event.target.value); setAdvisorResult(null); }} className="mt-2 w-full rounded-lg border border-stone-700 bg-[#0f0d0e] px-3 py-3 text-sm text-stone-100 outline-none focus:border-amber-500">
                  <option value="">Choose if you know it</option>
                  {HAIR_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
            </div>
            {advisorError && <p role="alert" className="text-sm text-red-300">{advisorError}</p>}
            <button type="submit" disabled={advisorLoading || selfieProcessing} className="rounded-lg bg-amber-500 px-5 py-3 text-sm font-black text-stone-950 transition hover:bg-amber-400 disabled:cursor-wait disabled:opacity-50">
              {advisorLoading ? 'Finding your style…' : selfieProcessing ? 'Resizing your selfie…' : 'Get my style advice'}
            </button>
          </form>

          {advisorResult && (
            <div className="mt-8 border-t border-stone-800 pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-stone-800 bg-[#0f0d0e] p-4">
                  <h3 className="font-bold text-amber-300">Face shape</h3>
                  <p className="mt-1 text-sm font-semibold">{advisorResult.faceShape.value}</p>
                  <p className="mt-1 text-xs leading-5 text-stone-400">{advisorResult.faceShape.explanation}</p>
                </div>
                <div className="rounded-lg border border-stone-800 bg-[#0f0d0e] p-4">
                  <h3 className="font-bold text-amber-300">Skin undertone</h3>
                  <p className="mt-1 text-sm font-semibold">{advisorResult.undertone.value}</p>
                  <p className="mt-1 text-xs leading-5 text-stone-400">{advisorResult.undertone.explanation}</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                {advisorResult.recommendations.map((recommendation, index) => (
                  <article key={`${recommendation.haircut.name}-${index}`} className="rounded-lg border border-stone-800 bg-[#0f0d0e] p-4">
                    <h3 className="font-bold text-stone-100">Style {index + 1}: {recommendation.haircut.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-stone-400">{recommendation.haircut.why}</p>
                    <h4 className="mt-3 text-sm font-bold text-amber-300">{recommendation.beardOrSkin.name}</h4>
                    <p className="mt-1 text-sm leading-6 text-stone-400">{recommendation.beardOrSkin.why}</p>
                    <p className="mt-3 text-xs leading-5 text-stone-300"><span className="font-bold">Tell your barber:</span> {recommendation.barberInstructions}</p>
                  </article>
                ))}
              </div>
              {(() => {
                const matchedService = services.find(service => service.id === advisorResult.serviceRecommendation.serviceId);
                return matchedService ? (
                  <div className="mt-5 rounded-lg border border-amber-800/50 bg-amber-950/20 p-4">
                    <h3 className="font-bold text-amber-300">Recommended salon service</h3>
                    <p className="mt-1 text-sm text-stone-100">{matchedService.service_name} · ₹{Number(matchedService.price).toLocaleString('en-IN')}</p>
                    <p className="mt-1 text-xs leading-5 text-stone-400">{advisorResult.serviceRecommendation.reason}</p>
                    <button type="button" onClick={addRecommendedService} className="mt-4 rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-black text-stone-950 transition hover:bg-amber-400">
                      Add Recommended Service to Booking
                    </button>
                  </div>
                ) : <p role="alert" className="mt-5 text-sm text-red-300">The suggested service is no longer available. Please generate a new recommendation.</p>;
              })()}
            </div>
          )}
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

        <form
          id="booking"
          ref={bookingFormRef}
          onSubmit={confirmBooking}
          className={`mt-10 scroll-mt-24 rounded-2xl border border-amber-900/40 bg-[#181517] p-5 transition-shadow sm:p-8 ${bookingHighlighted ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-500/10' : ''}`}
        >
          <div className="flex flex-col justify-between gap-3 border-b border-stone-800 pb-5 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-bold">Request your appointment</h3>
              <p className="mt-1 text-xs text-stone-500">Your booking is confirmed directly with our team on WhatsApp.</p>
            </div>
            <div className="text-lg font-black text-amber-400">Estimated total: ₹{total.toLocaleString('en-IN')}</div>
          </div>
          <div className="grid gap-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-stone-300">
              Your name
              <input required maxLength={120} value={customerName} onChange={event => { setCustomerName(event.target.value); setBookingError(''); }} className="mt-2 w-full rounded-lg border border-stone-700 bg-[#0f0d0e] px-3 py-3 text-sm text-stone-100 outline-none focus:border-amber-500" placeholder="Enter your name" />
            </label>
            <label className="text-xs font-semibold text-stone-300">
              Customer phone
              <input
                required
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                value={customerPhone}
                onChange={event => {
                  setCustomerPhone(event.target.value.replace(/\D/g, '').slice(0, 10));
                  setBookingError('');
                }}
                className="mt-2 w-full rounded-lg border border-stone-700 bg-[#0f0d0e] px-3 py-3 text-sm text-stone-100 outline-none focus:border-amber-500"
                placeholder="10-digit mobile number"
              />
            </label>
            <label className="text-xs font-semibold text-stone-300">
              Preferred date
              <input required type="date" value={bookingDate} onChange={event => { setBookingDate(event.target.value); setBookingError(''); }} className="mt-2 w-full rounded-lg border border-stone-700 bg-[#0f0d0e] px-3 py-3 text-sm text-stone-100 outline-none focus:border-amber-500" />
            </label>
            <label className="text-xs font-semibold text-stone-300">
              Time slot
              <select required value={timeSlot} onChange={event => { setTimeSlot(event.target.value); setBookingError(''); }} className="mt-2 w-full rounded-lg border border-stone-700 bg-[#0f0d0e] px-3 py-3 text-sm text-stone-100 outline-none focus:border-amber-500">
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
              {salonWhatsAppPhone && <a href={`tel:+${salonWhatsAppPhone}`} className="text-amber-400 hover:text-amber-300">{SALON_CONFIG.displayPhone}</a>}
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
