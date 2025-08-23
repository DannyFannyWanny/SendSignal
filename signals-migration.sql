-- Signals table for user-to-user communication
CREATE TABLE IF NOT EXISTS public.signals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'ignored', 'expired')),
    message TEXT, -- Optional message from sender
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours') -- Signals expire after 24 hours
    
    -- Note: We'll use a unique index instead of constraint for pending signals
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_signals_recipient_status ON public.signals(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_signals_sender_status ON public.signals(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON public.signals(created_at);

-- Unique index to prevent multiple pending signals between the same users
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_signal 
ON public.signals(sender_id, recipient_id) 
WHERE status = 'pending';

-- Enable Row Level Security
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can create signals (send to others)
CREATE POLICY "users_can_create_signals" ON public.signals
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can view signals they sent
CREATE POLICY "users_can_view_sent_signals" ON public.signals
    FOR SELECT USING (auth.uid() = sender_id);

-- Users can view signals they received
CREATE POLICY "users_can_view_received_signals" ON public.signals
    FOR SELECT USING (auth.uid() = recipient_id);

-- Recipients can update signal status (accept/ignore)
CREATE POLICY "recipients_can_update_signals" ON public.signals
    FOR UPDATE USING (auth.uid() = recipient_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_signals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_signals_updated_at
    BEFORE UPDATE ON public.signals
    FOR EACH ROW
    EXECUTE FUNCTION update_signals_updated_at();

-- Function to create a signal
CREATE OR REPLACE FUNCTION create_signal(
    p_recipient_id UUID,
    p_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_signal_id UUID;
BEGIN
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

-- Function to respond to a signal
CREATE OR REPLACE FUNCTION respond_to_signal(
    p_signal_id UUID,
    p_response TEXT -- 'accepted' or 'ignored'
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Update the signal status
    UPDATE public.signals 
    SET status = p_response
    WHERE id = p_signal_id 
    AND recipient_id = auth.uid()
    AND status = 'pending';
    
    -- Return true if update was successful
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
