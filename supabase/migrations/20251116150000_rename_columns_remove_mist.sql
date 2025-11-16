-- Rename columns to remove _mist suffix (align with production)
ALTER TABLE public.wheels 
  RENAME COLUMN prizes_mist TO prizes;

ALTER TABLE public.wheels 
  RENAME COLUMN total_donation_mist TO total_donation;

-- Update comments
COMMENT ON COLUMN public.wheels.prizes IS 'Array of prize amounts in smallest unit (e.g., MIST for SUI, smallest unit for other coins)';
COMMENT ON COLUMN public.wheels.total_donation IS 'Total donation amount in smallest unit (can be null if no donations)';
