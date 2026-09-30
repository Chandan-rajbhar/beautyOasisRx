-- ============================================================
-- BEAUTY OASIS CMS — SUPABASE DATABASE MIGRATION
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension (if not already)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: website_content (compatible with existing schema)
-- section TEXT UNIQUE, data JSONB
-- ============================================================
CREATE TABLE IF NOT EXISTS website_content (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  section    TEXT        UNIQUE NOT NULL,
  data       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: website_testimonials (NEW)
-- Stores patient testimonials managed via CMS
-- ============================================================
CREATE TABLE IF NOT EXISTS website_testimonials (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'Verified Patient',
  treatment     TEXT        NOT NULL DEFAULT '',
  review        TEXT        NOT NULL,
  rating        INTEGER     NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  image_url     TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_website_content_section      ON website_content(section);
CREATE INDEX IF NOT EXISTS idx_website_testimonials_active  ON website_testimonials(is_active);
CREATE INDEX IF NOT EXISTS idx_website_testimonials_order   ON website_testimonials(display_order);

-- ============================================================
-- ROW LEVEL SECURITY
-- Public (anon key) can read; authenticated admins can write
-- ============================================================
ALTER TABLE website_content      ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_testimonials ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running migration
DROP POLICY IF EXISTS "Public read website_content"   ON website_content;
DROP POLICY IF EXISTS "Admin write website_content"   ON website_content;
DROP POLICY IF EXISTS "Public read testimonials"      ON website_testimonials;
DROP POLICY IF EXISTS "Admin write testimonials"      ON website_testimonials;

-- Allow anon and authenticated users to read website_content (public website)
CREATE POLICY "Public read website_content"
  ON website_content FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Allow authenticated users (admins) to insert/update/delete
CREATE POLICY "Admin write website_content"
  ON website_content FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- Allow anon and authenticated to read active testimonials
CREATE POLICY "Public read testimonials"
  ON website_testimonials FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

-- Allow authenticated (admin) users full access
CREATE POLICY "Admin write testimonials"
  ON website_testimonials FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- ============================================================
-- SEED DATA: Default Homepage Hero Content
-- Uses JSONB format compatible with existing supabaseDataService
-- ============================================================
INSERT INTO website_content (section, data) VALUES (
  'homepage',
  '{
    "featuredBadge": "VOTED #1 CLINICAL AESTHETICS IN ALLEN, TX",
    "heroTitle": "Clinical Aesthetics. Bespoke Wellness.",
    "heroTagline": "Doctor-Led Medical Spa & Sensory-Inclusive Suites in Allen, Texas",
    "heroDescription": "Experience restorative medical aesthetics where cutting-edge epigenetic science meets sensory tranquil luxury. Custom protocols designed for natural elegance and cellular renewal.",
    "ctaPrimaryText": "Book Bespoke Consultation",
    "ctaSecondaryText": "Explore Protocols"
  }'::jsonb
) ON CONFLICT (section) DO NOTHING;

INSERT INTO website_content (section, data) VALUES (
  'about',
  '{
    "title": "Bespoke Clinical Excellence Founded on Science",
    "subtitle": "A Higher Paradigm in Medical Skincare & Sensory Wellness",
    "description": "BeautyOasisRx was founded with a singular vision: to liberate medical aesthetics from generic, rushed protocols. Every face is an individual anatomy; every skin cellular matrix tells a distinct story. Our bespoke approach combines cutting-edge medical science with deep anatomical knowledge to create results that look naturally elevated — never overdone.",
    "stat1Label": "Verified Patients",
    "stat1Value": "18,000+",
    "stat2Label": "Five-Star Rating",
    "stat2Value": "4.98 / 5.0",
    "stat3Label": "Medical Specialists",
    "stat3Value": "12 Clinicians",
    "ctaText": "Begin Your Consultation",
    "highlight1": "Doctor-led protocols personalised to your unique cellular anatomy",
    "highlight2": "Sensory-inclusive suites designed for neurodivergent and anxious clients",
    "highlight3": "Medical-grade technology with evidence-based treatment protocols",
    "accreditation1": "American Board of Aesthetic Medicine",
    "accreditation2": "International Society of Dermatology",
    "accreditation3": "JAAD Certified Clinical Practice"
  }'::jsonb
) ON CONFLICT (section) DO NOTHING;

INSERT INTO website_content (section, data) VALUES (
  'contact',
  '{
    "clinicName": "BeautyOasisRx — Clinical Aesthetics & Bespoke Wellness",
    "address": "975 Watters Creek Blvd, Suite 240, Allen, TX 75013",
    "phone": "(214) 555-0190",
    "email": "concierge@beautyoasisrx.com",
    "hours": "Monday - Friday: 9am - 7pm | Saturday: 9am - 5pm | Sunday: Closed",
    "instagram": "@beautyoasisrx",
    "ctaText": "Schedule a Private Consultation"
  }'::jsonb
) ON CONFLICT (section) DO NOTHING;

-- ============================================================
-- SEED DATA: Default Testimonials
-- ============================================================
INSERT INTO website_testimonials (name, role, treatment, review, rating, is_active, display_order) VALUES
  (
    'Lady Charlotte Montagu',
    'Verified Client • Mayfair Suite',
    'Bespoke RF Microneedling & Exosomes',
    'The level of medical expertise and bedside manner at Beauty Oasis is unprecedented. Dr. Alistair tailored a protocol that completely reversed my sun damage and texture without any unnatural downtime. My skin has not looked this luminous in fifteen years.',
    5, TRUE, 1
  ),
  (
    'Sarah Jenkins, PhD',
    'Sensory-Calm Suite Client',
    'Inclusive Sensory Hydrafacial Pro',
    'As someone with extreme sensory sensitivity and anxiety around clinical environments, the sensory suite was life-changing. Soft warm lighting, completely silent equipment, and thoughtful pacing made this the first medical treatment I actually looked forward to.',
    5, TRUE, 2
  ),
  (
    'Marcus Vance',
    'Verified Client • Harley Street',
    'Laser Genesis & Clarifying Peel',
    'Finally a clinic that treats skincare with clinical precision rather than fluffy salon marketing. 3 sessions in and my persistent rosacea flush is virtually gone. The at-home medical regimen is equally exceptional.',
    5, TRUE, 3
  )
ON CONFLICT DO NOTHING;
