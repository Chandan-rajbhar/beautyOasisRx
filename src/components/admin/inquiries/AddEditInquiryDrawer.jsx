import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  RefreshCw,
  Save,
  X,
  Hash,
  User,
  Mail,
  Phone,
  Tag,
  Calendar,
  FileText,
  AlertCircle,
  Search,
  Check,
  CheckCircle2,
  ChevronDown,
  UserCheck,
  Users,
  UserPlus,
  Sparkles
} from 'lucide-react';
import { AdminDrawer } from '../ui/AdminDrawer';
import { AdminButton } from '../ui/AdminButton';
import { ShadcnSelect } from '../../ui/select';
import { generateTicketId } from '../../../services/inquiryService';
import { supabase } from '../../../lib/supabaseClient';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: 'New', label: 'New' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Waiting for Response', label: 'Waiting for Response' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Closed', label: 'Closed' }
];

const PRIORITY_OPTIONS = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'Urgent', label: 'Urgent' }
];

const AVATAR_BG_COLORS = ['#1e5aa8', '#0d9488', '#7c3aed', '#c026d3', '#ea580c', '#0284c7', '#16a34a'];
const getAvatarColor = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
};

const getInitials = (name = '') => {
  if (!name) return 'PT';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const AddEditInquiryDrawer = ({
  isOpen,
  onClose,
  onSave,
  inquiry = null, // null for Add, object for Edit
  existingInquiries = [],
  initialPatients = []
}) => {
  const isEditing = Boolean(inquiry && inquiry.id);

  // Form state
  const [formData, setFormData] = useState({
    ticket_id: '',
    name: '',
    email: '',
    contact_number: '',
    subject: '',
    message: '',
    status: 'New',
    priority: 'Medium',
    received_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Supabase Patients Integration State
  const [patients, setPatients] = useState(() => (Array.isArray(initialPatients) ? initialPatients : []));
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [senderMode, setSenderMode] = useState('patient'); // 'patient' | 'custom'
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);

  const patientDropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(e.target)) {
        setIsPatientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch all patients dynamically from Supabase
  useEffect(() => {
    let isMounted = true;
    async function fetchPatients() {
      if (!isOpen) return;
      setLoadingPatients(true);
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id, name, full_name, email, phone, contact_number, profile_photo_url, avatar, status')
          .order('name', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          const list = data.map((p) => ({
            id: p.id,
            name: p.name || p.full_name || 'Patient',
            email: p.email || '',
            phone: p.phone || p.contact_number || '',
            avatar: p.profile_photo_url || p.avatar || null,
            status: p.status || 'Active'
          }));
          if (isMounted) setPatients(list);
        } else if (Array.isArray(initialPatients) && initialPatients.length > 0 && isMounted) {
          setPatients(initialPatients);
        }
      } catch (err) {
        console.warn('Patients fetch notice in AddEditInquiryDrawer:', err);
        if (Array.isArray(initialPatients) && initialPatients.length > 0 && isMounted) {
          setPatients(initialPatients);
        }
      } finally {
        if (isMounted) setLoadingPatients(false);
      }
    }

    fetchPatients();
    return () => {
      isMounted = false;
    };
  }, [isOpen, initialPatients]);

  // Initialize form state when drawer opens or inquiry changes
  useEffect(() => {
    if (isOpen) {
      setFormError('');
      setPatientSearch('');
      setIsPatientDropdownOpen(false);

      if (inquiry) {
        const matched = patients.find(
          (p) =>
            (p.name && inquiry.name && p.name.toLowerCase() === inquiry.name.toLowerCase()) ||
            (p.email && inquiry.email && p.email.toLowerCase() === inquiry.email.toLowerCase())
        );

        if (matched) {
          setSelectedPatientId(matched.id);
          setSenderMode('patient');
        } else {
          setSelectedPatientId(null);
          setSenderMode('custom');
        }

        setFormData({
          ticket_id: inquiry.ticket_id || inquiry.ticketId || generateTicketId(existingInquiries),
          name: inquiry.name || '',
          email: inquiry.email || '',
          contact_number: inquiry.contact_number || inquiry.phone || '',
          subject: inquiry.subject || '',
          message: inquiry.message || '',
          status: inquiry.status || 'New',
          priority: inquiry.priority || 'Medium',
          received_date: inquiry.received_at
            ? inquiry.received_at.split('T')[0]
            : inquiry.date
              ? inquiry.date.split(' ')[0]
              : new Date().toISOString().split('T')[0],
          notes: inquiry.notes || ''
        });
      } else {
        setSelectedPatientId(null);
        setSenderMode('patient');
        setFormData({
          ticket_id: generateTicketId(existingInquiries),
          name: '',
          email: '',
          contact_number: '',
          subject: '',
          message: '',
          status: 'New',
          priority: 'Medium',
          received_date: new Date().toISOString().split('T')[0],
          notes: ''
        });
      }
    }
  }, [isOpen, inquiry, existingInquiries, patients]);

  // Currently selected patient object
  const selectedPatient = useMemo(() => {
    if (!selectedPatientId) return null;
    return patients.find((p) => p.id === selectedPatientId) || null;
  }, [selectedPatientId, patients]);

  // Filtered patients for dropdown search
  const filteredPatients = useMemo(() => {
    const q = patientSearch.toLowerCase().trim();
    if (!q) return patients;
    return patients.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [patients, patientSearch]);

  // Quick matching suggestion when typing in custom mode
  const matchingPatientSuggestion = useMemo(() => {
    if (senderMode !== 'custom' || !formData.name || formData.name.trim().length < 2) return null;
    const nameLower = formData.name.toLowerCase().trim();
    return (
      patients.find((p) => (p.name || '').toLowerCase().includes(nameLower) && p.id !== selectedPatientId) || null
    );
  }, [senderMode, formData.name, patients, selectedPatientId]);

  // Handle selecting an existing patient
  const handleSelectPatient = (patient) => {
    setSelectedPatientId(patient.id);
    setFormData((prev) => ({
      ...prev,
      name: patient.name,
      email: patient.email || prev.email,
      contact_number: patient.phone || prev.contact_number
    }));
    setIsPatientDropdownOpen(false);
    setPatientSearch('');
    setFormError('');
  };

  // Handle clearing linked patient
  const handleClearSelectedPatient = () => {
    setSelectedPatientId(null);
    setPatientSearch('');
  };

  // Switch to custom mode
  const handleSwitchToCustom = () => {
    setSenderMode('custom');
    setIsPatientDropdownOpen(false);
  };

  // Switch to patient mode
  const handleSwitchToPatient = () => {
    setSenderMode('patient');
    if (formData.name && !selectedPatientId) {
      const matched = patients.find(
        (p) => (p.name || '').toLowerCase() === formData.name.toLowerCase()
      );
      if (matched) {
        setSelectedPatientId(matched.id);
      }
    }
  };

  const handleRegenerateTicketId = () => {
    if (!isEditing) {
      setFormData((prev) => ({
        ...prev,
        ticket_id: generateTicketId(existingInquiries)
      }));
    }
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Form Validation
    if (!formData.name.trim()) {
      setFormError('Please select an existing patient or provide the sender name.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      setFormError('Please enter a valid prospect email address (e.g. name@example.com).');
      return;
    }
    if (!formData.subject.trim()) {
      setFormError('Please provide an inquiry subject.');
      return;
    }
    if (!formData.message.trim()) {
      setFormError('Please enter the inquiry message or consultation request.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ticket_id: formData.ticket_id,
        name: formData.name.trim(),
        email: formData.email.trim(),
        contact_number: formData.contact_number.trim(),
        phone: formData.contact_number.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        status: formData.status,
        priority: formData.priority,
        received_at: new Date(formData.received_date).toISOString(),
        date: new Date(formData.received_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        notes: formData.notes.trim()
      };

      await onSave(payload, inquiry?.id);
      toast.success(isEditing ? 'Inquiry updated successfully!' : 'Inquiry registered successfully!');
      onClose();
    } catch (err) {
      console.error('Error saving inquiry:', err);
      setFormError(err.message || 'Failed to save inquiry. Please check connection.');
      toast.error('Failed to save inquiry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Inquiry' : 'Add New Inquiry'}
      subtitle={
        isEditing
          ? `Modifying Ticket #${formData.ticket_id}`
          : 'Register a consultation inquiry with Supabase patient integration'
      }
      width="620px"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', width: '100%' }}>
          <AdminButton variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </AdminButton>
          <AdminButton
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            icon={isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          >
            {isSubmitting ? 'Saving to Supabase...' : isEditing ? 'Update Inquiry' : 'Save Inquiry'}
          </AdminButton>
        </div>
      }
    >
      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
      >
        {/* Hidden autofill traps to prevent browser heuristic address/contact popups */}
        <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
          <input type="text" name="prevent_autofill_user" tabIndex={-1} autoComplete="off" />
          <input type="password" name="prevent_autofill_pwd" tabIndex={-1} autoComplete="off" />
        </div>

        {formError && (
          <div
            style={{
              padding: '12px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#b91c1c',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={16} flexShrink={0} />
            <span>{formError}</span>
          </div>
        )}

        {/* ── CARD 1: TICKET IDENTIFIER ── */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Hash size={13} color="#1e5aa8" />
              <span>Ticket ID (Auto-Generated)</span>
            </div>
            <div style={{ marginTop: '4px', fontFamily: 'monospace', fontSize: '0.98rem', fontWeight: 700, color: '#1e5aa8' }}>
              #{formData.ticket_id}
            </div>
          </div>

          {!isEditing && (
            <button
              type="button"
              onClick={handleRegenerateTicketId}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#1e5aa8',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.background = '#eff6ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#ffffff'; }}
            >
              <RefreshCw size={12} /> Regenerate ID
            </button>
          )}
        </div>

        {/* ── CARD 2: SENDER / PATIENT INTEGRATION ── */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          {/* Section Header with Segmented Mode Pill */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <div>
              <label className="admin-form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem' }}>
                <User size={15} color="#1e5aa8" />
                <span>Sender / Patient Name <span style={{ color: '#dc2626' }}>*</span></span>
              </label>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                Select an existing Supabase patient or register a new prospect inquiry
              </p>
            </div>

            {/* Segmented Mode Toggle */}
            <div
              style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}
            >
              <button
                type="button"
                onClick={handleSwitchToPatient}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: senderMode === 'patient' ? '#ffffff' : 'transparent',
                  color: senderMode === 'patient' ? '#1e5aa8' : '#64748b',
                  boxShadow: senderMode === 'patient' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Users size={13} />
                <span>Existing Patient ({patients.length})</span>
              </button>

              <button
                type="button"
                onClick={handleSwitchToCustom}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: senderMode === 'custom' ? '#ffffff' : 'transparent',
                  color: senderMode === 'custom' ? '#1e5aa8' : '#64748b',
                  boxShadow: senderMode === 'custom' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <UserPlus size={13} />
                <span>New Prospect</span>
              </button>
            </div>
          </div>

          {/* SENDER MODE 1: EXISTING SUPABASE PATIENT */}
          {senderMode === 'patient' ? (
            <div>
              {selectedPatient ? (
                /* Selected Patient Summary Card */
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {selectedPatient.avatar ? (
                      <img
                        src={selectedPatient.avatar}
                        alt={selectedPatient.name}
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #ffffff',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: getAvatarColor(selectedPatient.name),
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.92rem',
                          border: '2px solid #ffffff',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                      >
                        {getInitials(selectedPatient.name)}
                      </div>
                    )}

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#0f2942', fontSize: '0.94rem' }}>
                          {selectedPatient.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            background: '#dcfce7',
                            color: '#15803d',
                            borderRadius: '4px',
                            letterSpacing: '0.02em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <CheckCircle2 size={11} /> Supabase Patient
                        </span>
                      </div>

                      <div style={{ marginTop: '3px', fontSize: '0.78rem', color: '#475569', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {selectedPatient.email && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={12} color="#1e5aa8" /> {selectedPatient.email}
                          </span>
                        )}
                        {selectedPatient.phone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={12} color="#1e5aa8" /> {selectedPatient.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setIsPatientDropdownOpen(true)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        color: '#1e5aa8',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSelectedPatient}
                      title="Clear patient selection"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                /* Patient Search Selector Combobox */
                <div style={{ position: 'relative' }} ref={patientDropdownRef}>
                  <div
                    onClick={() => setIsPatientDropdownOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      gap: '8px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      transition: 'border-color 0.15s ease'
                    }}
                  >
                    <Search size={16} color="#64748b" flexShrink={0} />
                    <input
                      type="text"
                      autoComplete="one-time-code"
                      spellCheck={false}
                      data-lpignore="true"
                      data-form-type="other"
                      readOnly
                      onFocus={(e) => { e.target.readOnly = false; }}
                      placeholder="Click to select or search Supabase patients (e.g. Johnson, Emily, Jessica)..."
                      value={patientSearch}
                      onChange={(e) => {
                        setPatientSearch(e.target.value);
                        setIsPatientDropdownOpen(true);
                      }}
                      onFocusCapture={() => setIsPatientDropdownOpen(true)}
                      style={{
                        border: 'none',
                        outline: 'none',
                        width: '100%',
                        fontSize: '0.86rem',
                        color: '#0f2942',
                        background: 'transparent'
                      }}
                    />
                    <ChevronDown size={16} color="#94a3b8" flexShrink={0} />
                  </div>

                  {/* Patients Dropdown List */}
                  {isPatientDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        boxShadow: '0 12px 28px -4px rgba(15, 41, 66, 0.16), 0 4px 10px rgba(15, 41, 66, 0.05)',
                        zIndex: 100010,
                        maxHeight: '260px',
                        overflowY: 'auto',
                        padding: '6px'
                      }}
                    >
                      <div
                        style={{
                          padding: '6px 10px 8px',
                          fontSize: '0.72rem',
                          color: '#64748b',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>Patients in Supabase Database ({filteredPatients.length})</span>
                        <button
                          type="button"
                          onClick={() => setIsPatientDropdownOpen(false)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {loadingPatients ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                          Loading patients from Supabase...
                        </div>
                      ) : filteredPatients.length > 0 ? (
                        filteredPatients.map((pt) => (
                          <div
                            key={pt.id}
                            onClick={() => handleSelectPatient(pt)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              transition: 'background-color 0.12s ease',
                              gap: '10px'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {pt.avatar ? (
                                <img
                                  src={pt.avatar}
                                  alt={pt.name}
                                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: getAvatarColor(pt.name),
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '0.78rem'
                                  }}
                                >
                                  {getInitials(pt.name)}
                                </div>
                              )}

                              <div>
                                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0f2942' }}>
                                  {pt.name}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', gap: '8px' }}>
                                  {pt.email && <span>{pt.email}</span>}
                                  {pt.phone && <span>• {pt.phone}</span>}
                                </div>
                              </div>
                            </div>

                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: '#1e5aa8',
                                fontWeight: 600,
                                background: '#eff6ff',
                                padding: '2px 8px',
                                borderRadius: '4px'
                              }}
                            >
                              Select
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '14px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                          No patients matched "{patientSearch}".
                          <div style={{ marginTop: '6px' }}>
                            <button
                              type="button"
                              onClick={handleSwitchToCustom}
                              style={{
                                color: '#1e5aa8',
                                fontWeight: 600,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.78rem'
                              }}
                            >
                              + Enter as New Prospect instead
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* SENDER MODE 2: CUSTOM PROSPECT INPUT */
            <div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  name="inquiry_sender_full_name"
                  id="inquiry_sender_full_name"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  readOnly
                  onFocus={(e) => { e.target.readOnly = false; }}
                  className="admin-form-input"
                  placeholder="e.g. Genevieve St. Claire"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {/* Matching Supabase Patient Suggestion Banner */}
              {matchingPatientSuggestion && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem',
                    color: '#1e40af',
                    gap: '10px'
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Sparkles size={13} color="#2563eb" />
                    <span>
                      Matching patient in Supabase: <strong>{matchingPatientSuggestion.name}</strong> ({matchingPatientSuggestion.email})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectPatient(matchingPatientSuggestion)}
                    style={{
                      background: '#1e5aa8',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Auto-Fill
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CARD 3: CONTACT COORDINATES (2-COLUMN GRID) ── */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', fontWeight: 700, marginBottom: '12px' }}>
            Contact Coordinates
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            {/* Email Address */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={14} color="#64748b" />
                  <span>Email Address <span style={{ color: '#dc2626' }}>*</span></span>
                </span>
              </label>
              <input
                type="text"
                inputMode="email"
                name="inquiry_prospect_contact_email"
                id="inquiry_prospect_contact_email"
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                readOnly
                onFocus={(e) => { e.target.readOnly = false; }}
                className="admin-form-input"
                placeholder="prospect@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            {/* Contact Number */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={14} color="#64748b" />
                  <span>Contact Number</span>
                </span>
              </label>
              <input
                type="tel"
                name="inquiry_contact_phone_number"
                id="inquiry_contact_phone_number"
                autoComplete="one-time-code"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                readOnly
                onFocus={(e) => { e.target.readOnly = false; }}
                className="admin-form-input"
                placeholder="(214) 492-8812"
                value={formData.contact_number}
                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* ── CARD 4: CLASSIFICATION & SCHEDULE ── */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', fontWeight: 700, marginBottom: '12px' }}>
            Status & Priority
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            {/* Status */}
            <div className="admin-form-group">
              <label className="admin-form-label">Status</label>
              <ShadcnSelect
                value={formData.status}
                onChange={(val) => setFormData({ ...formData, status: val })}
                options={STATUS_OPTIONS}
              />
            </div>

            {/* Priority */}
            <div className="admin-form-group">
              <label className="admin-form-label">Priority</label>
              <ShadcnSelect
                value={formData.priority}
                onChange={(val) => setFormData({ ...formData, priority: val })}
                options={PRIORITY_OPTIONS}
              />
            </div>
          </div>

          {/* Received Date */}
          <div className="admin-form-group" style={{ marginTop: '14px' }}>
            <label className="admin-form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} color="#64748b" />
                <span>Received Date</span>
              </span>
            </label>
            <input
              type="date"
              className="admin-form-input"
              value={formData.received_date}
              onChange={(e) => setFormData({ ...formData, received_date: e.target.value })}
            />
          </div>
        </div>

        {/* ── CARD 5: INQUIRY DETAILS ── */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', fontWeight: 700, marginBottom: '12px' }}>
            Inquiry Message
          </div>

          {/* Subject */}
          <div className="admin-form-group">
            <label className="admin-form-label">
              <span>Subject <span style={{ color: '#dc2626' }}>*</span></span>
            </label>
            <input
              type="text"
              name="inquiry_consultation_subject"
              id="inquiry_consultation_subject"
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
              className="admin-form-input"
              placeholder="e.g. Inquiry regarding Inclusive Sensory Suite treatment"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
            />
          </div>

          {/* Inquiry / Message */}
          <div className="admin-form-group" style={{ marginTop: '14px' }}>
            <label className="admin-form-label">
              <span>Inquiry / Message <span style={{ color: '#dc2626' }}>*</span></span>
            </label>
            <textarea
              className="admin-form-textarea"
              rows={4}
              placeholder="Detailed consultation request or prospect message..."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              required
            />
          </div>
        </div>

        {/* ── CARD 6: INTERNAL CLINICAL NOTES ── */}
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            borderRadius: '12px',
            padding: '16px 18px'
          }}
        >
          <div className="admin-form-group">
            <label className="admin-form-label" style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} color="#b45309" />
              <span>Internal Clinical Staff Notes</span>
            </label>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.72rem', color: '#b45309' }}>
              Confidential internal notes visible only to BeautyOasisRx clinical staff.
            </p>
            <textarea
              className="admin-form-textarea"
              rows={3}
              placeholder="Add internal patient notes, preliminary assessment, or triage notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              style={{ background: '#ffffff', borderColor: '#fde68a' }}
            />
          </div>
        </div>
      </form>
    </AdminDrawer>
  );
};

export default AddEditInquiryDrawer;
