-- ======================================================================
-- TruthLens AI — Supabase Database Schema
-- Version: 1.0.0
-- Description: Normalized schema for profiles, analyses, claims,
--              evidence sources, evidence items, predictions,
--              conversations, messages, and saved results.
-- ======================================================================

-- 1. Profiles Table (extends Supabase auth.users or standalone auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    google_sub TEXT UNIQUE,
    email TEXT NOT NULL,
    name TEXT,
    picture TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_google_sub ON public.profiles(google_sub);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);

-- 2. Analyses Table (Master analysis record)
CREATE TABLE IF NOT EXISTS public.analyses (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    source_type TEXT NOT NULL CHECK (source_type IN ('text', 'url', 'file')),
    source_ref TEXT,
    source_domain TEXT,
    title TEXT,
    snippet TEXT,
    input_type TEXT DEFAULT 'article',
    verdict TEXT NOT NULL CHECK (verdict IN ('Likely Real', 'Needs Verification', 'Likely Fake')),
    fake_probability DOUBLE PRECISION NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    verification_status TEXT NOT NULL,
    verification_reason TEXT,
    final_conclusion TEXT,
    evidence_strength TEXT DEFAULT 'None',
    raw_result JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_analyses_user ON public.analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created ON public.analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_verdict ON public.analyses(verdict);
CREATE INDEX IF NOT EXISTS idx_analyses_v_status ON public.analyses(verification_status);

-- 3. Claims Table (Extracted propositions and normalized claims)
CREATE TABLE IF NOT EXISTS public.claims (
    id BIGSERIAL PRIMARY KEY,
    analysis_id BIGINT REFERENCES public.analyses(id) ON DELETE CASCADE,
    claim_text TEXT NOT NULL,
    normalized_hash TEXT NOT NULL,
    claimant TEXT,
    claim_type TEXT NOT NULL DEFAULT 'article_statement',
    verification_status TEXT NOT NULL DEFAULT 'Needs Verification',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_claims_analysis ON public.claims(analysis_id);
CREATE INDEX IF NOT EXISTS idx_claims_hash ON public.claims(normalized_hash);

-- 4. Evidence Sources Table (Directory of vetted source publishers)
CREATE TABLE IF NOT EXISTS public.evidence_sources (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT UNIQUE,
    source_type TEXT NOT NULL CHECK (source_type IN (
        'official_government',
        'official_institution',
        'regulatory',
        'fact_checker',
        'reputable_news',
        'gemini_grounding',
        'encyclopedic',
        'other'
    )),
    reliability_tier TEXT NOT NULL DEFAULT 'Tier-1',
    base_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_evidence_sources_domain ON public.evidence_sources(domain);
CREATE INDEX IF NOT EXISTS idx_evidence_sources_type ON public.evidence_sources(source_type);

-- 5. Evidence Items Table (Concrete evidence citations linking claims to sources)
CREATE TABLE IF NOT EXISTS public.evidence_items (
    id BIGSERIAL PRIMARY KEY,
    analysis_id BIGINT REFERENCES public.analyses(id) ON DELETE CASCADE,
    claim_id BIGINT REFERENCES public.claims(id) ON DELETE SET NULL,
    source_id BIGINT REFERENCES public.evidence_sources(id) ON DELETE SET NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_type TEXT NOT NULL,
    snippet TEXT NOT NULL,
    rating TEXT,
    relevance TEXT NOT NULL DEFAULT 'high' CHECK (relevance IN ('high', 'medium', 'low')),
    evidence_strength TEXT NOT NULL DEFAULT 'Moderate' CHECK (evidence_strength IN ('Strong', 'Moderate', 'Limited', 'None')),
    provenance TEXT NOT NULL CHECK (provenance IN (
        'Google Fact Check API',
        'Gemini web grounding',
        'authoritative_source_retrieval',
        'ML model',
        'AI reasoning'
    )),
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_analysis ON public.evidence_items(analysis_id);
CREATE INDEX IF NOT EXISTS idx_evidence_items_claim ON public.evidence_items(claim_id);
CREATE INDEX IF NOT EXISTS idx_evidence_items_provenance ON public.evidence_items(provenance);

-- 6. Predictions Table (ML statistical diagnostics and explainability weights)
CREATE TABLE IF NOT EXISTS public.predictions (
    id BIGSERIAL PRIMARY KEY,
    analysis_id BIGINT REFERENCES public.analyses(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL DEFAULT 'TF-IDF+LogisticRegression',
    model_version TEXT DEFAULT '1.0.0',
    prediction_label TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    fake_probability DOUBLE PRECISION NOT NULL,
    influential_words JSONB DEFAULT '[]'::jsonb,
    heuristic_signals JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_predictions_analysis ON public.predictions(analysis_id);

-- 7. Conversations Table (AI Assistant conversation sessions)
CREATE TABLE IF NOT EXISTS public.conversations (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    analysis_id BIGINT REFERENCES public.analyses(id) ON DELETE SET NULL,
    title TEXT DEFAULT 'TruthLens Verification Inquiry',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_analysis ON public.conversations(analysis_id);

-- 8. Messages Table (Chat turn history with context attribution)
CREATE TABLE IF NOT EXISTS public.messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'gemini' CHECK (provider IN ('gemini', 'openrouter', 'fallback')),
    model TEXT,
    context_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at ASC);

-- 9. Saved Results Table (User bookmarks and custom notes)
CREATE TABLE IF NOT EXISTS public.saved_results (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    analysis_id BIGINT NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    notes TEXT,
    tags TEXT[] DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, analysis_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_results_user ON public.saved_results(user_id);
