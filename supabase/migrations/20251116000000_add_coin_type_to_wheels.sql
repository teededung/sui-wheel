-- Add coin_type column to wheels table for multi-coin support
-- Migration: Add coin_type column with default value for backward compatibility

-- Add coin_type column with default value of SUI
ALTER TABLE public.wheels 
ADD COLUMN IF NOT EXISTS coin_type text NOT NULL DEFAULT '0x2::sui::SUI';

-- Create index on coin_type for efficient filtering and queries
CREATE INDEX IF NOT EXISTS wheels_coin_type_idx ON public.wheels(coin_type);

-- Add comment to document the column
COMMENT ON COLUMN public.wheels.coin_type IS 'Coin type used for prizes (e.g., 0x2::sui::SUI for SUI, or other coin types)';
