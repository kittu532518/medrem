-- MedRem Initial Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  date_of_birth DATE,
  language VARCHAR(10) DEFAULT 'en',
  caregiver_phone VARCHAR(20),
  caregiver_name VARCHAR(255),
  push_subscription JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('chronic', 'temporary')),
  duration_days INTEGER,
  starts_at DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at DATE,
  image_path TEXT,
  raw_ocr_json JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  form VARCHAR(100),
  special_instructions TEXT,
  sessions TEXT[] NOT NULL,
  needs_review BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dose_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  session VARCHAR(20) NOT NULL CHECK (session IN ('morning', 'afternoon', 'evening', 'night')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'partial_success', 'failure')),
  photo_path TEXT,
  ai_validation_result JSONB,
  submitted_at TIMESTAMPTZ,
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(medicine_id, scheduled_date, session)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dose_logs_user_date ON dose_logs(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_dose_logs_medicine ON dose_logs(medicine_id);
CREATE INDEX IF NOT EXISTS idx_medicines_user ON medicines(user_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_user ON prescriptions(user_id);
