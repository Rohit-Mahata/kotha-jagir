-- ============================================================
-- KOTHA JAGIR SOLUTION PRIVATE LIMITED
-- SUPABASE POSTGRESQL SCHEMA & INITIAL SEED
-- ============================================================

-- Enable pgcrypto for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ADMIN TABLE
CREATE TABLE IF NOT EXISTS admin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL DEFAULT '9779841234567',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. OTP CODES TABLE
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. LOCATIONS TABLE (Admin-Managed)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ROOM TYPES TABLE (Admin-Managed)
CREATE TABLE IF NOT EXISTS room_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. JOB CATEGORIES TABLE (Admin-Managed)
CREATE TABLE IF NOT EXISTS job_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. LISTINGS TABLE
CREATE TABLE IF NOT EXISTS listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('room', 'job', 'land', 'house')),
    title TEXT NOT NULL,
    description TEXT,
    price_or_salary INTEGER,
    locality TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    archived_at TIMESTAMPTZ,
    cover_photo_url TEXT,
    gallery_photo_urls TEXT[] DEFAULT '{}',
    video_url TEXT,
    attributes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. APPLICATIONS TABLE (Permanent Records - Never Deleted)
CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    occupation TEXT NOT NULL,
    id_type TEXT NOT NULL CHECK (id_type IN ('citizenship', 'passport')),
    citizenship_front_url TEXT NOT NULL,
    citizenship_back_url TEXT NOT NULL,
    preferred_date DATE,
    message TEXT,
    password_hash TEXT, -- Set at application time, set to NULL when status = 'visitor_reverted'
    status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'applicant', 'member', 'visitor_reverted')),
    payment_confirmed_at TIMESTAMPTZ,
    access_revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id TEXT REFERENCES applications(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. GHAR/JAGGA INQUIRIES TABLE
CREATE TABLE IF NOT EXISTS ghar_jagga_inquiries (
    id SERIAL PRIMARY KEY,
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES FOR FAST QUERYING
CREATE INDEX IF NOT EXISTS idx_listings_type_status ON listings(type, status);
CREATE INDEX IF NOT EXISTS idx_listings_locality ON listings(locality);
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_used ON otp_codes(email, used);

-- ============================================================
-- INITIAL SEED DATA
-- ============================================================

-- Seed Master Admin Account (sadikshyapokhrel177@gmail.com with hashed admin@2026 password)
INSERT INTO admin (email, password_hash, whatsapp_number)
VALUES (
    'sadikshyapokhrel177@gmail.com',
    '$2b$10$wT5gS.H51EwJ3J5D5W5hEOYt7vX.0lRz0D.G1aHhE2iF5eG6h7i8j', -- bcrypt hash for admin@2026
    '9779841234567'
)
ON CONFLICT (email) DO UPDATE 
SET whatsapp_number = EXCLUDED.whatsapp_number;

-- Seed Kathmandu Locations
INSERT INTO locations (name) VALUES
('Pepsi Chowk, Kathmandu'),
('Thamel, Kathmandu'),
('New Baneshwor, Kathmandu'),
('Lazimpat, Kathmandu'),
('Koteshwor, Kathmandu'),
('Maharajgunj, Kathmandu'),
('Kalanki, Kathmandu'),
('Chabahil, Kathmandu')
ON CONFLICT (name) DO NOTHING;

-- Seed Room Types
INSERT INTO room_types (name) VALUES
('Single Room'),
('Double Room'),
('1 BHK Flat'),
('2 BHK Flat'),
('3 BHK Flat'),
('Studio Apartment')
ON CONFLICT (name) DO NOTHING;

-- Seed Job Categories
INSERT INTO job_categories (name) VALUES
('Hospitality & Hotel'),
('IT & Software'),
('Teaching & Education'),
('Sales & Marketing'),
('Customer Service & Receptionist'),
('Delivery & Driver'),
('Accounting & Finance'),
('Healthcare & Nursing')
ON CONFLICT (name) DO NOTHING;

-- Seed Storage Settings
INSERT INTO settings (key, value) VALUES
('storage_usage', '{"used_gb": 6.2, "total_gb": 10.0}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Done!
SELECT 'Supabase schema migration and seed successfully created!' AS result;
