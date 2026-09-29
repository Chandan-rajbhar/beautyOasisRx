-- ============================================================
-- BEAUTY OASIS ADMIN PANEL — SUPABASE DATABASE SCHEMA
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: admin_users
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Staff',
  title TEXT,
  avatar TEXT,
  phone TEXT,
  department TEXT,
  permissions JSONB DEFAULT '[]'::jsonb,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: clients
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar TEXT,
  status TEXT DEFAULT 'Active',
  skin_type TEXT,
  allergies TEXT,
  notes TEXT,
  address TEXT,
  date_of_birth DATE,
  gender TEXT,
  loyalty_points INTEGER DEFAULT 0,
  total_spent NUMERIC(10,2) DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  last_visit DATE,
  referral_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: providers
-- ============================================================
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT,
  specialization TEXT,
  email TEXT,
  phone TEXT,
  avatar TEXT,
  bio TEXT,
  status TEXT DEFAULT 'Active',
  rating NUMERIC(3,2) DEFAULT 0,
  total_appointments INTEGER DEFAULT 0,
  availability JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: services
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  duration INTEGER,
  price NUMERIC(10,2),
  status TEXT DEFAULT 'Active',
  badge TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  suitable_for TEXT,
  downtime TEXT,
  sessions_recommended TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: appointments
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_avatar TEXT,
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  provider_name TEXT,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name TEXT,
  date DATE NOT NULL,
  time TEXT,
  duration INTEGER,
  status TEXT DEFAULT 'Pending',
  notes TEXT,
  price NUMERIC(10,2),
  deposit_paid BOOLEAN DEFAULT FALSE,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  subtitle TEXT,
  price NUMERIC(10,2),
  original_price NUMERIC(10,2),
  rating NUMERIC(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  stock INTEGER DEFAULT 0,
  image TEXT,
  badge TEXT,
  badge_color TEXT,
  ingredients TEXT,
  usage_instructions TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT,
  client_email TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10,2) DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  payment_method TEXT,
  payment_status TEXT DEFAULT 'Unpaid',
  shipping_address TEXT,
  tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: payments
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'GBP',
  method TEXT,
  status TEXT DEFAULT 'Pending',
  reference TEXT,
  description TEXT,
  receipt_url TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: inquiries
-- ============================================================
CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  subject TEXT,
  message TEXT,
  status TEXT DEFAULT 'New',
  priority TEXT DEFAULT 'Normal',
  assigned_to TEXT,
  response TEXT,
  responded_at TIMESTAMPTZ,
  source TEXT DEFAULT 'Website',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: website_content
-- ============================================================
CREATE TABLE IF NOT EXISTS website_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: settings
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  category TEXT DEFAULT 'general',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ============================================================
-- DISABLE RLS (Enable later when you add Supabase Auth)
-- ============================================================
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE providers DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE website_content DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED DATA: Admin Users
-- ============================================================
INSERT INTO admin_users (email, name, role, title, avatar, phone, department, permissions) VALUES
('admin@beautyoasisrx.com', 'Dr. Alistair Vance, MD', 'Super Admin', 'Medical Director', 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80', '(214) 555-0192', 'Clinical Leadership', '["all"]'),
('manager@beautyoasisrx.com', 'Brianna Miller', 'Admin', 'Clinic Practice Manager', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80', '(214) 555-0180', 'Operations', '["appointments","clients","services","products","orders","payments","providers","inquiries","content"]'),
('staff@beautyoasisrx.com', 'Elena Rostova, LE', 'Staff', 'Senior Clinical Aesthetician', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80', '(214) 555-0198', 'Aesthetic Care Team', '["appointments","clients","inquiries"]')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- SEED DATA: Providers
-- ============================================================
INSERT INTO providers (name, role, specialization, email, phone, avatar, bio, status, rating, total_appointments, availability) VALUES
('Dr. Alistair Vance, MD', 'Medical Director & Aesthetic Physician', 'Injectables, Polynucleotides & Deep RF', 'dr.vance@beautyoasisrx.com', '(214) 555-0192', 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80', 'Board-certified physician with over 14 years specializing in restorative facial rejuvenation.', 'Active', 4.98, 1420, '{"Monday":"09:00-17:00","Tuesday":"09:00-17:00","Wednesday":"09:00-17:00","Thursday":"09:00-17:00","Friday":"09:00-15:00","Saturday":"Off","Sunday":"Off"}'),
('Sarah Lin, NP-C', 'Lead Cosmetic Nurse Practitioner', 'Dermal Biostimulation & Laser Therapy', 'sarah.lin@beautyoasisrx.com', '(214) 555-0194', 'https://images.unsplash.com/photo-1594824813636-49bc8063259b?w=300&auto=format&fit=crop&q=80', 'Master injector and laser specialist passionate about natural-looking anatomical symmetry.', 'Active', 4.95, 980, '{"Monday":"10:00-18:00","Tuesday":"10:00-18:00","Wednesday":"10:00-18:00","Thursday":"10:00-18:00","Friday":"09:00-16:00","Saturday":"10:00-14:00","Sunday":"Off"}'),
('Elena Rostova, LE', 'Senior Clinical Aesthetician', 'Hydrafacial Pro & Chemical Peels', 'elena.r@beautyoasisrx.com', '(214) 555-0198', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80', 'Specializing in sensory-calm treatments and barrier restoration protocols.', 'Active', 4.92, 1150, '{"Monday":"09:00-17:00","Tuesday":"09:00-17:00","Wednesday":"Off","Thursday":"09:00-17:00","Friday":"09:00-17:00","Saturday":"09:00-16:00","Sunday":"Off"}'),
('Marcus Thorne, CLT', 'Laser & Body Sculpting Clinician', 'Laser Genesis, Vascular & Men''s Aesthetics', 'marcus.t@beautyoasisrx.com', '(214) 555-0188', 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80', 'Certified Laser Technician focused on vascular tone correction and male rejuvenation.', 'Active', 4.89, 740, '{"Monday":"11:00-19:00","Tuesday":"11:00-19:00","Wednesday":"11:00-19:00","Thursday":"11:00-19:00","Friday":"10:00-18:00","Saturday":"Off","Sunday":"Off"}');

-- ============================================================
-- SEED DATA: Services
-- ============================================================
INSERT INTO services (name, category, description, duration, price, status, badge, features, suitable_for, downtime, sessions_recommended) VALUES
('Hydrafacial Deluxe Pro', 'Skin Rejuvenation', 'Medical-grade hydradermabrasion combining patented vortex suction, gentle salicylic peel, and peptide-antioxidant saturation for immediate glass-skin luminosity.', 60, 185, 'Active', 'SIGNATURE PROTOCOL', '["Vortex-Fusion active extraction","Glycolic & salicylic medical booster","Red & blue LED phototherapy included"]', 'Congestion, dullness, dehydrated skin', 'Zero Downtime', '1–3 sessions'),
('Dermal Volumising & RF Needling', 'Anti-Ageing', 'Ultra-fine gold-insulated micro-pins deliver focused fractional radiofrequency directly into the deep reticular dermis.', 75, 360, 'Active', 'COLLAGEN INDUCTION', '["Customizable penetration depth","Targeted thermal dermal remodeling","Medical topical anesthetic included"]', 'Skin laxity, enlarged pores, acne scarring', '24–48 Hours Mild Pinkness', '3–4 sessions'),
('Polynucleotide Biostimulation', 'Injectables & Fillers', 'Highly purified DNA polymer chains stimulate fibroblasts, boost microcirculation, and regenerate damaged tissue structure.', 45, 320, 'Active', 'CELLULAR REGENERATION', '["Stimulates endogenous collagen type I & III","Hypoallergenic biocompatible formulation","Safe for all skin Fitzpatrick types"]', 'Under-eye dark hollows, crepiness, cellular fatigue', '12–24 Hours Minimal Swelling', '3 sessions spaced 3 wks'),
('Bespoke Medical Chemical Peels', 'Acne & Scarring', 'Targeted pharmaceutical-grade chemical exfoliants tailored to dissolve stubborn hyperpigmentation and smooth uneven surface texture.', 50, 165, 'Active', 'CLINICAL RESURFACING', '["Formulated individually to patient dermal pH","Anti-inflammatory botanical neutralizers","Includes take-home post-peel recovery kit"]', 'Melasma, sun damage, stubborn acne marks', '2–4 Days Subtle Micro-Flaking', '4–6 sessions'),
('Laser Genesis & Vascular Clarity', 'Laser & IPL', 'Non-ablative micropulse laser gently warms the upper papillary dermis, closing dilated micro-capillaries and diffusing facial redness.', 45, 240, 'Active', 'VASCULAR & PIGMENT', '["Pain-free warming sensation","Targets micro-vasculature and diffuse erythema","Zero recovery or surface peeling"]', 'Rosacea, facial flushing, diffused redness', 'Zero Downtime', '4–6 sessions'),
('Bespoke Wrinkle Smoothing', 'Anti-Ageing', 'Doctor-administered micro-injections gently relax hyperactive expression muscles while preserving completely natural facial mobility.', 30, 295, 'Active', 'DOCTOR PERFORMED', '["Comprehensive full facial dynamic mapping","Ultra-fine gauge micro-needles for comfort","Complimentary 2-week review & adjustment"]', 'Forehead lines, crow''s feet, frown lines', 'Minimal (< 2 Hours)', 'Maintenance every 4–6 mos');

-- ============================================================
-- SEED DATA: Products
-- ============================================================
INSERT INTO products (name, category, description, subtitle, price, original_price, rating, review_count, stock, image, badge, badge_color, ingredients, usage_instructions, status) VALUES
('Cellular Restorative Bio-Ferment Creme', 'Creams & Balms', 'Multi-ceramide and bio-fermented peptide emollient that replenishes essential intercellular lipids.', '50ml | Lipid Barrier Repair & Deep Tissue Density', 145, 165, 4.9, 148, 42, '/images/product_creme.jpg', 'BESTSELLER', 'emerald', 'Micro-encapsulated Ceramides NP/AP/EOP, Bio-Fermented Marine Kelp, Centella Asiatica, Squalane, Ectoin.', 'Smooth 1-2 pumps onto clean skin morning and evening after serum application.', 'Active'),
('Aeterna Hyaluronic Gold Radiance Serum', 'Serums & Actives', 'Clinical multi-weight hyaluronic acid matrix with pure colloidal micro-gold and copper tripeptides.', '30ml | 5-Weight Molecular Plumping Complex', 135, 150, 5.0, 212, 28, '/images/product_serum.jpg', 'DOCTOR RECOMMENDED', 'gold', 'Multi-Molecular Hyaluronic Acid, Copper Tripeptide-1, Niacinamide 5%, Colloidal Gold, Snow Mushroom Extract.', 'Apply 3-4 drops onto damp skin before heavy moisturizers.', 'Active'),
('Clarifying BHA Triple Acid Botanical Tonic', 'Cleansers & Tonics', 'Alcohol-free pharmaceutical liquid exfoliant that effortlessly clears sebum buildup inside pores.', '150ml | Pore-Refining Salicylic & Willow Bark', 68, 78, 4.8, 94, 67, '/images/product_serum.jpg', 'CLINICAL PICK', 'emerald', 'Salicylic Acid 2%, White Willow Bark, Green Tea Polyphenols, Licorice Root, Allantoin.', 'Sweep gently over face and neck using a cotton pad 3-4 nights per week.', 'Active'),
('Illuminating 15% Vitamin C + Ferulic Drops', 'Serums & Actives', 'Stabilized clinical L-ascorbic acid fortified with ferulic acid to neutralize environmental free-radical damage.', '30ml | L-Ascorbic Acid & Tocopherol Boost', 125, 140, 4.9, 183, 15, '/images/product_serum.jpg', 'ANTIOXIDANT SHIELD', 'gold', 'Pure L-Ascorbic Acid 15%, Ferulic Acid 0.5%, D-Alpha Tocopherol 1%, Hyaluronic Acid.', 'Dispense 4-5 drops in the morning onto clean dry face prior to SPF.', 'Active'),
('Retinaldehyde 0.1% Micro-Encapsulated Night Elixir', 'Serums & Actives', 'Next-generation retinaldehyde crystal delivery system that accelerates epidermal turnover overnight.', '30ml | 11x Faster Than Retinol with Zero Irritation', 110, 125, 4.9, 120, 8, '/images/product_creme.jpg', 'ADVANCED LONGEVITY', 'purple', 'Stabilized Retinaldehyde 0.1%, Bisabolol, Bakuchiol 1%, Ceramide NP, Squalane.', 'Use nightly after cleansing. Follow with barrier repair cream.', 'Active'),
('Ultra-Sheer Mineral Broad Spectrum SPF 50+', 'Sun Protection', 'Weightless, non-greasy invisible mineral sunscreen shielding against UVA/UVB, blue light HEV, and pollution.', '50ml | 100% Non-Nano Zinc Oxide & Ectoin', 55, 62, 4.9, 310, 95, '/images/product_creme.jpg', 'DAILY ESSENTIAL', 'emerald', 'Non-Nano Zinc Oxide 18.5%, Ectoin 2%, Antioxidant Botanical Complex, Resveratrol.', 'Apply liberally every morning as the final step in your clinical routine.', 'Active');

-- ============================================================
-- SEED DATA: Settings
-- ============================================================
INSERT INTO settings (key, value, category) VALUES
('clinic_name', '"Beauty Oasis Rx"', 'general'),
('clinic_email', '"info@beautyoasisrx.com"', 'general'),
('clinic_phone', '"(214) 555-0100"', 'general'),
('clinic_address', '"123 Harley Street, London, W1G 9QD"', 'general'),
('currency', '"GBP"', 'general'),
('booking_lead_time', '24', 'booking'),
('cancellation_hours', '48', 'booking'),
('deposit_percentage', '20', 'payments'),
('email_notifications', 'true', 'notifications'),
('sms_notifications', 'false', 'notifications')
ON CONFLICT (key) DO NOTHING;
