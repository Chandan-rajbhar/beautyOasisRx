import React, { useState } from 'react';
import {
  Globe,
  Save,
  Check,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  Clock,
  Star,
  Plus,
  Trash2
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminModal } from '../../components/admin/ui/AdminModal';

export const WebsiteContentPage = () => {
  const { websiteContent, updateWebsiteSection } = useAdminData();

  const [activeTab, setActiveTab] = useState('homepage'); // 'homepage', 'about', 'contact', 'testimonials'
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local editable copies of sections
  const [homepageData, setHomepageData] = useState(websiteContent?.homepage || {});
  const [aboutData, setAboutData] = useState(websiteContent?.about || {});
  const [contactData, setContactData] = useState(websiteContent?.contact || {});
  const [testimonialsList, setTestimonialsList] = useState(websiteContent?.testimonials || []);

  const [newTestimonialModal, setNewTestimonialModal] = useState(false);
  const [newTestimonial, setNewTestimonial] = useState({
    author: '',
    role: 'Verified Patient • Allen Suite',
    rating: 5,
    treatment: 'Bespoke RF Microneedling & Exosomes',
    quote: '',
    active: true
  });

  const handleSaveCurrentSection = () => {
    if (activeTab === 'homepage') {
      updateWebsiteSection('homepage', homepageData);
    } else if (activeTab === 'about') {
      updateWebsiteSection('about', aboutData);
    } else if (activeTab === 'contact') {
      updateWebsiteSection('contact', contactData);
    } else if (activeTab === 'testimonials') {
      updateWebsiteSection('testimonials', testimonialsList);
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleAddTestimonial = (e) => {
    e.preventDefault();
    if (!newTestimonial.author || !newTestimonial.quote) return;
    const item = {
      ...newTestimonial,
      id: `review-${Date.now()}`,
      date: 'Just now',
      verified: true
    };
    const updated = [item, ...testimonialsList];
    setTestimonialsList(updated);
    updateWebsiteSection('testimonials', updated);
    setNewTestimonialModal(false);
    setNewTestimonial({
      author: '',
      role: 'Verified Patient • Allen Suite',
      rating: 5,
      treatment: 'Bespoke RF Microneedling & Exosomes',
      quote: '',
      active: true
    });
  };

  const handleToggleTestimonial = (id) => {
    const updated = testimonialsList.map(t =>
      t.id === id ? { ...t, active: !t.active } : t
    );
    setTestimonialsList(updated);
    updateWebsiteSection('testimonials', updated);
  };

  const handleDeleteTestimonial = (id) => {
    const updated = testimonialsList.filter(t => t.id !== id);
    setTestimonialsList(updated);
    updateWebsiteSection('testimonials', updated);
  };

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Website Content Management (CMS)</h1>
          <p>Dynamically update public website headlines, clinic hours, contact coordinates, and client reviews.</p>
        </div>

        <div className="admin-page-actions">
          <AdminButton
            variant="primary"
            onClick={handleSaveCurrentSection}
            icon={saveSuccess ? <Check size={16} /> : <Save size={16} />}
          >
            {saveSuccess ? 'Changes Saved to Website!' : 'Publish Website Updates'}
          </AdminButton>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'homepage', label: 'Homepage Hero & Taglines' },
          { id: 'about', label: 'About Clinic & Accreditations' },
          { id: 'contact', label: 'Contact Coordinates & Hours' },
          { id: 'testimonials', label: 'Patient Testimonials & Reviews' }
        ].map((tab) => (
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
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Homepage */}
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
            <label className="admin-form-label">Hero Headline</label>
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

      {/* Tab: About */}
      {activeTab === 'about' && (
        <div className="admin-card" style={{ maxWidth: '850px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#0f2942' }}>
            About BeautyOasisRx Clinical Foundation
          </h3>

          <div className="admin-form-group">
            <label className="admin-form-label">Section Heading</label>
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
        </div>
      )}

      {/* Tab: Contact */}
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
                type="text"
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
              <label className="admin-form-label">Allen, TX Physical Address</label>
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
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab: Testimonials */}
      {activeTab === 'testimonials' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f2942' }}>
              Verified Patient Testimonials
            </h3>
            <AdminButton
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setNewTestimonialModal(true)}
            >
              Add Testimonial
            </AdminButton>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {testimonialsList.map((test) => (
              <div
                key={test.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f2942', fontSize: '0.95rem' }}>
                        {test.author}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{test.role}</div>
                    </div>
                    <div style={{ display: 'flex', color: '#eab308' }}>
                      {Array.from({ length: test.rating || 5 }).map((_, idx) => (
                        <Star key={idx} size={14} fill="#eab308" />
                      ))}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#1e5aa8', fontWeight: 600, marginBottom: '10px' }}>
                    {test.treatment}
                  </div>

                  <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: '#334155', lineHeight: 1.6, fontStyle: 'italic' }}>
                    "{test.quote}"
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    onClick={() => handleToggleTestimonial(test.id)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <AdminBadge status={test.active ? 'Active' : 'Inactive'} />
                  </button>

                  <button
                    onClick={() => handleDeleteTestimonial(test.id)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }}
                    title="Delete Testimonial"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Testimonial Modal */}
      {newTestimonialModal && (
        <AdminModal
          isOpen={newTestimonialModal}
          onClose={() => setNewTestimonialModal(false)}
          title="Add Verified Testimonial"
          maxWidth="500px"
        >
          <form onSubmit={handleAddTestimonial}>
            <div className="admin-form-group">
              <label className="admin-form-label">Client Name & Title</label>
              <input
                type="text"
                required
                className="admin-form-input"
                placeholder="e.g. Lady Charlotte Montagu"
                value={newTestimonial.author}
                onChange={(e) => setNewTestimonial({ ...newTestimonial, author: e.target.value })}
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
              <label className="admin-form-label">Review / Quote</label>
              <textarea
                className="admin-form-textarea"
                rows="4"
                required
                placeholder="Enter client's clinical experience review..."
                value={newTestimonial.quote}
                onChange={(e) => setNewTestimonial({ ...newTestimonial, quote: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <AdminButton variant="secondary" onClick={() => setNewTestimonialModal(false)}>
                Cancel
              </AdminButton>
              <AdminButton type="submit" variant="primary">
                Add Testimonial
              </AdminButton>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
};
