-- Initial schema migration
-- This migration consolidates the existing schema structure

-- Ensure tables exist with proper structure
CREATE TABLE IF NOT EXISTS public.wheels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wheel_id text UNIQUE NOT NULL,
    tx_digest text NOT NULL,
    package_id text NOT NULL,
    organizer_address text NOT NULL,
    prizes bigint[] NOT NULL,
    total_donation numeric,
    network text NOT NULL DEFAULT 'testnet'::text,
    created_at timestamptz NOT NULL DEFAULT now(),
    coin_type text NOT NULL DEFAULT '0x2::sui::SUI'::text
);

CREATE TABLE IF NOT EXISTS public.wheel_entries (
    id bigserial PRIMARY KEY,
    wheel_id text NOT NULL,
    entry_address text NOT NULL,
    entry_index integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (wheel_id, entry_index),
    FOREIGN KEY (wheel_id) REFERENCES public.wheels(wheel_id)
);

CREATE TABLE IF NOT EXISTS public.wheel_winners (
    id bigserial PRIMARY KEY,
    wheel_id text NOT NULL,
    winner_address text NOT NULL,
    prize_index integer NOT NULL,
    spin_tx_digest text UNIQUE NOT NULL,
    spin_time timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (wheel_id, prize_index),
    FOREIGN KEY (wheel_id) REFERENCES public.wheels(wheel_id)
);

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='wheels' AND column_name='coin_type') THEN
        ALTER TABLE public.wheels ADD COLUMN coin_type text NOT NULL DEFAULT '0x2::sui::SUI'::text;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS wheels_organizer_idx ON public.wheels(organizer_address);
CREATE INDEX IF NOT EXISTS wheels_created_at_idx ON public.wheels(created_at DESC);
CREATE INDEX IF NOT EXISTS wheels_coin_type_idx ON public.wheels(coin_type);

CREATE INDEX IF NOT EXISTS wheel_entries_wheel_idx ON public.wheel_entries(wheel_id);
CREATE INDEX IF NOT EXISTS wheel_entries_address_idx ON public.wheel_entries(entry_address);

CREATE INDEX IF NOT EXISTS wheel_winners_wheel_idx ON public.wheel_winners(wheel_id);
CREATE INDEX IF NOT EXISTS wheel_winners_address_idx ON public.wheel_winners(winner_address);

-- Enable RLS
ALTER TABLE public.wheels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wheel_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wheel_winners ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (drop first if exists)
DROP POLICY IF EXISTS "wheels read" ON public.wheels;
CREATE POLICY "wheels read" ON public.wheels FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "wheel_entries read" ON public.wheel_entries;
CREATE POLICY "wheel_entries read" ON public.wheel_entries FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "wheel_winners read" ON public.wheel_winners;
CREATE POLICY "wheel_winners read" ON public.wheel_winners FOR SELECT TO public USING (true);
