type PaginatedResponse<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.');
  }
  return { url, anonKey };
}

export function getSaloonId() {
  const saloonId = process.env.NEXT_PUBLIC_SALOON_ID;
  if (!saloonId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saloonId)) {
    throw new Error('NEXT_PUBLIC_SALOON_ID must be configured as a valid UUID.');
  }
  return saloonId;
}

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PaginatedResponse<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    if (!data) throw new Error('Database returned no page data.');
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
