/**
 * PublicWebsitePage.jsx
 *
 * The public-facing Beauty Oasis website.
 * Fetches all content dynamically from Supabase via cmsService.
 * Falls back to DEFAULT_CMS_CONTENT if Supabase is unreachable.
 *
 * Sections:
 *  - Navigation
 *  - Hero
 *  - About / Clinical Foundation
 *  - Services (static showcase)
 *  - Testimonials
 *  - Contact & Hours
 *  - Footer
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  fetchAllCmsContent,
  fetchTestimonials,
  DEFAULT_CMS_CONTENT,
  DEFAULT_TESTIMONIALS,
} from '../services/cmsService';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const StarRating = ({ rating = 5, size = 14 }) => (
  <span style={{ display: 'inline-flex', gap: '2px', color: '#d4af72' }}>
    {Array.from({ length: rating }).map((_, i) => (
      <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ))}
  </span>
);

const CheckIcon = ({ size = 18, color = '#d4af72' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const MenuIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─────────────────────────────────────────────
// STATIC SERVICES DATA (not CMS-controlled)
// ─────────────────────────────────────────────
const SERVICES = [
  {
    id: 's1',
    badge: 'SIGNATURE',
    name: 'Hydrafacial Deluxe Pro',
    category: 'Skin Rejuvenation',
    description: 'Medical-grade hydradermabrasion combining vortex suction, gentle salicylic peel, and peptide-antioxidant saturation for immediate glass-skin luminosity.',
    duration: '60 min',
    price: 'From $185',
  },
  {
    id: 's2',
    badge: 'COLLAGEN INDUCTION',
    name: 'RF Microneedling',
    category: 'Anti-Ageing',
    description: 'Ultra-fine gold-insulated micro-pins deliver focused fractional radiofrequency deep into the reticular dermis for profound skin remodelling.',
    duration: '75 min',
    price: 'From $360',
  },
  {
    id: 's3',
    badge: 'CELLULAR REGENERATION',
    name: 'Polynucleotide Biostimulation',
    category: 'Injectables',
    description: 'Highly purified DNA polymer chains stimulate fibroblasts, boost microcirculation, and regenerate damaged tissue structure.',
    duration: '45 min',
    price: 'From $320',
  },
  {
    id: 's4',
    badge: 'VASCULAR & PIGMENT',
    name: 'Laser Genesis',
    category: 'Laser & IPL',
    description: 'Non-ablative micropulse laser gently warms the papillary dermis, closing dilated micro-capillaries and diffusing facial redness with zero recovery.',
    duration: '45 min',
    price: 'From $240',
  },
];

// ─────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────
const NAV_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Protocols', href: '#services' },
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'Contact', href: '#contact' },
];

function PublicNav({ contact }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (href) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <nav
        className="bo-nav"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          padding: scrolled ? '12px 0' : '22px 0',
          background: scrolled ? 'rgba(8, 22, 45, 0.97)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(212, 175, 114, 0.15)' : 'none',
          transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="bo-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          {/* Logo */}
          <a
            href="#home"
            onClick={(e) => { e.preventDefault(); scrollTo('#home'); }}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}
          >
            <img src="/assets/logo.jpeg" alt="BeautyOasisRx" style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover' }} />
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', fontWeight: 600, color: '#ffffff', letterSpacing: '0.02em', lineHeight: 1 }}>
                BeautyOasisRx
              </div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(212,175,114,0.85)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '2px' }}>
                Clinical Aesthetics
              </div>
            </div>
          </a>

          {/* Desktop links */}
          <div className="bo-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={(e) => { e.preventDefault(); scrollTo(l.href); }}
                style={{
                  color: 'rgba(255,255,255,0.82)',
                  textDecoration: 'none',
                  fontSize: '0.82rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 500,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => { e.target.style.color = '#d4af72'; }}
                onMouseLeave={(e) => { e.target.style.color = 'rgba(255,255,255,0.82)'; }}
              >
                {l.label}
              </a>
            ))}
            <a
              href={`tel:${contact?.phone || ''}`}
              style={{
                background: 'linear-gradient(135deg, #d4af72 0%, #c09a58 100%)',
                color: '#0a1628',
                padding: '10px 22px',
                borderRadius: '50px',
                textDecoration: 'none',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 20px rgba(212,175,114,0.35)'; }}
              onMouseLeave={(e) => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}
            >
              {contact?.phone || 'Call Us'}
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="bo-mobile-menu-btn"
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '4px', display: 'none' }}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(8, 22, 45, 0.98)',
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '36px',
            backdropFilter: 'blur(20px)',
          }}
        >
          <button
            onClick={() => setMobileOpen(false)}
            style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
          >
            <CloseIcon size={28} />
          </button>
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={(e) => { e.preventDefault(); scrollTo(l.href); }}
              style={{
                color: '#ffffff',
                textDecoration: 'none',
                fontSize: '1.6rem',
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              {l.label}
            </a>
          ))}
          <a
            href={`tel:${contact?.phone || ''}`}
            style={{
              background: 'linear-gradient(135deg, #d4af72 0%, #c09a58 100%)',
              color: '#0a1628',
              padding: '14px 36px',
              borderRadius: '50px',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginTop: '8px',
            }}
          >
            {contact?.phone || 'Call Us'}
          </a>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// MAIN PUBLIC PAGE
// ─────────────────────────────────────────────
export function PublicWebsitePage() {
  const [cms, setCms] = useState({
    homepage: { ...DEFAULT_CMS_CONTENT.homepage },
    about:    { ...DEFAULT_CMS_CONTENT.about },
    contact:  { ...DEFAULT_CMS_CONTENT.contact },
  });
  const [testimonials, setTestimonials] = useState(DEFAULT_TESTIMONIALS);
  const [cmsLoaded, setCmsLoaded] = useState(false);

  // Active testimonial index for carousel
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const autoRef = useRef(null);

  // ── Load CMS data ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchAllCmsContent(),
      fetchTestimonials({ activeOnly: true }),
    ]).then(([content, tests]) => {
      if (!cancelled) {
        setCms(content);
        if (tests && tests.length > 0) setTestimonials(tests);
        setCmsLoaded(true);
      }
    }).catch((err) => {
      console.warn('[PublicSite] CMS load error, using defaults:', err);
      if (!cancelled) setCmsLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Testimonial auto-advance ───────────────
  useEffect(() => {
    if (testimonials.length <= 1) return;
    autoRef.current = setInterval(() => {
      setActiveTestimonial((i) => (i + 1) % testimonials.length);
    }, 5500);
    return () => clearInterval(autoRef.current);
  }, [testimonials.length]);

  const { homepage: hp, about: ab, contact: ct } = cms;

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      id="home"
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: '#020c1b',
        color: '#ffffff',
        overflowX: 'hidden',
      }}
    >
      <PublicNav contact={ct} />

      {/* ════════════════════════════════════════
          HERO SECTION
      ════════════════════════════════════════ */}
      <section
        id="hero"
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, #020c1b 0%, #0a1f3d 40%, #0d2847 70%, #091428 100%)',
            zIndex: 0,
          }}
        />
        {/* Decorative orbs */}
        <div style={{ position: 'absolute', top: '15%', right: '-5%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,114,0.08) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,90,168,0.12) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

        {/* Hero image */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '50%',
            zIndex: 1,
          }}
        >
          <img
            src="/images/hero_treatment.jpg"
            alt="BeautyOasisRx Clinical Treatment"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, #020c1b 0%, rgba(2,12,27,0.3) 60%, transparent 100%)',
            }}
          />
        </div>

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '120px 24px 80px',
            width: '100%',
          }}
        >
          <div style={{ maxWidth: '620px' }}>
            {/* Badge */}
            {hp.featuredBadge && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(212,175,114,0.12)',
                  border: '1px solid rgba(212,175,114,0.35)',
                  borderRadius: '50px',
                  padding: '7px 18px',
                  marginBottom: '28px',
                  fontSize: '0.7rem',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#d4af72',
                  fontWeight: 600,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d4af72', flexShrink: 0 }} />
                {hp.featuredBadge}
              </div>
            )}

            {/* Headline */}
            {hp.heroTitle && (
              <h1
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 'clamp(2.8rem, 5.5vw, 5rem)',
                  fontWeight: 600,
                  lineHeight: 1.08,
                  color: '#ffffff',
                  margin: '0 0 20px',
                  letterSpacing: '-0.01em',
                }}
              >
                {hp.heroTitle.split('. ').map((part, i, arr) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span style={{ color: '#d4af72' }}>. </span>}
                    {part}
                    {i === arr.length - 1 && part.includes('.') ? '' : ''}
                  </React.Fragment>
                ))}
              </h1>
            )}

            {/* Tagline */}
            {hp.heroTagline && (
              <p
                style={{
                  fontSize: 'clamp(0.95rem, 1.5vw, 1.15rem)',
                  color: 'rgba(212,175,114,0.9)',
                  fontStyle: 'italic',
                  fontFamily: "'Cormorant Garamond', serif",
                  margin: '0 0 24px',
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                {hp.heroTagline}
              </p>
            )}

            {/* Description */}
            {hp.heroDescription && (
              <p
                style={{
                  fontSize: 'clamp(0.9rem, 1.2vw, 1.02rem)',
                  color: 'rgba(255,255,255,0.72)',
                  lineHeight: 1.75,
                  margin: '0 0 40px',
                  maxWidth: '540px',
                }}
              >
                {hp.heroDescription}
              </p>
            )}

            {/* CTAs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
              <a
                href="#contact"
                onClick={(e) => { e.preventDefault(); scrollTo('contact'); }}
                style={{
                  background: 'linear-gradient(135deg, #d4af72 0%, #c09a58 100%)',
                  color: '#0a1628',
                  padding: '15px 32px',
                  borderRadius: '50px',
                  textDecoration: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: 'all 0.25s',
                  boxShadow: '0 8px 30px rgba(212,175,114,0.3)',
                  display: 'inline-block',
                }}
                onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 40px rgba(212,175,114,0.45)'; }}
                onMouseLeave={(e) => { e.target.style.transform = ''; e.target.style.boxShadow = '0 8px 30px rgba(212,175,114,0.3)'; }}
              >
                {hp.ctaPrimaryText || 'Book Consultation'}
              </a>
              <a
                href="#services"
                onClick={(e) => { e.preventDefault(); scrollTo('services'); }}
                style={{
                  color: '#ffffff',
                  padding: '14px 30px',
                  borderRadius: '50px',
                  textDecoration: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  border: '1px solid rgba(255,255,255,0.3)',
                  transition: 'all 0.25s',
                  display: 'inline-block',
                }}
                onMouseEnter={(e) => { e.target.style.borderColor = '#d4af72'; e.target.style.color = '#d4af72'; }}
                onMouseLeave={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.3)'; e.target.style.color = '#ffffff'; }}
              >
                {hp.ctaSecondaryText || 'Explore Protocols'}
              </a>
            </div>

            {/* Stats row */}
            <div
              style={{
                display: 'flex',
                gap: '40px',
                marginTop: '52px',
                flexWrap: 'wrap',
              }}
            >
              {[
                { value: '18,000+', label: 'Verified Patients' },
                { value: '4.98★', label: 'Average Rating' },
                { value: '12', label: 'Specialists' },
              ].map((s) => (
                <div key={s.label}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 700, color: '#d4af72', lineHeight: 1 }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            animation: 'boBounce 2s ease-in-out infinite',
          }}
        >
          <div style={{ width: '1px', height: '40px', background: 'linear-gradient(to bottom, transparent, rgba(212,175,114,0.6))' }} />
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d4af72' }} />
        </div>
      </section>

      {/* ════════════════════════════════════════
          ABOUT SECTION
      ════════════════════════════════════════ */}
      <section
        id="about"
        style={{
          padding: 'clamp(80px, 12vw, 140px) 24px',
          background: 'linear-gradient(180deg, #020c1b 0%, #051324 50%, #020c1b 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative line */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '1px', height: '80px', background: 'linear-gradient(to bottom, transparent, rgba(212,175,114,0.4))' }} />

        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 'clamp(48px, 8vw, 80px)' }}>
            {ab.subtitle && (
              <div
                style={{
                  fontSize: '0.7rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#d4af72',
                  marginBottom: '16px',
                  fontWeight: 600,
                }}
              >
                {ab.subtitle}
              </div>
            )}
            {ab.title && (
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 'clamp(2.2rem, 4vw, 3.8rem)',
                  fontWeight: 600,
                  color: '#ffffff',
                  margin: '0 auto 24px',
                  maxWidth: '800px',
                  lineHeight: 1.15,
                }}
              >
                {ab.title}
              </h2>
            )}
            {ab.description && (
              <p
                style={{
                  color: 'rgba(255,255,255,0.65)',
                  maxWidth: '680px',
                  margin: '0 auto',
                  lineHeight: 1.85,
                  fontSize: 'clamp(0.9rem, 1.2vw, 1.02rem)',
                }}
              >
                {ab.description}
              </p>
            )}
          </div>

          {/* Two-column layout */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: 'clamp(32px, 5vw, 64px)',
              alignItems: 'start',
            }}
          >
            {/* Left: Image + stats */}
            <div>
              <div style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', marginBottom: '32px' }}>
                <img
                  src="/images/clinical_technology.jpg"
                  alt="Clinical technology at BeautyOasisRx"
                  style={{ width: '100%', height: '380px', objectFit: 'cover', display: 'block' }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(2,12,27,0.7) 100%)' }} />
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {[
                  { label: ab.stat1Label || 'Verified Patients', value: ab.stat1Value || '18,000+' },
                  { label: ab.stat2Label || 'Five-Star Rating',  value: ab.stat2Value || '4.98 / 5.0' },
                  { label: ab.stat3Label || 'Medical Specialists',value: ab.stat3Value || '12 Clinicians' },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(212,175,114,0.15)',
                      borderRadius: '16px',
                      padding: '20px 16px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 700, color: '#d4af72', lineHeight: 1 }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '6px' }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Highlights + accreditations */}
            <div>
              <div style={{ marginBottom: '36px' }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', color: '#d4af72', marginBottom: '20px', fontWeight: 600 }}>
                  Our Clinical Distinctions
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[ab.highlight1, ab.highlight2, ab.highlight3].filter(Boolean).map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                      <div style={{ flexShrink: 0, marginTop: '2px' }}>
                        <CheckIcon size={18} />
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.6, fontSize: '0.94rem' }}>{h}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Accreditations */}
              <div
                style={{
                  background: 'rgba(212,175,114,0.06)',
                  border: '1px solid rgba(212,175,114,0.2)',
                  borderRadius: '20px',
                  padding: '28px',
                  marginBottom: '32px',
                }}
              >
                <div style={{ fontSize: '0.68rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d4af72', marginBottom: '16px', fontWeight: 600 }}>
                  Accreditations & Certifications
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[ab.accreditation1, ab.accreditation2, ab.accreditation3].filter(Boolean).map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem' }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#d4af72', flexShrink: 0 }} />
                      {a}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sensory Suite highlight */}
              <div
                style={{
                  borderRadius: '20px',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <img
                  src="/images/sensory_room.jpg"
                  alt="Sensory-Inclusive Suite"
                  style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, transparent 20%, rgba(2,12,27,0.85) 100%)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: '20px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d4af72', marginBottom: '4px' }}>
                      Sensory-Inclusive Suite
                    </div>
                    <div style={{ fontSize: '0.88rem', color: '#ffffff', fontFamily: "'Cormorant Garamond', serif" }}>
                      Thoughtfully designed for neurodivergent &amp; anxious clients
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div style={{ marginTop: '28px' }}>
                <a
                  href="#contact"
                  onClick={(e) => { e.preventDefault(); scrollTo('contact'); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #d4af72 0%, #c09a58 100%)',
                    color: '#0a1628',
                    padding: '14px 28px',
                    borderRadius: '50px',
                    textDecoration: 'none',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    transition: 'all 0.25s',
                    boxShadow: '0 6px 24px rgba(212,175,114,0.25)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
                >
                  {ab.ctaText || 'Begin Your Consultation'}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SERVICES SECTION
      ════════════════════════════════════════ */}
      <section
        id="services"
        style={{
          padding: 'clamp(80px, 12vw, 140px) 24px',
          background: '#030d1e',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 'clamp(48px, 7vw, 72px)' }}>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#d4af72', marginBottom: '14px', fontWeight: 600 }}>
              Bespoke Clinical Protocols
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 600, color: '#ffffff', margin: '0 0 18px', lineHeight: 1.15 }}>
              Signature Treatment Menu
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', maxWidth: '560px', margin: '0 auto', lineHeight: 1.75, fontSize: '0.95rem' }}>
              Every protocol at BeautyOasisRx is designed around your unique cellular anatomy — never a one-size-fits-all approach.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '24px',
            }}
          >
            {SERVICES.map((svc) => (
              <div
                key={svc.id}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(212,175,114,0.12)',
                  borderRadius: '20px',
                  padding: '28px',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(212,175,114,0.35)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(212,175,114,0.12)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.transform = '';
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    fontSize: '0.6rem',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#d4af72',
                    border: '1px solid rgba(212,175,114,0.3)',
                    borderRadius: '50px',
                    padding: '4px 12px',
                    marginBottom: '16px',
                    fontWeight: 600,
                  }}
                >
                  {svc.badge}
                </div>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', fontWeight: 600, color: '#ffffff', margin: '0 0 6px', lineHeight: 1.2 }}>
                  {svc.name}
                </h3>
                <div style={{ fontSize: '0.72rem', color: 'rgba(212,175,114,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
                  {svc.category}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, fontSize: '0.88rem', margin: '0 0 20px' }}>
                  {svc.description}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>{svc.duration}</span>
                  <span style={{ fontSize: '1rem', fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, color: '#d4af72' }}>{svc.price}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '52px' }}>
            <a
              href="#contact"
              onClick={(e) => { e.preventDefault(); scrollTo('contact'); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: '#d4af72',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                border: '1px solid rgba(212,175,114,0.3)',
                padding: '13px 30px',
                borderRadius: '50px',
                transition: 'all 0.25s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(212,175,114,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              Schedule a Bespoke Consultation
            </a>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          BEFORE/AFTER SECTION
      ════════════════════════════════════════ */}
      <section
        style={{
          padding: 'clamp(60px, 8vw, 100px) 24px',
          background: 'linear-gradient(180deg, #030d1e 0%, #020c1b 100%)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#d4af72', marginBottom: '14px', fontWeight: 600 }}>
            Clinical Results
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 3.5vw, 3rem)', fontWeight: 600, color: '#ffffff', margin: '0 0 40px', lineHeight: 1.2 }}>
            Real Patients, Remarkable Outcomes
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ position: 'relative' }}>
              <img src="/assets/before.webp" alt="Before treatment" style={{ width: '100%', height: '320px', objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(2,12,27,0.85)', borderRadius: '8px', padding: '5px 12px', fontSize: '0.72rem', color: '#ffffff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Before
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <img src="/assets/after.webp" alt="After treatment" style={{ width: '100%', height: '320px', objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(212,175,114,0.9)', borderRadius: '8px', padding: '5px 12px', fontSize: '0.72rem', color: '#0a1628', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                After
              </div>
            </div>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', marginTop: '16px', letterSpacing: '0.04em' }}>
            Individual results may vary. All treatments performed by licensed medical professionals.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════
          TESTIMONIALS SECTION
      ════════════════════════════════════════ */}
      <section
        id="testimonials"
        style={{
          padding: 'clamp(80px, 12vw, 140px) 24px',
          background: 'linear-gradient(180deg, #020c1b 0%, #030d1e 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background accent */}
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: '800px', height: '400px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(212,175,114,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 6vw, 64px)' }}>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#d4af72', marginBottom: '14px', fontWeight: 600 }}>
              Verified Patient Experiences
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 600, color: '#ffffff', margin: '0', lineHeight: 1.15 }}>
              What Our Clients Say
            </h2>
          </div>

          {/* Active testimonial */}
          {testimonials.length > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(212,175,114,0.18)',
                  borderRadius: '28px',
                  padding: 'clamp(32px, 5vw, 56px)',
                  marginBottom: '32px',
                  minHeight: '280px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  transition: 'all 0.4s ease',
                }}
              >
                <StarRating rating={testimonials[activeTestimonial]?.rating || 5} size={18} />
                <blockquote
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 'clamp(1.15rem, 2.2vw, 1.55rem)',
                    fontStyle: 'italic',
                    color: 'rgba(255,255,255,0.9)',
                    lineHeight: 1.65,
                    margin: '24px 0',
                    fontWeight: 500,
                  }}
                >
                  &ldquo;{testimonials[activeTestimonial]?.review}&rdquo;
                </blockquote>
                <div>
                  <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '1rem', marginBottom: '4px' }}>
                    {testimonials[activeTestimonial]?.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
                    {testimonials[activeTestimonial]?.role}
                  </div>
                  {testimonials[activeTestimonial]?.treatment && (
                    <div style={{ fontSize: '0.75rem', color: 'rgba(212,175,114,0.7)', marginTop: '6px', fontWeight: 600 }}>
                      {testimonials[activeTestimonial]?.treatment}
                    </div>
                  )}
                </div>
              </div>

              {/* Dots */}
              {testimonials.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                  {testimonials.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setActiveTestimonial(i); clearInterval(autoRef.current); }}
                      style={{
                        width: i === activeTestimonial ? '24px' : '8px',
                        height: '8px',
                        borderRadius: '50px',
                        border: 'none',
                        background: i === activeTestimonial ? '#d4af72' : 'rgba(255,255,255,0.2)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        padding: 0,
                      }}
                      aria-label={`View testimonial ${i + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* All testimonials mini grid */}
              {testimonials.length > 1 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '16px',
                    marginTop: '8px',
                  }}
                >
                  {testimonials.map((t, i) => (
                    <div
                      key={t.id}
                      onClick={() => { setActiveTestimonial(i); clearInterval(autoRef.current); }}
                      style={{
                        background: i === activeTestimonial ? 'rgba(212,175,114,0.1)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${i === activeTestimonial ? 'rgba(212,175,114,0.35)' : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: '16px',
                        padding: '18px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.25s',
                      }}
                    >
                      <StarRating rating={t.rating || 5} size={11} />
                      <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', margin: '10px 0 8px', lineHeight: 1.55, fontStyle: 'italic' }}>
                        &ldquo;{t.review?.slice(0, 100)}{t.review?.length > 100 ? '…' : ''}&rdquo;
                      </p>
                      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#ffffff' }}>{t.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{t.role}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════
          CONTACT SECTION
      ════════════════════════════════════════ */}
      <section
        id="contact"
        style={{
          padding: 'clamp(80px, 12vw, 140px) 24px',
          background: 'linear-gradient(180deg, #030d1e 0%, #020c1b 100%)',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 'clamp(48px, 7vw, 72px)' }}>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#d4af72', marginBottom: '14px', fontWeight: 600 }}>
              Visit The Clinic
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 600, color: '#ffffff', margin: '0', lineHeight: 1.15 }}>
              Contact & Coordinates
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: 'clamp(32px, 5vw, 64px)',
              alignItems: 'start',
            }}
          >
            {/* Contact details */}
            <div>
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 600, color: '#d4af72', marginBottom: '24px' }}>
                  {ct.clinicName}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {ct.address && (
                    <ContactRow icon="📍" label="Address">
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(ct.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'rgba(255,255,255,0.78)', textDecoration: 'none', lineHeight: 1.5 }}
                        onMouseEnter={(e) => { e.target.style.color = '#d4af72'; }}
                        onMouseLeave={(e) => { e.target.style.color = 'rgba(255,255,255,0.78)'; }}
                      >
                        {ct.address}
                      </a>
                    </ContactRow>
                  )}
                  {ct.phone && (
                    <ContactRow icon="📞" label="Concierge">
                      <a href={`tel:${ct.phone}`} style={{ color: 'rgba(255,255,255,0.78)', textDecoration: 'none' }}
                        onMouseEnter={(e) => { e.target.style.color = '#d4af72'; }}
                        onMouseLeave={(e) => { e.target.style.color = 'rgba(255,255,255,0.78)'; }}>
                        {ct.phone}
                      </a>
                    </ContactRow>
                  )}
                  {ct.email && (
                    <ContactRow icon="✉️" label="Email">
                      <a href={`mailto:${ct.email}`} style={{ color: 'rgba(255,255,255,0.78)', textDecoration: 'none' }}
                        onMouseEnter={(e) => { e.target.style.color = '#d4af72'; }}
                        onMouseLeave={(e) => { e.target.style.color = 'rgba(255,255,255,0.78)'; }}>
                        {ct.email}
                      </a>
                    </ContactRow>
                  )}
                  {ct.hours && (
                    <ContactRow icon="🕐" label="Hours">
                      <div style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.6 }}>
                        {ct.hours.split('|').map((h, i) => (
                          <div key={i}>{h.trim()}</div>
                        ))}
                      </div>
                    </ContactRow>
                  )}
                  {ct.instagram && (
                    <ContactRow icon="📸" label="Instagram">
                      <span style={{ color: 'rgba(255,255,255,0.78)' }}>{ct.instagram}</span>
                    </ContactRow>
                  )}
                </div>
              </div>

              {/* CTA */}
              <a
                href={ct.phone ? `tel:${ct.phone}` : '#'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #d4af72 0%, #c09a58 100%)',
                  color: '#0a1628',
                  padding: '15px 32px',
                  borderRadius: '50px',
                  textDecoration: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  boxShadow: '0 8px 30px rgba(212,175,114,0.3)',
                  transition: 'all 0.25s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
              >
                {ct.ctaText || 'Schedule a Consultation'}
              </a>
            </div>

            {/* Map / image placeholder */}
            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(212,175,114,0.15)',
                borderRadius: '24px',
                overflow: 'hidden',
                minHeight: '380px',
                position: 'relative',
              }}
            >
              <img
                src="/images/ai_girl_warm.jpg"
                alt="BeautyOasisRx clinic"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: '380px' }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, transparent 50%, rgba(2,12,27,0.9) 100%)',
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: '28px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d4af72', marginBottom: '6px' }}>
                    Allen, Texas
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#ffffff', fontWeight: 600 }}>
                    {ct.address}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════ */}
      <footer
        style={{
          background: '#010810',
          padding: 'clamp(40px, 6vw, 64px) 24px',
          borderTop: '1px solid rgba(212,175,114,0.1)',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '32px',
              marginBottom: '40px',
            }}
          >
            <div style={{ maxWidth: '320px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <img src="/assets/logo.jpeg" alt="BeautyOasisRx" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }} />
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}>
                  BeautyOasisRx
                </div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', lineHeight: 1.7, margin: 0 }}>
                Doctor-led medical aesthetics where science meets sensory luxury. Bespoke protocols for natural, cellular-level rejuvenation.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '64px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d4af72', marginBottom: '16px', fontWeight: 600 }}>
                  Protocols
                </div>
                {SERVICES.map((s) => (
                  <div key={s.id} style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                    {s.name}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d4af72', marginBottom: '16px', fontWeight: 600 }}>
                  Contact
                </div>
                {ct.phone && <div style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>{ct.phone}</div>}
                {ct.email && <div style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>{ct.email}</div>}
                {ct.instagram && <div style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>{ct.instagram}</div>}
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>
              © {new Date().getFullYear()} BeautyOasisRx. All rights reserved. Allen, Texas.
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>
              Medical aesthetics • Sensory-inclusive care
            </div>
          </div>
        </div>
      </footer>

      {/* ── Global animation styles ── */}
      <style>{`
        @keyframes boBounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }
        @keyframes boSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .bo-nav-links { display: none !important; }
          .bo-mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Small helper component for contact rows ───────────
function ContactRow({ icon, label, children }) {
  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
      <div style={{ fontSize: '1.2rem', width: '32px', flexShrink: 0, marginTop: '1px' }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#d4af72', marginBottom: '4px', fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontSize: '0.9rem' }}>{children}</div>
      </div>
    </div>
  );
}
