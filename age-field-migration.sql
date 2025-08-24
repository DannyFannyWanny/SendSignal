-- Age Field Migration
-- This adds a date_of_birth field to the profiles table with age validation

-- Add date_of_birth column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add a check constraint to ensure users are 18 or older
ALTER TABLE public.profiles 
ADD CONSTRAINT check_age_18_plus 
CHECK (date_of_birth <= CURRENT_DATE - INTERVAL '18 years');

-- Create an index on date_of_birth for efficient age-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_date_of_birth 
ON public.profiles(date_of_birth);

-- Function to calculate age from date of birth
CREATE OR REPLACE FUNCTION calculate_age(birth_date DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM AGE(birth_date));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get user's age (returns NULL if no DOB)
CREATE OR REPLACE FUNCTION get_user_age(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  user_age INTEGER;
BEGIN
  SELECT calculate_age(date_of_birth) INTO user_age
  FROM public.profiles
  WHERE id = user_id;
  
  RETURN user_age;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_age(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_age(UUID) TO authenticated;

-- Update existing profiles to have a default date_of_birth if needed
-- This sets a default DOB that makes users 25 years old (for existing users)
UPDATE public.profiles 
SET date_of_birth = CURRENT_DATE - INTERVAL '25 years'
WHERE date_of_birth IS NULL;

-- Make date_of_birth NOT NULL after setting defaults
ALTER TABLE public.profiles 
ALTER COLUMN date_of_birth SET NOT NULL;
