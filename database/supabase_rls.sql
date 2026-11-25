-- ======================================================================
-- TruthLens AI — Supabase Row Level Security (RLS) Policies
-- Version: 1.0.0
-- Description: Enforces multi-tenant user isolation.
--              Users can strictly access only their own data.
-- ======================================================================

-- 1. Enable RLS on all public tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_results ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------
CREATE POLICY "Users can view their own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

-- ----------------------------------------------------------------------
-- ANALYSES POLICIES
-- ----------------------------------------------------------------------
-- Users can view their own analyses. Public analyses with NULL user_id are readable for shared links.
CREATE POLICY "Users can view their own analyses or public ones"
    ON public.analyses
    FOR SELECT
    USING (
        user_id IS NULL OR
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can insert analyses"
    ON public.analyses
    FOR INSERT
    WITH CHECK (
        user_id IS NULL OR
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can delete only their own analyses"
    ON public.analyses
    FOR DELETE
    USING (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

-- ----------------------------------------------------------------------
-- CLAIMS POLICIES
-- ----------------------------------------------------------------------
CREATE POLICY "Users can view claims from accessible analyses"
    ON public.claims
    FOR SELECT
    USING (
        analysis_id IN (
            SELECT id FROM public.analyses
            WHERE user_id IS NULL OR user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert claims for accessible analyses"
    ON public.claims
    FOR INSERT
    WITH CHECK (
        analysis_id IN (
            SELECT id FROM public.analyses
            WHERE user_id IS NULL OR user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
        )
    );

-- ----------------------------------------------------------------------
-- EVIDENCE SOURCES (Public Directory - Read-only for authenticated users)
-- ----------------------------------------------------------------------
CREATE POLICY "Evidence sources are readable by all authenticated users"
    ON public.evidence_sources
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- ----------------------------------------------------------------------
-- EVIDENCE ITEMS POLICIES
-- ----------------------------------------------------------------------
CREATE POLICY "Users can view evidence items for accessible analyses"
    ON public.evidence_items
    FOR SELECT
    USING (
        analysis_id IN (
            SELECT id FROM public.analyses
            WHERE user_id IS NULL OR user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert evidence items for accessible analyses"
    ON public.evidence_items
    FOR INSERT
    WITH CHECK (
        analysis_id IN (
            SELECT id FROM public.analyses
            WHERE user_id IS NULL OR user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
        )
    );

-- ----------------------------------------------------------------------
-- PREDICTIONS POLICIES
-- ----------------------------------------------------------------------
CREATE POLICY "Users can view predictions for accessible analyses"
    ON public.predictions
    FOR SELECT
    USING (
        analysis_id IN (
            SELECT id FROM public.analyses
            WHERE user_id IS NULL OR user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert predictions for accessible analyses"
    ON public.predictions
    FOR INSERT
    WITH CHECK (
        analysis_id IN (
            SELECT id FROM public.analyses
            WHERE user_id IS NULL OR user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
        )
    );

-- ----------------------------------------------------------------------
-- CONVERSATIONS POLICIES
-- ----------------------------------------------------------------------
CREATE POLICY "Users can view only their own conversations"
    ON public.conversations
    FOR SELECT
    USING (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can insert their own conversations"
    ON public.conversations
    FOR INSERT
    WITH CHECK (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can delete only their own conversations"
    ON public.conversations
    FOR DELETE
    USING (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

-- ----------------------------------------------------------------------
-- MESSAGES POLICIES
-- ----------------------------------------------------------------------
CREATE POLICY "Users can view messages from their own conversations"
    ON public.messages
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM public.conversations
            WHERE user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert messages into their own conversations"
    ON public.messages
    FOR INSERT
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM public.conversations
            WHERE user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
        )
    );

-- ----------------------------------------------------------------------
-- SAVED RESULTS POLICIES
-- ----------------------------------------------------------------------
CREATE POLICY "Users can view only their own saved results"
    ON public.saved_results
    FOR SELECT
    USING (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can save results to their own collection"
    ON public.saved_results
    FOR INSERT
    WITH CHECK (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can remove their own saved results"
    ON public.saved_results
    FOR DELETE
    USING (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );
