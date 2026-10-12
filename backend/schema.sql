-- ============================================================================
-- SATGAS GAKKUM MINOPS - SCHEMA & DATABASE DEFINITION
-- Schema: satgas (Dedicated schema isolated from public)
-- ============================================================================

-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS satgas;

-- 2. Users Table (satgas.users)
CREATE TABLE IF NOT EXISTS satgas.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    subsatgas TEXT NOT NULL DEFAULT 'MINOPS', -- 'MINOPS', 'LIDIK', 'INVESTIGASI', 'ANALIS', 'ALL'
    unit_name TEXT NOT NULL DEFAULT 'ALL',     -- 'UNIT JAYAPURA', 'UNIT TIMIKA', 'ALL', etc.
    role TEXT NOT NULL DEFAULT 'operator',    -- 'admin', 'operator', 'viewer'
    status TEXT NOT NULL DEFAULT 'ACTIVE',    -- 'ACTIVE', 'INACTIVE'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_satgas_users_email ON satgas.users(email);
CREATE INDEX IF NOT EXISTS idx_satgas_users_role ON satgas.users(role);

-- 3. Daily Activity Reports (satgas.daily_reports)
-- Conforms directly to the official 8-column LAPHAR table:
-- 1. NO, 2. SATGAS, 3. JAM/WAKTU, 4. KUAT PERSONEL, 5. LOKASI KEGIATAN, 6. KEGIATAN, 7. HASIL YANG DICAPAI, 8. KET
CREATE TABLE IF NOT EXISTS satgas.daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL,
    satgas_name TEXT NOT NULL DEFAULT 'Satgas Gakkum',
    subsatgas TEXT NOT NULL,                  -- 'MINOPS', 'LIDIK', 'INVESTIGASI', 'ANALIS'
    unit_name TEXT NOT NULL,                  -- e.g. 'UNIT JAYAPURA', 'UNIT TIMIKA', 'WILAYAH NDUGA'
    activity_time TEXT NOT NULL,              -- Jam / Waktu pelaksanaan (e.g. '08.00 - 12.00 WIT')
    personnel_count TEXT NOT NULL,            -- Kuat Personel (e.g. '5 Pers', 'Brigpol Dwi')
    location TEXT NOT NULL,                   -- Lokasi Kegiatan / Posko / Tempat
    activity TEXT NOT NULL,                   -- Uraian Kegiatan
    results TEXT NOT NULL,                    -- Hasil yang dicapai
    description TEXT DEFAULT '',              -- Keterangan / Catatan Tambahan
    documentation_urls JSONB DEFAULT '[]'::jsonb, -- Lampiran gambar / URLs
    created_by UUID REFERENCES satgas.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_satgas_reports_date ON satgas.daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_satgas_reports_subsatgas ON satgas.daily_reports(subsatgas);
CREATE INDEX IF NOT EXISTS idx_satgas_reports_unit ON satgas.daily_reports(unit_name);

-- 4. Prominent Incidents Table (satgas.prominent_incidents)
-- Conforms to the official LAPORAN KEJADIAN MENONJOL (7 columns):
-- 1. NO, 2. HARI/TGL/WAKTU, 3. LOKASI, 4. KEJADIAN, 5. KERUGIAN / HASIL, 6. LANGKAH-LANGKAH, 7. KET
CREATE TABLE IF NOT EXISTS satgas.prominent_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL,
    incident_time TEXT NOT NULL,              -- Hari/Tgl/Waktu
    location TEXT NOT NULL,                   -- Lokasi Kejadian
    incident_description TEXT NOT NULL,       -- Uraian Kejadian
    losses_or_results TEXT NOT NULL,          -- Kerugian / Hasil
    actions_taken TEXT NOT NULL,              -- Langkah-langkah
    notes TEXT DEFAULT '',                    -- Keterangan
    created_by UUID REFERENCES satgas.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_satgas_incidents_date ON satgas.prominent_incidents(report_date);

-- 5. Report Metadata & Signatory Configuration (satgas.report_configs)
CREATE TABLE IF NOT EXISTS satgas.report_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE UNIQUE NOT NULL,
    signatory_title TEXT NOT NULL DEFAULT 'KEPALA SATUAN TUGAS PENEGAKAN HUKUM OPERASI DAMAI CARTENZ - 2026',
    signatory_name TEXT NOT NULL DEFAULT 'I G.G. ERA ADHINATA, S.I.K.',
    signatory_rank TEXT NOT NULL DEFAULT 'KOMISARIS BESAR POLISI NRP 80020993',
    signatory_place TEXT NOT NULL DEFAULT 'Jayapura',
    status TEXT NOT NULL DEFAULT 'DRAFT',     -- 'DRAFT', 'SUBMITTED', 'FINAL'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_satgas_configs_date ON satgas.report_configs(report_date);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE satgas.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE satgas.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE satgas.prominent_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE satgas.report_configs ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
DROP POLICY IF EXISTS "Allow authenticated read users" ON satgas.users;
CREATE POLICY "Allow authenticated read users" ON satgas.users FOR SELECT TO authenticated, service_role USING (true);

DROP POLICY IF EXISTS "Allow admin manage users" ON satgas.users;
CREATE POLICY "Allow admin manage users" ON satgas.users FOR ALL TO authenticated, service_role USING (true);

DROP POLICY IF EXISTS "Allow read daily_reports" ON satgas.daily_reports;
CREATE POLICY "Allow read daily_reports" ON satgas.daily_reports FOR SELECT TO authenticated, service_role USING (true);

DROP POLICY IF EXISTS "Allow insert daily_reports" ON satgas.daily_reports;
CREATE POLICY "Allow insert daily_reports" ON satgas.daily_reports FOR INSERT TO authenticated, service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update daily_reports" ON satgas.daily_reports;
CREATE POLICY "Allow update daily_reports" ON satgas.daily_reports FOR UPDATE TO authenticated, service_role USING (true);

DROP POLICY IF EXISTS "Allow delete daily_reports" ON satgas.daily_reports;
CREATE POLICY "Allow delete daily_reports" ON satgas.daily_reports FOR DELETE TO authenticated, service_role USING (true);

DROP POLICY IF EXISTS "Allow read prominent_incidents" ON satgas.prominent_incidents;
CREATE POLICY "Allow read prominent_incidents" ON satgas.prominent_incidents FOR SELECT TO authenticated, service_role USING (true);

DROP POLICY IF EXISTS "Allow manage prominent_incidents" ON satgas.prominent_incidents;
CREATE POLICY "Allow manage prominent_incidents" ON satgas.prominent_incidents FOR ALL TO authenticated, service_role USING (true);

DROP POLICY IF EXISTS "Allow read report_configs" ON satgas.report_configs;
CREATE POLICY "Allow read report_configs" ON satgas.report_configs FOR SELECT TO authenticated, service_role USING (true);

DROP POLICY IF EXISTS "Allow manage report_configs" ON satgas.report_configs;
CREATE POLICY "Allow manage report_configs" ON satgas.report_configs FOR ALL TO authenticated, service_role USING (true);

-- 8. Grant Schema Permissions for PostgREST & Supabase Roles
GRANT USAGE ON SCHEMA satgas TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA satgas TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA satgas TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA satgas GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA satgas GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;