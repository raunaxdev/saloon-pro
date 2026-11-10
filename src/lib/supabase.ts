type PaginatedResponse<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

const FALLBACK_SALOON_ID = '00000000-0000-0000-0000-000000000001';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let hasReportedSaloonIdFallback = false;

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.');
  }
  return { url, anonKey };
}

export function getSaloonId(): string {
  const saloonId = process.env.NEXT_PUBLIC_SALOON_ID;
  if (!saloonId || !UUID_PATTERN.test(saloonId)) {
    if (!hasReportedSaloonIdFallback) {
      console.error(
        'NEXT_PUBLIC_SALOON_ID is missing or is not a UUID. Using the non-production fallback ID; configure a real saloon UUID before serving requests.',
      );
      hasReportedSaloonIdFallback = true;
    }
    return FALLBACK_SALOON_ID;
  }
  return saloonId;
}

export async function fetchAllRows<T>(
  queryFn: (from: number, to: number) => PromiseLike<PaginatedResponse<T>>
): Promise<T[]> {
  const pageSize = 1000;
  const allRows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await queryFn(from, to);
    if (error) throw error;
    if (!data) throw new Error('Database returned no page data.');
    allRows.push(...data);
    if (data.length < pageSize) return allRows;
  }
}