'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../database.types';
import { getSupabasePublicConfig } from '../supabase';

const { url, anonKey } = getSupabasePublicConfig();

export const supabase = createBrowserClient<Database>(url, anonKey);
