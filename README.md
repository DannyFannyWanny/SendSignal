# Signal Web

A modern web platform for connecting people nearby using real-time presence and location-based discovery.

## Features

- **Authentication**: Email magic link sign-in with Supabase Auth
- **Presence Management**: Toggle visibility and automatic location updates
- **Real-time Discovery**: See nearby users with distance calculations
- **Location Services**: GPS coordinates with manual refresh capability
- **Profile Management**: Simple first name setup for new users
- **Responsive Design**: Modern UI built with Tailwind CSS

## Prerequisites

- Node.js 18+ 
- Supabase account and project
- GitHub account (for deployment)
- Vercel account (for hosting)

## Setup

### 1. Environment Variables

Copy the example environment file and configure your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set your Supabase project values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**To find these values:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **Project URL** and **anon public** key

### 2. Supabase Database Setup

In your Supabase Dashboard, go to **SQL Editor** and run these two SQL snippets:

#### **Prompt 3 - Initial Schema (Run First):**

```sql
-- Enable Row Level Security
alter table if exists public.profiles enable row level security;
alter table if exists public.presence enable row level security;

-- profiles: minimal public profile
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  created_at timestamptz default now()
);

-- presence: ephemeral online status + last known location
create table if not exists public.presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_open boolean not null default false,
  lat double precision,
  lng double precision,
  updated_at timestamptz not null default now()
);

-- helpful index
create index if not exists idx_presence_updated_at on public.presence(updated_at);

-- Row Level Security Policies

-- profiles policies
create policy "Users can view all profiles" on public.profiles
  for select using (true);

create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- presence policies
create policy "Users can view all presence" on public.presence
  for select using (true);

create policy "Users can insert their own presence" on public.presence
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own presence" on public.presence
  for update using (auth.uid() = user_id);

-- Postgres function to "touch" presence safely
create or replace function public.upsert_presence(_is_open boolean, _lat double precision, _lng double precision)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.presence as p (user_id, is_open, lat, lng, updated_at)
  values (auth.uid(), _is_open, _lat, _lng, now())
  on conflict (user_id) do update
    set is_open = excluded.is_open,
        lat = excluded.lat,
        lng = excluded.lng,
        updated_at = now();
end;
$$;
```

#### **Prompt 7 - RLS Policies (Run Second):**

```sql
-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.presence enable row level security;

-- Profiles policies
create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_upsert_self" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_upsert_self" on public.profiles
  for update using (auth.uid() = id);

-- Presence policies
create policy "presence_select_all" on public.presence
  for select using (true);

create policy "presence_upsert_self" on public.presence
  for insert with check (auth.uid() = user_id);

create policy "presence_upsert_self" on public.presence
  for update using (auth.uid() = user_id);
```

### 3. Supabase Auth Configuration

1. Go to **Authentication** → **Providers**
2. **Enable Email provider** with Magic Link
3. **Disable all other providers** (Google, GitHub, etc.)
4. Go to **Authentication** → **URL Configuration**
5. Set **Site URL** to:
   - **Development**: `http://localhost:3000`
   - **Production**: Your production domain (e.g., `https://yoursite.vercel.app`)

## Development

### Install Dependencies

```bash
npm install
# or
pnpm install
```

### Start Development Server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Development Features

- **Hot Reload**: Changes reflect immediately
- **TypeScript**: Full type safety and IntelliSense
- **ESLint**: Code quality and consistency
- **Tailwind CSS**: Utility-first styling

## Testing

### Basic Functionality Test

1. **Sign In**: Enter your email, check for magic link
2. **Profile Setup**: Complete first name if prompted
3. **Presence Toggle**: Click "I'm Open" to go online
4. **Location**: Allow location access when prompted
5. **Nearby Users**: You should appear in the nearby list

### Multi-User Test

1. **Open two browser windows** (or incognito + normal)
2. **Sign in with different accounts** in each
3. **Toggle "I'm Open"** in both accounts
4. **Verify**: Each account should see the other in the nearby list
5. **Test Distance**: Toggle one account to "I'm Closed" and verify it disappears

## Deployment

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial Signal Web app"
git push origin main
```

### 2. Deploy to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **New Project**
3. **Import Git Repository** → Select your Signal Web repo
4. **Framework Preset**: Next.js (auto-detected)
5. **Root Directory**: `./` (default)
6. Click **Deploy**

### 3. Configure Environment Variables

After deployment, in your Vercel project:

1. Go to **Settings** → **Environment Variables**
2. Add these variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
3. **Redeploy** the project

### 4. Update Supabase Site URL

1. Go back to **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Change **Site URL** from `http://localhost:3000` to your production domain
3. **Save** the changes

### 5. Post-Deploy Testing

Verify these features work in production:

- ✅ **Sign In**: Email magic link authentication
- ✅ **Profile Setup**: First name completion
- ✅ **Presence Toggle**: "I'm Open" / "I'm Closed" functionality
- ✅ **Location Services**: GPS coordinates and refresh
- ✅ **Nearby Discovery**: Real-time user visibility
- ✅ **Distance Calculations**: Accurate proximity measurements

## Project Structure

```
signal-web/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── auth/           # Authentication page
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Home page with presence UI
│   ├── components/         # Reusable components
│   │   ├── Header.tsx      # Navigation header
│   │   └── ProfileForm.tsx # Inline profile setup
│   ├── hooks/              # Custom React hooks
│   │   └── useSession.ts   # Session management
│   └── lib/                # Utility libraries
│       ├── supabase.ts     # Supabase client
│       └── presence.ts     # Location and presence utilities
├── .env.local.example      # Environment variables template
├── supabase-migration.sql  # Database schema
└── README.md               # This file
```

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Auth, Database, Realtime)
- **Deployment**: Vercel
- **Location**: Browser Geolocation API
- **Utilities**: geolib, date-fns

## Troubleshooting

### Common Issues

**"supabaseUrl is required" Error**
- Check `.env.local` file exists and has correct values
- Restart development server after adding environment variables

**Location Permission Denied**
- Ensure HTTPS in production (required for geolocation)
- Check browser permissions for the site

**No Nearby Users Showing**
- Verify both accounts have "I'm Open" toggled
- Check that location access is granted
- Ensure database tables and policies are created

**Authentication Issues**
- Verify Supabase project URL and keys
- Check Site URL configuration in Supabase Auth settings
- Ensure Email provider is enabled with Magic Link

### Getting Help

- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)
- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)

## License

MIT License - see LICENSE file for details.
