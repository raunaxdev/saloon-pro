import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

interface VisitRecord {
  id: string;
  total_amount: number;
  status: string;
  customers?: {
    name: string;
  };
}

interface CustomerRecord {
  id: string;
  name: string;
  total_visits: number;
  total_spent: number;
  last_visit: string;
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('query' in body) ||
      typeof body.query !== 'string' ||
      !body.query.trim() ||
      body.query.length > 1000
    ) {
      return NextResponse.json(
        { error: 'Provide a question between 1 and 1000 characters.' },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server.' },
        { status: 500 },
      );
    }

    const saloonId = process.env.NEXT_PUBLIC_SALOON_ID;
    if (!saloonId) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_SALOON_ID is not configured.' },
        { status: 500 },
      );
    }

    const [
      { data: visits, error: visitsError },
      { data: customers, error: customersError },
    ] = await Promise.all([
      supabase
        .from('visits')
        .select('*, customers(name)')
        .eq('saloon_id', saloonId)
        .order('created_at', { ascending: false }),
      supabase
        .from('customers')
        .select('*')
        .eq('saloon_id', saloonId),
    ]);

    if (visitsError) {
      throw new Error(`Failed to load visits: ${visitsError.message}`);
    }
    if (customersError) {
      throw new Error(`Failed to load customers: ${customersError.message}`);
    }

    const typedVisits: VisitRecord[] = (visits ?? []) as VisitRecord[];
    const typedCustomers: CustomerRecord[] = (customers ?? []) as CustomerRecord[];

    const context = {
      total_revenue: typedVisits.reduce(
        (total: number, visit: VisitRecord) =>
          visit.status === 'Completed' ? total + Number(visit.total_amount) : total,
        0,
      ),
      total_customers: typedCustomers.length,
      total_visits: typedVisits.length,
      recent_visits: typedVisits.slice(0, 10).map((visit: VisitRecord) => ({
        id: visit.id,
        total_amount: visit.total_amount,
        status: visit.status,
        customer_name: visit.customers?.name ?? 'Unknown',
      })),
      customers_summary: typedCustomers.map((customer: CustomerRecord) => ({
        name: customer.name,
        visits: customer.total_visits,
        spent: customer.total_spent,
        last_visit: customer.last_visit,
      })),
    };

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are the Business Intelligence AI for "The Vintage Barber Lounge". 
      The saloon owner is asking a question in Hindi/Hinglish/English.
      
      DATABASE LIVE CONTEXT:
      ${JSON.stringify(context, null, 2)}
      
      USER QUESTION: ${body.query}
      
      Respond directly, warmly, and professionally with precise numbers, recommendations, and customer insights in simple Hinglish/English. Keep formatting clean and readable.`
    });

    if (!response.text) {
      return NextResponse.json(
        { error: 'The AI advisor did not return a response. Please try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ text: response.text });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}