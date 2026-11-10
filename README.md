# Saloon Management & Analytics OS

Next.js App Router application for saloon reception, billing, queue management, compliance records, and owner analytics.

## Requirements

- Node.js supported by the installed Next.js 16 version
- A Supabase project with the app's base `saloons`, `services`, `customers`, and `visits` tables
- A Gemini API key to use the AI advisor

## Environment

Configure these values in `.env.local` for local development and in the deployment platform for production:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
NEXT_PUBLIC_SALOON_ID=YOUR_SALOON_UUID
GEMINI_API_KEY=YOUR_SERVER_SIDE_GEMINI_KEY
```

The Supabase public/anon key is intended to be visible to the browser. Database security must come from the RLS policies below; never put a Supabase `service_role` key in a `NEXT_PUBLIC_*` variable or in this app's runtime environment.

## Database and authentication setup

1. Back up the project and apply every SQL migration in `supabase/migrations/` in filename order. The auth/RLS migration expects the base tables and columns used by this app: UUID primary keys, `saloon_id`, `customers.phone`, customer totals, `visits.customer_id`, `visits.services_done` as JSONB, visit payment/status fields, and the service name/price/category fields.
2. Before applying the auth/RLS migration, resolve any duplicate `(saloon_id, phone)` customer records. The migration deliberately stops rather than guessing which records to merge.
3. Create staff accounts using Supabase Auth. Provision each initial owner membership through the Supabase SQL editor or a trusted administrative process:

   ```sql
   insert into public.saloon_members (user_id, saloon_id, role)
   values ('AUTH_USER_UUID', 'SALOON_UUID', 'owner');
   ```

   Add further memberships as `admin` or `staff`. Do not add a membership-management service key to the application.
4. Set `NEXT_PUBLIC_SALOON_ID` to the same saloon UUID and test with separate owner, staff, and unauthenticated accounts. Staff can use reception/queue features; only owners and admins can use `/admin` and the AI analytics API.
5. Verify the applied RLS policies and RPC grants in the deployed Supabase project before accepting real customer data. The migration replaces existing policies on the app's five tables with membership-based policies.

`NEXT_PUBLIC_SALOON_ID` selects the app's configured saloon, but it is not an authorization boundary. Supabase membership checks, RLS, and authorization inside database RPCs enforce access. Never expose a database service-role key to the browser or API route.

## Local development and checks

```bash
npm install
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

Apply and verify database migrations against a non-production Supabase project before deploying. Database SQL migrations are not validated by the JavaScript build.
