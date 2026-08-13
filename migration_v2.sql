-- ============================================================
-- KOTHA JAGIR SOLUTION - DATABASE MIGRATION V2
-- ============================================================

-- 1. Make citizenship_back_url nullable for passport applications
ALTER TABLE applications ALTER COLUMN citizenship_back_url DROP NOT NULL;

-- 2. Update Master Admin Account with the correct bcrypt hash for admin@2026
INSERT INTO admin (email, password_hash, whatsapp_number)
VALUES (
    'sadikshyapokhrel177@gmail.com',
    '$2a$10$O2EC2pDhawLtAPchh.vnJuxkeIi.gEsZ1B9QysU1KTBGCN9pmKuRC', -- bcrypt hash of admin@2026
    '9779841234567'
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    whatsapp_number = EXCLUDED.whatsapp_number;

-- 3. Seed default operational settings (whatsapp_number and payment_qr_code)
INSERT INTO settings (key, value) VALUES
('whatsapp_number', '{"value": "9779841234567"}'::jsonb),
('payment_qr_code', '{"value": "/default_payment_qr.png"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Verification log
SELECT 'Migration V2 successfully completed!' AS result;
