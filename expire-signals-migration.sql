-- Signal Expiration Migration
-- This adds functionality to automatically expire signals after 24 hours

-- Function to expire old signals
CREATE OR REPLACE FUNCTION expire_old_signals()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Update signals that are older than 5 minutes and still pending
    UPDATE public.signals 
    SET status = 'expired'
    WHERE status = 'pending' 
    AND created_at < (NOW() - INTERVAL '5 minutes');
    
    -- Get the count of expired signals
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get expired signals count for a user
CREATE OR REPLACE FUNCTION get_expired_signals_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO expired_count
    FROM public.signals 
    WHERE (sender_id = p_user_id OR recipient_id = p_user_id)
    AND status = 'expired';
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the create_signal function to check for expired signals first
CREATE OR REPLACE FUNCTION create_signal(
    p_recipient_id UUID,
    p_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_signal_id UUID;
BEGIN
    -- First, expire any old signals between these users
    UPDATE public.signals 
    SET status = 'expired'
    WHERE (sender_id = auth.uid() AND recipient_id = p_recipient_id)
    OR (sender_id = p_recipient_id AND recipient_id = auth.uid())
    AND status = 'pending'
    AND created_at < (NOW() - INTERVAL '5 minutes');
    
    -- Check if there's already a pending signal
    IF EXISTS (
        SELECT 1 FROM public.signals 
        WHERE sender_id = auth.uid() 
        AND recipient_id = p_recipient_id 
        AND status = 'pending'
    ) THEN
        RAISE EXCEPTION 'You already have a pending signal to this user';
    END IF;
    
    -- Create the signal
    INSERT INTO public.signals (sender_id, recipient_id, message)
    VALUES (auth.uid(), p_recipient_id, p_message)
    RETURNING id INTO v_signal_id;
    
    RETURN v_signal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired signals (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_signals()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete signals that have been expired for more than 7 days
    DELETE FROM public.signals 
    WHERE status = 'expired' 
    AND updated_at < (NOW() - INTERVAL '7 days');
    
    -- Get the count of deleted signals
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a cron job to automatically expire signals every hour
-- Note: This requires pg_cron extension to be enabled in Supabase
-- If pg_cron is not available, you can call expire_old_signals() manually

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION expire_old_signals() TO authenticated;
GRANT EXECUTE ON FUNCTION get_expired_signals_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_signals() TO authenticated;
