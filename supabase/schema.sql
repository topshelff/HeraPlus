-- HeraDX Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
-- Extends the built-in auth.users table with additional profile data

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================
-- 2. SESSIONS TABLE
-- ============================================
-- Diagnostic sessions with intake data

CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  life_stage TEXT NOT NULL,
  selected_body_parts TEXT[] NOT NULL,
  additional_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
CREATE POLICY "Users can view their own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON public.sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at DESC);


-- ============================================
-- 3. SYMPTOMS TABLE
-- ============================================
-- Symptoms associated with each session

CREATE TABLE IF NOT EXISTS public.symptoms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  body_part TEXT NOT NULL,
  description TEXT NOT NULL,
  severity INTEGER CHECK (severity >= 1 AND severity <= 10) NOT NULL,
  duration TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.symptoms ENABLE ROW LEVEL SECURITY;

-- RLS Policies for symptoms (inherit from session ownership)
CREATE POLICY "Users can view symptoms of their own sessions"
  ON public.symptoms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = symptoms.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create symptoms for their own sessions"
  ON public.symptoms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = symptoms.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update symptoms of their own sessions"
  ON public.symptoms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = symptoms.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete symptoms of their own sessions"
  ON public.symptoms FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = symptoms.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_symptoms_session_id ON public.symptoms(session_id);


-- ============================================
-- 4. BIOMETRIC SUMMARIES TABLE
-- ============================================
-- BPM/HRV summary per session

CREATE TABLE IF NOT EXISTS public.biometric_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  avg_bpm NUMERIC(5,2) NOT NULL,
  avg_hrv NUMERIC(5,2) NOT NULL,
  min_bpm NUMERIC(5,2),
  max_bpm NUMERIC(5,2),
  scan_duration INTEGER, -- in seconds
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.biometric_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for biometric_summaries (inherit from session ownership)
CREATE POLICY "Users can view biometrics of their own sessions"
  ON public.biometric_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = biometric_summaries.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create biometrics for their own sessions"
  ON public.biometric_summaries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = biometric_summaries.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update biometrics of their own sessions"
  ON public.biometric_summaries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = biometric_summaries.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_biometric_summaries_session_id ON public.biometric_summaries(session_id);


-- ============================================
-- 5. DIAGNOSIS RESULTS TABLE
-- ============================================
-- AI triage results per session

CREATE TABLE IF NOT EXISTS public.diagnosis_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  urgency_level TEXT CHECK (urgency_level IN ('EMERGENCY', 'URGENT', 'MODERATE', 'LOW')) NOT NULL,
  urgency_reason TEXT,
  primary_assessment TEXT NOT NULL,
  recommendations TEXT[],
  red_flags TEXT[],
  differential_considerations TEXT[],
  specialty_referral TEXT,
  disclaimer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.diagnosis_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for diagnosis_results (inherit from session ownership)
CREATE POLICY "Users can view diagnoses of their own sessions"
  ON public.diagnosis_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = diagnosis_results.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create diagnoses for their own sessions"
  ON public.diagnosis_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = diagnosis_results.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update diagnoses of their own sessions"
  ON public.diagnosis_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = diagnosis_results.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_diagnosis_results_session_id ON public.diagnosis_results(session_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_results_urgency ON public.diagnosis_results(urgency_level);


-- ============================================
-- 6. UPDATED_AT TRIGGER FUNCTION
-- ============================================
-- Auto-update the updated_at column

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON public.sessions;
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================
-- GRANT PERMISSIONS
-- ============================================
-- Allow authenticated users to access these tables

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.sessions TO authenticated;
GRANT ALL ON public.symptoms TO authenticated;
GRANT ALL ON public.biometric_summaries TO authenticated;
GRANT ALL ON public.diagnosis_results TO authenticated;
