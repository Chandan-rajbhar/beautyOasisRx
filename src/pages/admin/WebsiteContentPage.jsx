import React, { useState, useEffect, useCallback } from 'react';
import {
  Save,
  Check,
  AlertCircle,
  Loader2,
  Star,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import {
  fetchCmsSection,
  fetchTestimonials,
  saveCmsSection,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  toggleTestimonialActive,
  DEFAULT_CMS_CONTENT,
  DEFAULT_TESTIMONIALS,
} from '../../services/cmsService';

// ─── Tiny inline spinner ───────────────────────────────────
const Spinner = ({ size = 16 }) => (
  <span style={{ display: 'inline-flex', animation: 'boSpin 0.7s linear infinite' }}>
    <Loader2 size={size} />
  </span>
);

// ─── Alert banner ─────────────────────────────────────────
const AlertBanner = ({ type, message, onClose }) => {
  if (!message) return null;
  const colors =
    type === 'success'
      ? { bg: '#f0fdf4', border: '#86efac', text: '#166534', icon: <Check size={16} /> }
      : { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', icon: <AlertCircle size={16} /> };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '10px',
        color: colors.text,
        fontSize: '0.86rem',
        fontWeight: 500,
        marginBottom: '20px',
      }}
    >
      {colors.icon}
      <span style={{ flex: 1 }}>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', lineHeight: 1 }}
        >
          ×
        </button>
      )}
    </div>
  );
};

export const WebsiteContentPage = () => {
  const [activeTab, setActiveTab] = useState('homepage');

  // ── Section data state ──
  const [homepageData, setHomepageData] = useState(DEFAULT_CMS_CONTENT.homepage);
  const [aboutData, setAboutData] = useState(DEFAULT_CMS_CONTENT.about);
  const [contactData, setContactData] = useState(DEFAULT_CMS_CONTENT.contact);
  const [testimonialsList, setTestimonialsList] = useState([]);

  // ── UI state ──
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });

  // ── Testimonial modals ──
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(null); // testimonial object or null
  const [deleteConfirm, setDeleteConfirm] = useState(null); // id or null

  const [newTestimonial, setNewTestimonial] = useState({
    name: '',
    role: 'Verified Patient • Allen Suite',
    rating: 5,
    treatment: '',
    review: '',
    is_active: true,
    display_order: 0,
  });

  // ── Load all CMS data on mount ──────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [hp, ab, ct, tests] = await Promise.all([
        fetchCmsSection('homepage'),
        fetchCmsSection('about'),
        fetchCmsSection('contact'),
        fetchTestimonials({ activeOnly: false }),
      ]);
      setHomepageData(hp);
      setAboutData(ab);
      setContactData(ct);
      setTestimonialsList(tests);
    } catch (err) {
      console.error('[CMS Dashboard] Failed to load:', err);
      setAlert({ type: 'error', message: 'Failed to load CMS data. Displaying defaults.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert({ type: '', message: '' }), 4000);
  };

  // ── Save current section ────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === 'homepage') {
        if (!homepageData.heroTitle?.trim()) {
          showAlert('error', 'Hero Headline is required.');
          setSaving(false);
          return;
        }
        await saveCmsSection('homepage', homepageData);
      } else if (activeTab === 'about') {
        if (!aboutData.title?.trim()) {
          showAlert('error', 'Section Heading is required.');
          setSaving(false);
          return;
        }
        await saveCmsSection('about', aboutData);
      } else if (activeTab === 'contact') {
        if (!contactData.address?.trim()) {
          showAlert('error', 'Clinic Address is required.');
          setSaving(false);
          return;
        }
        await saveCmsSection('contact', contactData);
      }
      showAlert('success', 'Changes published to website successfully!');
    } catch (err) {
      console.error('[CMS Dashboard] Save error:', err);
      showAlert('error', `Save failed: ${err?.message || 'Unknown error'}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  // ── Testimonials CRUD ───────────────────────────────────
  const handleAddTestimonial = async (e) => {
    e.preventDefault();
    if (!newTestimonial.name.trim() || !newTestimonial.review.trim()) return;
    setSaving(true);
    try {
      const created = await createTestimonial({
        ...newTestimonial,
        display_order: testimonialsList.length + 1,
      });
      setTestimonialsList((prev) => [created, ...prev]);
      setAddModal(false);
      setNewTestimonial({
        name: '',
        role: 'Verified Patient • Allen Suite',
        rating: 5,
        treatment: '',
        review: '',
        is_active: true,
        display_order: 0,
      });
      showAlert('success', 'Testimonial added successfully!');
    } catch (err) {
      showAlert('error', 'Failed to add testimonial. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTestimonial = async (e) => {
    e.preventDefault();
    if (!editModal) return;
    setSaving(true);
    try {
      const updated = await updateTestimonial(editModal.id, {
        name: editModal.name,
        role: editModal.role,
        treatment: editModal.treatment,
        review: editModal.review,
        rating: Number(editModal.rating),
        is_active: editModal.is_active,
        display_order: editModal.display_order,
      });
      setTestimonialsList((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditModal(null);
      showAlert('success', 'Testimonial updated successfully!');
    } catch (err) {
      showAlert('error', 'Failed to update testimonial. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id, currentActive) => {
    try {
      const updated = await toggleTestimonialActive(id, currentActive);
      setTestimonialsList((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      showAlert('error', 'Failed to toggle testimonial status.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTestimonial(id);
      setTestimonialsList((prev) => prev.filter((t) => t.id !== id));
      setDeleteConfirm(null);
      showAlert('success', 'Testimonial deleted.');
    } catch {
      showAlert('error', 'Failed to delete testimonial.');
    }
  };

  // ── Tab definitions ─────────────────────────────────────
  const tabs = [
    { id: 'homepage', label: 'Homepage Hero & Taglines' },
    { id: 'about', label: 'About Clinic & Accreditations' },
    { id: 'contact', label: 'Contact Coordinates & Hours' },
    { id: 'testimonials', label: 'Patient Testimonials & Reviews' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px', color: '#64748b' }}>
        <Spinner size={24} />
        <span style={{ fontSize: '0.95rem' }}>Loading CMS content from Supabase…</span>
      </div>
    );
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Website Content Management (CMS)</h1>
          <p>Dynamically update public website headlines, clinic hours, contact coordinates, and client reviews.</p>
        </div>

        <div className="admin-page-actions">

          <a
            href="/home"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 16px',
              background: 'rgba(212, 175, 114, 0.08)',
              border: '1px solid rgba(212, 175, 114, 0.35)',
              borderRadius: '8px',
              color: '#92742a',
              textDecoration: 'none',
              fontSize: '0.83rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(212,175,114,0.16)'; e.currentTarget.style.color = '#7a6120'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(212,175,114,0.08)'; e.currentTarget.style.color = '#92742a'; }}
            title="Open the public website in a new tab"
          >
            <ExternalLink size={14} />
            Preview Website
          </a>
          {activeTab !== 'testimonials' && (
            <AdminButton
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              icon={saving ? <Spinner size={16} /> : <Save size={16} />}
            >
              {saving ? 'Publishing…' : 'Publish Website Updates'}
            </AdminButton>
          )}
        </div>
      </div>

      {/* ── Alert ── */}
      <AlertBanner
        type={alert.type}
        message={alert.message}
        onClose={() => setAlert({ type: '', message: '' })}
      />

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px', flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              fontSize: '0.88rem',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? '#1e5aa8' : '#64748b',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #1e5aa8' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════
          TAB: HOMEPAGE HERO
      ════════════════════════════════════════ */}
      {activeTab === 'homepage' && (
        <div className="admin-card" style={{ maxWidth: '850px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#0f2942' }}>
            Hero Banner & Primary Positioning
          </h3>

          <div className="admin-form-group">
            <label className="admin-form-label">Featured Clinical Badge</label>
            <input
              type="text"
              className="admin-form-input"
              value={homepageData.featuredBadge || ''}
              onChange={(e) => setHomepageData({ ...homepageData, featuredBadge: e.target.value })}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Hero Headline <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="admin-form-input"
              value={homepageData.heroTitle || ''}
              onChange={(e) => setHomepageData({ ...homepageData, heroTitle: e.target.value })}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Sub-Headline Tagline</label>
            <input
              type="text"
              className="admin-form-input"
              value={homepageData.heroTagline || ''}
              onChange={(e) => setHomepageData({ ...homepageData, heroTagline: e.target.value })}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Hero Description Paragraph</label>
            <textarea
              className="admin-form-textarea"
              rows="4"
              value={homepageData.heroDescription || ''}
              onChange={(e) => setHomepageData({ ...homepageData, heroDescription: e.target.value })}
            />
          </div>

          <div className="admin-form-grid-2">
            <div className="admin-form-group">
              <label className="admin-form-label">Primary Call to Action</label>
              <input
                type="text"
                className="admin-form-input"
                value={homepageData.ctaPrimaryText || ''}
                onChange={(e) => setHomepageData({ ...homepageData, ctaPrimaryText: e.target.value })}
              />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Secondary Call to Action</label>
              <input
                type="text"
                className="admin-form-input"
                value={homepageData.ctaSecondaryText || ''}
                onChange={(e) => setHomepageData({ ...homepageData, ctaSecondaryText: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          TAB: ABOUT
      ════════════════════════════════════════ */}
      {activeTab === 'about' && (
        <div className="admin-card" style={{ maxWidth: '850px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#0f2942' }}>
            About BeautyOasisRx Clinical Foundation
          </h3>

          <div className="admin-form-group">
            <label className="admin-form-label">Section Heading <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="admin-form-input"
              value={aboutData.title || ''}
              onChange={(e) => setAboutData({ ...aboutData, title: e.target.value })}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Sub-Title</label>
            <input
              type="text"
              className="admin-form-input"
              value={aboutData.subtitle || ''}
              onChange={(e) => setAboutData({ ...aboutData, subtitle: e.target.value })}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Medical Aesthetics Philosophy</label>
            <textarea
              className="admin-form-textarea"
              rows="5"
              value={aboutData.description || ''}
              onChange={(e) => setAboutData({ ...aboutData, description: e.target.value })}
            />
          </div>

          <h4 style={{ margin: '20px 0 12px', fontSize: '0.95rem', color: '#0f2942' }}>Clinic Stats</h4>
          <div className="admin-form-grid-2">
            {[1, 2, 3].map((n) => (
              <React.Fragment key={n}>
                <div className="admin-form-group">
                  <label className="admin-form-label">Stat {n} — Label</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={aboutData[`stat${n}Label`] || ''}
                    onChange={(e) => setAboutData({ ...aboutData, [`stat${n}Label`]: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Stat {n} — Value</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={aboutData[`stat${n}Value`] || ''}
                    onChange={(e) => setAboutData({ ...aboutData, [`stat${n}Value`]: e.target.value })}
                  />
                </div>
              </React.Fragment>
            ))}
          </div>

          <h4 style={{ margin: '20px 0 12px', fontSize: '0.95rem', color: '#0f2942' }}>Clinic Highlights</h4>
          {[1, 2, 3].map((n) => (
            <div className="admin-form-group" key={n}>
              <label className="admin-form-label">Highlight {n}</label>
              <input
                type="text"
                className="admin-form-input"
                value={aboutData[`highlight${n}`] || ''}
                onChange={(e) => setAboutData({ ...aboutData, [`highlight${n}`]: e.target.value })}
              />
            </div>
          ))}

          <h4 style={{ margin: '20px 0 12px', fontSize: '0.95rem', color: '#0f2942' }}>Accreditations</h4>
          {[1, 2, 3].map((n) => (
            <div className="admin-form-group" key={n}>
              <label className="admin-form-label">Accreditation {n}</label>
              <input
                type="text"
                className="admin-form-input"
                value={aboutData[`accreditation${n}`] || ''}
                onChange={(e) => setAboutData({ ...aboutData, [`accreditation${n}`]: e.target.value })}
              />
            </div>
          ))}

          <div className="admin-form-group">
            <label className="admin-form-label">About CTA Button Text</label>
            <input
              type="text"
              className="admin-form-input"
              value={aboutData.ctaText || ''}
              onChange={(e) => setAboutData({ ...aboutData, ctaText: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          TAB: CONTACT
      ════════════════════════════════════════ */}
      {activeTab === 'contact' && (
        <div className="admin-card" style={{ maxWidth: '850px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#0f2942' }}>
            Clinic Location, Operating Hours & Contact
          </h3>

          <div className="admin-form-grid-2">
            <div className="admin-form-group">
              <label className="admin-form-label">Practice Name</label>
              <input
                type="text"
                className="admin-form-input"
                value={contactData.clinicName || ''}
                onChange={(e) => setContactData({ ...contactData, clinicName: e.target.value })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Concierge Phone Number</label>
              <input
                type="tel"
                className="admin-form-input"
                value={contactData.phone || ''}
                onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Concierge Email</label>
              <input
                type="email"
                className="admin-form-input"
                value={contactData.email || ''}
                onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Instagram Handle</label>
              <input
                type="text"
                className="admin-form-input"
                value={contactData.instagram || ''}
                onChange={(e) => setContactData({ ...contactData, instagram: e.target.value })}
              />
            </div>

            <div className="admin-form-group" style={{ gridColumn: 'span 2' }}>
              <label className="admin-form-label">Physical Address <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                className="admin-form-input"
                value={contactData.address || ''}
                onChange={(e) => setContactData({ ...contactData, address: e.target.value })}
              />
            </div>

            <div className="admin-form-group" style={{ gridColumn: 'span 2' }}>
              <label className="admin-form-label">Clinic Hours of Operation</label>
              <input
                type="text"
                className="admin-form-input"
                value={contactData.hours || ''}
                onChange={(e) => setContactData({ ...contactData, hours: e.target.value })}
                placeholder="e.g. Mon–Fri: 9am–7pm | Sat: 9am–5pm | Sun: Closed"
              />
            </div>

            <div className="admin-form-group" style={{ gridColumn: 'span 2' }}>
              <label className="admin-form-label">Contact CTA Button Text</label>
              <input
                type="text"
                className="admin-form-input"
                value={contactData.ctaText || ''}
                onChange={(e) => setContactData({ ...contactData, ctaText: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          TAB: TESTIMONIALS
      ════════════════════════════════════════ */}
      {activeTab === 'testimonials' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f2942' }}>
              Verified Patient Testimonials
              <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>
                ({testimonialsList.filter((t) => t.is_active).length} active / {testimonialsList.length} total)
              </span>
            </h3>
            <AdminButton
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setAddModal(true)}
            >
              Add Testimonial
            </AdminButton>
          </div>

          {testimonialsList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
              <Star size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
              <p>No testimonials yet. Add your first one!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {testimonialsList.map((test) => (
                <div
                  key={test.id}
                  style={{
                    background: '#ffffff',
                    border: `1px solid ${test.is_active ? '#e2e8f0' : '#f1f5f9'}`,
                    borderRadius: '16px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    opacity: test.is_active ? 1 : 0.65,
                    transition: 'opacity 0.2s',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f2942', fontSize: '0.95rem' }}>{test.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{test.role}</div>
                      </div>
                      <div style={{ display: 'flex', color: '#eab308' }}>
                        {Array.from({ length: test.rating || 5 }).map((_, idx) => (
                          <Star key={idx} size={13} fill="#eab308" />
                        ))}
                      </div>
                    </div>

                    {test.treatment && (
                      <div style={{ fontSize: '0.78rem', color: '#1e5aa8', fontWeight: 600, marginBottom: '10px' }}>
                        {test.treatment}
                      </div>
                    )}

                    <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: '#334155', lineHeight: 1.6, fontStyle: 'italic' }}>
                      &ldquo;{test.review}&rdquo;
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f1f5f9', gap: '8px' }}>
                    <button
                      onClick={() => handleToggle(test.id, test.is_active)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                      title={test.is_active ? 'Click to deactivate' : 'Click to activate'}
                    >
                      <AdminBadge status={test.is_active ? 'Active' : 'Inactive'} />
                    </button>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => setEditModal({ ...test })}
                        style={{ background: 'transparent', border: 'none', color: '#1e5aa8', cursor: 'pointer', display: 'flex', padding: '4px' }}
                        title="Edit Testimonial"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(test.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', padding: '4px' }}
                        title="Delete Testimonial"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════ ADD TESTIMONIAL MODAL ════════ */}
      {addModal && (
        <AdminModal
          isOpen={addModal}
          onClose={() => setAddModal(false)}
          title="Add Verified Testimonial"
          maxWidth="520px"
        >
          <form onSubmit={handleAddTestimonial}>
            <div className="admin-form-group">
              <label className="admin-form-label">Client Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                required
                className="admin-form-input"
                placeholder="e.g. Lady Charlotte Montagu"
                value={newTestimonial.name}
                onChange={(e) => setNewTestimonial({ ...newTestimonial, name: e.target.value })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Subtitle / Suite</label>
              <input
                type="text"
                className="admin-form-input"
                placeholder="Verified Patient • Allen Suite"
                value={newTestimonial.role}
                onChange={(e) => setNewTestimonial({ ...newTestimonial, role: e.target.value })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Treatment Protocol Received</label>
              <input
                type="text"
                className="admin-form-input"
                placeholder="Hydrafacial Deluxe & Polynucleotides"
                value={newTestimonial.treatment}
                onChange={(e) => setNewTestimonial({ ...newTestimonial, treatment: e.target.value })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Star Rating</label>
              <select
                className="admin-form-input"
                value={newTestimonial.rating}
                onChange={(e) => setNewTestimonial({ ...newTestimonial, rating: Number(e.target.value) })}
              >
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>{r} Star{r !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Review / Quote <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea
                className="admin-form-textarea"
                rows="4"
                required
                placeholder="Enter client's clinical experience review..."
                value={newTestimonial.review}
                onChange={(e) => setNewTestimonial({ ...newTestimonial, review: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <AdminButton variant="secondary" onClick={() => setAddModal(false)}>
                Cancel
              </AdminButton>
              <AdminButton
                type="submit"
                variant="primary"
                disabled={saving}
                icon={saving ? <Spinner size={14} /> : null}
              >
                {saving ? 'Adding…' : 'Add Testimonial'}
              </AdminButton>
            </div>
          </form>
        </AdminModal>
      )}

      {/* ════════ EDIT TESTIMONIAL MODAL ════════ */}
      {editModal && (
        <AdminModal
          isOpen={Boolean(editModal)}
          onClose={() => setEditModal(null)}
          title="Edit Testimonial"
          maxWidth="520px"
        >
          <form onSubmit={handleUpdateTestimonial}>
            <div className="admin-form-group">
              <label className="admin-form-label">Client Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                required
                className="admin-form-input"
                value={editModal.name}
                onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Subtitle / Suite</label>
              <input
                type="text"
                className="admin-form-input"
                value={editModal.role}
                onChange={(e) => setEditModal({ ...editModal, role: e.target.value })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Treatment Protocol Received</label>
              <input
                type="text"
                className="admin-form-input"
                value={editModal.treatment}
                onChange={(e) => setEditModal({ ...editModal, treatment: e.target.value })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Star Rating</label>
              <select
                className="admin-form-input"
                value={editModal.rating}
                onChange={(e) => setEditModal({ ...editModal, rating: Number(e.target.value) })}
              >
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>{r} Star{r !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Review / Quote <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea
                className="admin-form-textarea"
                rows="4"
                required
                value={editModal.review}
                onChange={(e) => setEditModal({ ...editModal, review: e.target.value })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Display Order</label>
              <input
                type="number"
                className="admin-form-input"
                min="0"
                value={editModal.display_order}
                onChange={(e) => setEditModal({ ...editModal, display_order: Number(e.target.value) })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <AdminButton variant="secondary" onClick={() => setEditModal(null)}>
                Cancel
              </AdminButton>
              <AdminButton
                type="submit"
                variant="primary"
                disabled={saving}
                icon={saving ? <Spinner size={14} /> : null}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </AdminButton>
            </div>
          </form>
        </AdminModal>
      )}

      {/* ════════ DELETE CONFIRM ════════ */}
      {deleteConfirm && (
        <AdminModal
          isOpen={Boolean(deleteConfirm)}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Testimonial"
          maxWidth="420px"
        >
          <p style={{ color: '#475569', marginBottom: '20px', lineHeight: 1.6 }}>
            Are you sure you want to permanently delete this testimonial? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <AdminButton variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="danger"
              onClick={() => handleDelete(deleteConfirm)}
            >
              Delete Permanently
            </AdminButton>
          </div>
        </AdminModal>
      )}
    </div>
  );
};
