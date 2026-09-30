/**
 * cmsService.js
 *
 * Dedicated service for Beauty Oasis CMS operations.
 * Uses the EXISTING website_content table schema:
 *   - id, section (UNIQUE), data (JSONB), updated_at
 *
 * Also handles website_testimonials (new separate table).
 *
 * All operations fall back to DEFAULT_CMS_CONTENT gracefully
 * so the public website never breaks even without Supabase.
 */

import { supabase } from '../lib/supabaseClient';

// ─────────────────────────────────────────────
// DEFAULT FALLBACK CONTENT
// Used when Supabase is unreachable or rows not yet seeded
// ─────────────────────────────────────────────
export const DEFAULT_CMS_CONTENT = {
  homepage: {
    featuredBadge:    'VOTED #1 CLINICAL AESTHETICS IN ALLEN, TX',
    heroTitle:        'Clinical Aesthetics. Bespoke Wellness.',
    heroTagline:      'Doctor-Led Medical Spa & Sensory-Inclusive Suites in Allen, Texas',
    heroDescription:  'Experience restorative medical aesthetics where cutting-edge epigenetic science meets sensory tranquil luxury. Custom protocols designed for natural elegance and cellular renewal.',
    ctaPrimaryText:   'Book Bespoke Consultation',
    ctaSecondaryText: 'Explore Protocols',
  },
  about: {
    title:          'Bespoke Clinical Excellence Founded on Science',
    subtitle:       'A Higher Paradigm in Medical Skincare & Sensory Wellness',
    description:    'BeautyOasisRx was founded with a singular vision: to liberate medical aesthetics from generic, rushed protocols. Every face is an individual anatomy; every skin cellular matrix tells a distinct story. Our bespoke approach combines cutting-edge medical science with deep anatomical knowledge to create results that look naturally elevated — never overdone.',
    stat1Label:     'Verified Patients',
    stat1Value:     '18,000+',
    stat2Label:     'Five-Star Rating',
    stat2Value:     '4.98 / 5.0',
    stat3Label:     'Medical Specialists',
    stat3Value:     '12 Clinicians',
    ctaText:        'Begin Your Consultation',
    highlight1:     'Doctor-led protocols personalised to your unique cellular anatomy',
    highlight2:     'Sensory-inclusive suites designed for neurodivergent and anxious clients',
    highlight3:     'Medical-grade technology with evidence-based treatment protocols',
    accreditation1: 'American Board of Aesthetic Medicine',
    accreditation2: 'International Society of Dermatology',
    accreditation3: 'JAAD Certified Clinical Practice',
  },
  contact: {
    clinicName: 'BeautyOasisRx — Clinical Aesthetics & Bespoke Wellness',
    address:    '975 Watters Creek Blvd, Suite 240, Allen, TX 75013',
    phone:      '(214) 555-0190',
    email:      'concierge@beautyoasisrx.com',
    hours:      'Monday - Friday: 9am - 7pm | Saturday: 9am - 5pm | Sunday: Closed',
    instagram:  '@beautyoasisrx',
    ctaText:    'Schedule a Private Consultation',
  },
};

export const DEFAULT_TESTIMONIALS = [
  {
    id: 'fallback-1',
    name: 'Lady Charlotte Montagu',
    role: 'Verified Client • Mayfair Suite',
    treatment: 'Bespoke RF Microneedling & Exosomes',
    review: 'The level of medical expertise and bedside manner at Beauty Oasis is unprecedented. Dr. Alistair tailored a protocol that completely reversed my sun damage and texture without any unnatural downtime. My skin has not looked this luminous in fifteen years.',
    rating: 5,
    is_active: true,
    display_order: 1,
  },
  {
    id: 'fallback-2',
    name: 'Sarah Jenkins, PhD',
    role: 'Sensory-Calm Suite Client',
    treatment: 'Inclusive Sensory Hydrafacial Pro',
    review: 'As someone with extreme sensory sensitivity and anxiety around clinical environments, the sensory suite was life-changing. Soft warm lighting, completely silent equipment, and thoughtful pacing made this the first medical treatment I actually looked forward to.',
    rating: 5,
    is_active: true,
    display_order: 2,
  },
  {
    id: 'fallback-3',
    name: 'Marcus Vance',
    role: 'Verified Client • Harley Street',
    treatment: 'Laser Genesis & Clarifying Peel',
    review: 'Finally a clinic that treats skincare with clinical precision rather than fluffy salon marketing. 3 sessions in and my persistent rosacea flush is virtually gone. The at-home medical regimen is equally exceptional.',
    rating: 5,
    is_active: true,
    display_order: 3,
  },
];

// ─────────────────────────────────────────────
// FETCH SINGLE CMS SECTION
// Uses existing website_content table (section + data JSONB)
// ─────────────────────────────────────────────
export async function fetchCmsSection(section) {
  try {
    const { data, error } = await supabase
      .from('website_content')
      .select('data')
      .eq('section', section)
      .single();

    if (error) {
      // PGRST116 = "no rows" — expected if not yet saved
      if (error.code === 'PGRST116' || error.code === 'PGRST205') {
        return DEFAULT_CMS_CONTENT[section] || {};
      }
      throw error;
    }

    if (!data?.data) return DEFAULT_CMS_CONTENT[section] || {};

    // Merge defaults with saved data (so new CMS fields always have fallback values)
    return { ...DEFAULT_CMS_CONTENT[section], ...data.data };
  } catch (err) {
    console.warn(`[CMS] fetchCmsSection(${section}) failed, using defaults:`, err);
    return DEFAULT_CMS_CONTENT[section] || {};
  }
}

// ─────────────────────────────────────────────
// FETCH ALL SECTIONS AT ONCE
// ─────────────────────────────────────────────
export async function fetchAllCmsContent() {
  try {
    const { data, error } = await supabase
      .from('website_content')
      .select('section, data')
      .in('section', ['homepage', 'about', 'contact']);

    if (error) {
      if (error.code === 'PGRST205') {
        // Table doesn't exist yet — return defaults
        return DEFAULT_CMS_CONTENT;
      }
      throw error;
    }

    const result = {
      homepage: { ...DEFAULT_CMS_CONTENT.homepage },
      about:    { ...DEFAULT_CMS_CONTENT.about },
      contact:  { ...DEFAULT_CMS_CONTENT.contact },
    };

    (data || []).forEach(({ section, data: sectionData }) => {
      if (sectionData && result[section]) {
        result[section] = { ...result[section], ...sectionData };
      }
    });

    return result;
  } catch (err) {
    console.warn('[CMS] fetchAllCmsContent failed, using defaults:', err);
    return DEFAULT_CMS_CONTENT;
  }
}

// ─────────────────────────────────────────────
// SAVE SECTION (upsert to website_content)
// Compatible with existing supabaseDataService format
// ─────────────────────────────────────────────
export async function saveCmsSection(section, dataObj) {
  const { error } = await supabase
    .from('website_content')
    .upsert(
      { section, data: dataObj, updated_at: new Date().toISOString() },
      { onConflict: 'section' }
    );

  if (error) {
    console.error(`[CMS] saveCmsSection(${section}) error:`, error);
    throw error;
  }
  return { success: true };
}

// ─────────────────────────────────────────────
// TESTIMONIALS — FETCH
// Uses website_testimonials table.
// Falls back to default if table doesn't exist.
// ─────────────────────────────────────────────
export async function fetchTestimonials({ activeOnly = false } = {}) {
  try {
    let query = supabase
      .from('website_testimonials')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        // Table doesn't exist yet — return defaults
        return DEFAULT_TESTIMONIALS;
      }
      throw error;
    }

    return data && data.length > 0 ? data : DEFAULT_TESTIMONIALS;
  } catch (err) {
    console.warn('[CMS] fetchTestimonials failed, using defaults:', err);
    return DEFAULT_TESTIMONIALS;
  }
}

// ─────────────────────────────────────────────
// TESTIMONIALS — CREATE
// ─────────────────────────────────────────────
export async function createTestimonial(testimonial) {
  const { error, data } = await supabase
    .from('website_testimonials')
    .insert({
      name:          testimonial.name,
      role:          testimonial.role || 'Verified Patient',
      treatment:     testimonial.treatment || '',
      review:        testimonial.review,
      rating:        Number(testimonial.rating) || 5,
      image_url:     testimonial.image_url || null,
      is_active:     testimonial.is_active !== false,
      display_order: testimonial.display_order || 0,
    })
    .select()
    .single();

  if (error) {
    console.error('[CMS] createTestimonial error:', error);
    throw error;
  }
  return data;
}

// ─────────────────────────────────────────────
// TESTIMONIALS — UPDATE
// ─────────────────────────────────────────────
export async function updateTestimonial(id, updates) {
  const { error, data } = await supabase
    .from('website_testimonials')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[CMS] updateTestimonial error:', error);
    throw error;
  }
  return data;
}

// ─────────────────────────────────────────────
// TESTIMONIALS — TOGGLE ACTIVE
// ─────────────────────────────────────────────
export async function toggleTestimonialActive(id, currentActive) {
  return updateTestimonial(id, { is_active: !currentActive });
}

// ─────────────────────────────────────────────
// TESTIMONIALS — DELETE
// ─────────────────────────────────────────────
export async function deleteTestimonial(id) {
  const { error } = await supabase
    .from('website_testimonials')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[CMS] deleteTestimonial error:', error);
    throw error;
  }
  return { success: true };
}
