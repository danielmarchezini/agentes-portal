-- Add avatar column to profiles table
-- This column will store the storage object path (e.g. userId/timestamp-filename.ext)
-- Not a public URL. The app will generate Signed URLs when needed.

alter table if exists public.profiles
  add column if not exists avatar text;

comment on column public.profiles.avatar is 'Storage object path in the avatars bucket for the user avatar image';
