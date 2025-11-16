-- Remove entries_synced column as auto-sync feature has been removed
ALTER TABLE public.wheels 
DROP COLUMN IF EXISTS entries_synced;
