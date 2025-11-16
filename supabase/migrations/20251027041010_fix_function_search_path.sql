-- Fix function search path
-- This migration ensures proper search path for database functions

-- Set search path for public schema
ALTER DATABASE postgres SET search_path TO public, extensions;
