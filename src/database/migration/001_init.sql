-- ========================================
-- Ebra Call Orchestrator - Database Init
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables (for clean restart)
DROP TABLE IF EXISTS public.calls CASCADE;

-- Create calls table
CREATE TABLE public.calls
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    payload jsonb NOT NULL,
    status character varying(20) NOT NULL DEFAULT 'PENDING',
    attempts integer NOT NULL DEFAULT 0,
    last_error text,
    created_at timestamp without time zone NOT NULL DEFAULT NOW(),
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    external_call_id character varying(255),
    
    PRIMARY KEY (id),
    CONSTRAINT status_check CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED'))
);

-- Create indexes
CREATE INDEX idx_calls_status ON public.calls(status);
CREATE INDEX idx_calls_created_at ON public.calls(created_at);
CREATE INDEX idx_calls_external_id ON public.calls(external_call_id);
CREATE INDEX idx_calls_phone ON public.calls((payload->>'to'));

-- Set ownership
ALTER TABLE public.calls OWNER to postgres;

-- Add comments
COMMENT ON TABLE public.calls IS 'AI call orchestrator - stores call requests';
COMMENT ON COLUMN public.calls.id IS 'Unique call identifier';
COMMENT ON COLUMN public.calls.payload IS 'Call details: {to, scriptId, metadata}';
COMMENT ON COLUMN public.calls.status IS 'PENDING, IN_PROGRESS, COMPLETED, FAILED, EXPIRED';
COMMENT ON COLUMN public.calls.external_call_id IS 'AI Provider call ID';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully!';
END $$;