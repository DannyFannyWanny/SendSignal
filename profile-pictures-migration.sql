-- Profile Pictures Migration
-- This adds profile picture support to the profiles table

-- Add profile_picture_url column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Create an index on profile_picture_url for efficient queries
CREATE INDEX IF NOT EXISTS idx_profiles_profile_picture_url 
ON public.profiles(profile_picture_url);

-- Function to generate a unique filename for profile pictures
CREATE OR REPLACE FUNCTION generate_profile_picture_filename(user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN user_id::TEXT || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '.jpg';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get user's profile picture URL
CREATE OR REPLACE FUNCTION get_profile_picture_url(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  picture_url TEXT;
BEGIN
  SELECT profile_picture_url INTO picture_url
  FROM public.profiles
  WHERE id = user_id;
  
  RETURN picture_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_profile_picture_filename(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_profile_picture_url(UUID) TO authenticated;

-- Update existing profiles to have a default profile picture URL if needed
-- This will be handled by the frontend fallback system
UPDATE public.profiles 
SET profile_picture_url = NULL
WHERE profile_picture_url IS NULL;
