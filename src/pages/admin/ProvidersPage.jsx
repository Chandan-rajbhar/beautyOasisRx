import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Eye,
  Edit2,
  Trash2,
  MoreVertical,
  Upload,
  X,
  Mail,
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  User
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';
import { ShadcnSelect } from '../../components/ui/select';

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const TIME_OPTIONS = [
  { value: '06:00', label: '06:00 AM' },
  { value: '06:30', label: '06:30 AM' },
  { value: '07:00', label: '07:00 AM' },
  { value: '07:30', label: '07:30 AM' },
  { value: '08:00', label: '08:00 AM' },
  { value: '08:30', label: '08:30 AM' },
  { value: '09:00', label: '09:00 AM' },
  { value: '09:30', label: '09:30 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '10:30', label: '10:30 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '11:30', label: '11:30 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '12:30', label: '12:30 PM' },
  { value: '13:00', label: '01:00 PM' },
  { value: '13:30', label: '01:30 PM' },
  { value: '14:00', label: '02:00 PM' },
  { value: '14:30', label: '02:30 PM' },
  { value: '15:00', label: '03:00 PM' },
  { value: '15:30', label: '03:30 PM' },
  { value: '16:00', label: '04:00 PM' },
  { value: '16:30', label: '04:30 PM' },
  { value: '17:00', label: '05:00 PM' },
  { value: '17:30', label: '05:30 PM' },
  { value: '18:00', label: '06:00 PM' },
  { value: '18:30', label: '06:30 PM' },
  { value: '19:00', label: '07:00 PM' },
  { value: '19:30', label: '07:30 PM' },
  { value: '20:00', label: '08:00 PM' },
  { value: '20:30', label: '08:30 PM' },
  { value: '21:00', label: '09:00 PM' },
  { value: '21:30', label: '09:30 PM' },
  { value: '22:00', label: '10:00 PM' }
];

export const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

export const parseDaySchedule = (val) => {
  if (!val || val === 'Off' || val === 'off' || val === 'OFF') {
    return { isOff: true, start: '09:00', end: '17:00' };
  }
  const parts = String(val).split('-').map(s => s.trim());
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { isOff: false, start: parts[0], end: parts[1] };
  }
  return { isOff: false, start: '09:00', end: '17:00' };
};

export const formatTimeLabel = (timeStr) => {
  const opt = TIME_OPTIONS.find(o => o.value === timeStr);
  return opt ? opt.label : timeStr;
};

const DEFAULT_SCHEDULE = {
  Monday: '09:00 - 17:00',
  Tuesday: '09:00 - 17:00',
  Wednesday: '09:00 - 17:00',
  Thursday: '09:00 - 17:00',
  Friday: '09:00 - 15:00',
  Saturday: 'Off',
  Sunday: 'Off'
};

const DEFAULT_FORM = {
  clinician_name: '',
  clinical_title: '',
  specialization: '',
  email: '',
  phone: '',
  practice_status: 'Active',
  profile_image_url: '',
  biography: '',
  availability_schedule: { ...DEFAULT_SCHEDULE }
};

const saveCliniciansToCache = (list) => {
  try {
    localStorage.setItem('bo_clinicians_cache', JSON.stringify(list));
    // Keep supabaseDataService cache in sync so other parts of the app stay consistent
    localStorage.setItem('bo_cache_clinicians', JSON.stringify(list));
  } catch (_) { }
};

const purgeAllClinicianCacheKeys = () => {
  try {
    localStorage.removeItem('bo_clinicians_cache');
    localStorage.removeItem('bo_cache_clinicians');
    localStorage.removeItem('beautyoasis_admin_providers');
    localStorage.removeItem('bo_cache_providers');
  } catch (_) { }
};

export const ProvidersPage = () => {
  // Database records & fetch states
  const [clinicians, setClinicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Drawer & Modal states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingClinician, setEditingClinician] = useState(null);
  const [selectedClinician, setSelectedClinician] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Clinician Actions Dropdown Menu State & Viewport Anti-Clip Positioning ──
  const [actionMenuClinicianId, setActionMenuClinicianId] = useState(null);
  const [actionMenuPosition, setActionMenuPosition] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.clinician-action-menu-container') && !e.target.closest('.clinician-action-dropdown-menu')) {
        setActionMenuClinicianId(null);
        setActionMenuPosition(null);
      }
    };
    const handleWindowChange = () => {
      if (actionMenuClinicianId) {
        setActionMenuClinicianId(null);
        setActionMenuPosition(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && actionMenuClinicianId) {
        setActionMenuClinicianId(null);
        setActionMenuPosition(null);
      }
    };
    if (actionMenuClinicianId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', handleWindowChange, true);
      window.addEventListener('resize', handleWindowChange);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleWindowChange, true);
      window.removeEventListener('resize', handleWindowChange);
    };
  }, [actionMenuClinicianId]);

  // Form State
  const [formData, setFormData] = useState({ ...DEFAULT_FORM });
  const [formErrors, setFormErrors] = useState({});

  // Image Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const fileInputRef = useRef(null);

  // Copied indicator for view drawer
  const [copiedField, setCopiedField] = useState(null);

  // ─────────────────────────────────────────────────────────────
  // 1. DATA NORMALIZER
  // ─────────────────────────────────────────────────────────────
  const normalizeClinician = useCallback((row) => {
    let sched = row.availability_schedule || row.availability;
    if (typeof sched === 'string') {
      try {
        sched = JSON.parse(sched);
      } catch {
        sched = { ...DEFAULT_SCHEDULE };
      }
    }
    if (!sched || typeof sched !== 'object') {
      sched = { ...DEFAULT_SCHEDULE };
    }

    return {
      id: row.id,
      clinician_name: row.clinician_name || row.name || 'Unnamed Clinician',
      clinical_title: row.clinical_title || row.role || 'Clinical Practitioner',
      specialization: row.specialization || 'Aesthetic Medicine',
      email: row.email || '',
      phone: row.phone || '',
      practice_status: row.practice_status === 'Inactive' || row.status === 'Inactive' ? 'Inactive' : 'Active',
      profile_image_url: row.profile_image_url || row.avatar || '',
      biography: row.biography || row.bio || '',
      availability_schedule: sched,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString()
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 2. FETCH CLINICIANS DIRECTLY FROM SUPABASE (NO STATIC DATA)
  // ─────────────────────────────────────────────────────────────
  const fetchClinicians = useCallback(async () => {
    setLoading(true);
    setError(null);

    let rawData = null;
    let caughtErr = null;

    // 1. Primary: query clinicians table via standard client
    try {
      const res = await supabase
        .from('clinicians')
        .select('*')
        .order('created_at', { ascending: false });

      if (!res.error && res.data) {
        rawData = res.data;
      } else {
        const retryRes = await supabase.from('clinicians').select('*');
        if (!retryRes.error && retryRes.data) {
          rawData = retryRes.data;
        } else {
          caughtErr = res?.error || retryRes?.error;
        }
      }
    } catch (e) {
      caughtErr = e;
    }

    // 2. Secondary fallback: query via isolated supabaseAdmin client (unauthenticated / anon)
    if (rawData === null) {
      try {
        const adminRes = await supabaseAdmin
          .from('clinicians')
          .select('*')
          .order('created_at', { ascending: false });

        if (!adminRes.error && adminRes.data) {
          rawData = adminRes.data;
          caughtErr = null;
        } else {
          const plainAdminRes = await supabaseAdmin.from('clinicians').select('*');
          if (!plainAdminRes.error && plainAdminRes.data) {
            rawData = plainAdminRes.data;
            caughtErr = null;
          } else {
            caughtErr = adminRes?.error || plainAdminRes?.error;
          }
        }
      } catch (adminErr) {
        caughtErr = caughtErr || adminErr;
      }
    }

    if (rawData !== null) {
      purgeAllClinicianCacheKeys();
      const normalized = rawData.map(normalizeClinician);
      setClinicians(normalized);
      saveCliniciansToCache(normalized);
      setError(null);
    } else {
      setClinicians([]);
      const errMsg = caughtErr?.message || 'Network error. Please check your connection and retry.';
      setError(`Failed to load clinicians: ${errMsg}`);
    }

    setLoading(false);
  }, [normalizeClinician]);

  useEffect(() => {
    fetchClinicians();
  }, [fetchClinicians]);

  // ─────────────────────────────────────────────────────────────
  // 3. STORAGE HELPER: UPLOAD PROFILE IMAGE TO SUPABASE STORAGE
  // ─────────────────────────────────────────────────────────────
  const uploadProfileImage = async (file) => {
    if (!file) return null;
    const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
    const fileName = `clinician_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    // 1. Try candidate buckets with supabase & supabaseAdmin
    const candidateBuckets = ['clinician-avatars', 'avatars', 'patient-photos'];
    for (const b of candidateBuckets) {
      try {
        const { data: upData, error: upErr } = await supabase.storage
          .from(b)
          .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (!upErr && upData) {
          const { data: pubData } = supabase.storage.from(b).getPublicUrl(filePath);
          if (pubData?.publicUrl) return pubData.publicUrl;
        }
      } catch (_) { }

      try {
        const { data: upData, error: upErr } = await supabaseAdmin.storage
          .from(b)
          .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (!upErr && upData) {
          const { data: pubData } = supabaseAdmin.storage.from(b).getPublicUrl(filePath);
          if (pubData?.publicUrl) return pubData.publicUrl;
        }
      } catch (_) { }
    }

    // 2. High-performance resized base64 thumbnail fallback so upload never blocks registration
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 200;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } catch (_) {
          resolve(reader.result);
        }
      };
      img.onerror = () => resolve(null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  // ─────────────────────────────────────────────────────────────
  // 4. IMAGE SELECTION & REMOVAL HANDLERS
  // ─────────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      const msg = 'Invalid file type. Please upload a JPG, PNG, or WEBP image.';
      setPhotoError(msg);
      toast.error(msg);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      const msg = 'File size exceeds 5MB limit.';
      setPhotoError(msg);
      toast.error(msg);
      return;
    }

    setPhotoError(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setPreviewImageUrl(uploadEvent.target.result);
    };
    reader.readAsDataURL(file);
    toast.success('Profile photo selected.');
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPreviewImageUrl(null);
    setFormData(prev => ({ ...prev, profile_image_url: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast('Profile photo cleared.', { icon: '🗑️' });
  };

  // ─────────────────────────────────────────────────────────────
  // 5. OPEN ADD / EDIT DRAWERS
  // ─────────────────────────────────────────────────────────────
  const handleOpenAddDrawer = () => {
    setEditingClinician(null);
    setFormData({ ...DEFAULT_FORM, availability_schedule: { ...DEFAULT_SCHEDULE } });
    setSelectedFile(null);
    setPreviewImageUrl(null);
    setPhotoError(null);
    setFormErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (clinician) => {
    setEditingClinician(clinician);
    setFormData({
      clinician_name: clinician.clinician_name,
      clinical_title: clinician.clinical_title,
      specialization: clinician.specialization,
      email: clinician.email,
      phone: clinician.phone,
      practice_status: clinician.practice_status,
      profile_image_url: clinician.profile_image_url || '',
      biography: clinician.biography || '',
      availability_schedule: { ...DEFAULT_SCHEDULE, ...clinician.availability_schedule }
    });
    setSelectedFile(null);
    setPreviewImageUrl(clinician.profile_image_url || null);
    setPhotoError(null);
    setFormErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsDrawerOpen(true);
  };

  // ─────────────────────────────────────────────────────────────
  // 5b. SCHEDULE HANDLERS (SHADCN TIME PICKERS + SET HOURS / SET OFF)
  // ─────────────────────────────────────────────────────────────
  const handleSetOff = (day) => {
    setFormData(prev => ({
      ...prev,
      availability_schedule: {
        ...prev.availability_schedule,
        [day]: 'Off'
      }
    }));
    // Clear validation error for this day if any
    setFormErrors(prev => {
      if (!prev.schedule?.[day]) return prev;
      const nextSched = { ...prev.schedule };
      delete nextSched[day];
      return { ...prev, schedule: nextSched };
    });
  };

  const handleSetHours = (day) => {
    const current = formData.availability_schedule?.[day];
    const { start, end } = parseDaySchedule(current);
    setFormData(prev => ({
      ...prev,
      availability_schedule: {
        ...prev.availability_schedule,
        [day]: `${start} - ${end}`
      }
    }));
  };

  const handleTimeChange = (day, type, value) => {
    const current = formData.availability_schedule?.[day];
    const parsed = parseDaySchedule(current);
    const nextStart = type === 'start' ? value : parsed.start;
    const nextEnd = type === 'end' ? value : parsed.end;

    setFormData(prev => ({
      ...prev,
      availability_schedule: {
        ...prev.availability_schedule,
        [day]: `${nextStart} - ${nextEnd}`
      }
    }));

    // Real-time validation: end time must be later than start time
    if (timeToMinutes(nextEnd) <= timeToMinutes(nextStart)) {
      setFormErrors(prev => ({
        ...prev,
        schedule: {
          ...(prev.schedule || {}),
          [day]: `End time (${formatTimeLabel(nextEnd)}) must be later than start time (${formatTimeLabel(nextStart)}).`
        }
      }));
    } else {
      setFormErrors(prev => {
        if (!prev.schedule?.[day]) return prev;
        const nextSched = { ...prev.schedule };
        delete nextSched[day];
        return { ...prev, schedule: nextSched };
      });
    }
  };

  const handleApplyWeekdayPreset = () => {
    setFormData(prev => ({
      ...prev,
      availability_schedule: {
        Monday: '09:00 - 17:00',
        Tuesday: '09:00 - 17:00',
        Wednesday: '09:00 - 17:00',
        Thursday: '09:00 - 17:00',
        Friday: '09:00 - 17:00',
        Saturday: 'Off',
        Sunday: 'Off'
      }
    }));
    setFormErrors(prev => ({ ...prev, schedule: {} }));
    toast.success('Applied Standard Hours (9:00 AM – 5:00 PM) to Weekdays.');
  };

  // ─────────────────────────────────────────────────────────────
  // 6. VALIDATION & DUPLICATE EMAIL CHECK
  // ─────────────────────────────────────────────────────────────
  const validateForm = async () => {
    const errors = {};

    if (!formData.clinician_name || formData.clinician_name.trim().length < 2) {
      errors.clinician_name = 'Clinician name & credentials are required (min 2 characters).';
    }

    if (!formData.clinical_title || formData.clinical_title.trim().length < 2) {
      errors.clinical_title = 'Clinical title / role is required.';
    }

    if (!formData.specialization || formData.specialization.trim().length < 2) {
      errors.specialization = 'Specialization discipline is required.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email.trim())) {
      errors.email = 'A valid staff email address is required.';
    }

    if (formData.phone && formData.phone.trim().length > 0) {
      const cleanPhone = formData.phone.replace(/[\s\-\(\)\.]/g, '');
      if (cleanPhone.length < 7) {
        errors.phone = 'Please provide a valid direct contact telephone number.';
      }
    }

    // Schedule validation: validate that end time is later than start time for active days
    const scheduleErrors = {};
    DAYS_OF_WEEK.forEach(day => {
      const dayVal = formData.availability_schedule?.[day] || 'Off';
      const { isOff, start, end } = parseDaySchedule(dayVal);
      if (!isOff) {
        if (!start || !end) {
          scheduleErrors[day] = `Please select both start and end times for ${day}.`;
        } else if (timeToMinutes(end) <= timeToMinutes(start)) {
          scheduleErrors[day] = `End time (${formatTimeLabel(end)}) must be later than start time (${formatTimeLabel(start)}) on ${day}.`;
        }
      }
    });

    if (Object.keys(scheduleErrors).length > 0) {
      errors.schedule = scheduleErrors;
    }

    // Duplicate email check
    if (!errors.email) {
      const targetEmail = formData.email.trim().toLowerCase();
      // 1. Check in-memory clinicians list first
      const duplicateLocal = clinicians.find(
        c => (!editingClinician || c.id !== editingClinician.id) &&
          c.email.trim().toLowerCase() === targetEmail
      );
      if (duplicateLocal) {
        errors.email = `Staff email "${formData.email.trim()}" is already registered to another clinician.`;
      } else {
        // 2. Check Supabase database if available
        try {
          let { data: existing, error: checkErr } = await supabase
            .from('clinicians')
            .select('id, email')
            .ilike('email', targetEmail);

          if (checkErr) {
            const adminCheck = await supabaseAdmin
              .from('clinicians')
              .select('id, email')
              .ilike('email', targetEmail);
            if (!adminCheck.error && adminCheck.data) {
              existing = adminCheck.data;
              checkErr = null;
            }
          }

          if (!checkErr && existing && existing.length > 0) {
            const duplicate = existing.find(c => !editingClinician || c.id !== editingClinician.id);
            if (duplicate) {
              errors.email = `Staff email "${formData.email.trim()}" is already registered to another clinician.`;
            }
          }
        } catch (err) {
          console.warn('Duplicate check notice:', err);
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─────────────────────────────────────────────────────────────
  // 7. SAVE CLINICIAN (CREATE / UPDATE DYNAMIC SUPABASE)
  // ─────────────────────────────────────────────────────────────
  const handleSaveClinician = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const friendlyError = (err, fallback) => {
      const msg = err?.message || 'Unknown error.';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Network request failed')) {
        return 'Cannot reach the database — Supabase may be experiencing a connection issue. Please check your network and try again.';
      }
      return `${fallback}: ${msg}`;
    };

    try {
      const isValid = await validateForm();
      if (!isValid) {
        toast.error('Please resolve the highlighted validation errors.');
        setSubmitting(false);
        return;
      }

      // 1. Process profile photo upload
      let finalImageUrl = formData.profile_image_url;
      if (selectedFile) {
        try {
          const uploadedUrl = await uploadProfileImage(selectedFile);
          if (uploadedUrl) finalImageUrl = uploadedUrl;
        } catch (upErr) {
          console.warn('Profile image upload notice:', upErr);
        }
      }

      const payload = {
        clinician_name: formData.clinician_name.trim(),
        clinical_title: formData.clinical_title.trim(),
        specialization: formData.specialization.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        practice_status: formData.practice_status,
        profile_image_url: finalImageUrl || null,
        biography: formData.biography.trim(),
        availability_schedule: formData.availability_schedule,
        updated_at: new Date().toISOString()
      };

      if (editingClinician) {
        // UPDATE
        let { data: updData, error: updateErr } = await supabase
          .from('clinicians')
          .update(payload)
          .eq('id', editingClinician.id)
          .select();

        if (updateErr) {
          const adminUp = await supabaseAdmin
            .from('clinicians')
            .update(payload)
            .eq('id', editingClinician.id)
            .select();

          if (adminUp.error) {
            console.error('Supabase clinician update error:', updateErr, adminUp.error);
            toast.error(friendlyError(adminUp.error || updateErr, 'Failed to update clinician'));
            setSubmitting(false);
            return;
          }
          updData = adminUp.data;
        }

        toast.success(`Clinician "${payload.clinician_name}" updated successfully.`);
      } else {
        // CREATE / REGISTER NEW CLINICIAN
        let { data: insData, error: insertErr } = await supabase
          .from('clinicians')
          .insert([payload])
          .select();

        if (insertErr) {
          const adminIns = await supabaseAdmin
            .from('clinicians')
            .insert([payload])
            .select();

          if (adminIns.error) {
            console.error('Supabase clinician insert error:', insertErr, adminIns.error);
            toast.error(friendlyError(adminIns.error || insertErr, 'Failed to register clinician'));
            setSubmitting(false);
            return;
          }
          insData = adminIns.data;
        }

        toast.success(`Clinician "${payload.clinician_name}" registered successfully.`);
      }

      // Close registration drawer and reset editing state
      setIsDrawerOpen(false);
      setEditingClinician(null);

      // Refresh clinician list dynamically from Supabase
      await fetchClinicians();
    } catch (err) {
      console.error('Error saving clinician:', err);
      toast.error(err?.message || 'Failed to save clinician record.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 8. QUICK STATUS TOGGLE FROM ACTIONS MENU
  // ─────────────────────────────────────────────────────────────
  const handleQuickToggleStatus = async (clinician) => {
    const nextStatus = clinician.practice_status === 'Active' ? 'Inactive' : 'Active';
    try {
      let { error: statusErr } = await supabase
        .from('clinicians')
        .update({ practice_status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', clinician.id);

      if (statusErr) {
        const adminRes = await supabaseAdmin
          .from('clinicians')
          .update({ practice_status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', clinician.id);
        statusErr = adminRes.error;
      }

      if (statusErr) {
        console.error('Supabase status toggle error:', statusErr);
        toast.error(`Database error: ${statusErr.message}`);
        return;
      }

      toast.success(`${clinician.clinician_name} status updated to ${nextStatus}.`);
      await fetchClinicians();
    } catch (err) {
      console.error('Error toggling status:', err);
      toast.error('Failed to update clinician status: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 9. DELETE CLINICIAN
  // ─────────────────────────────────────────────────────────────
  const handleDeleteClinician = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      // 1. Delete associated profile image from storage if applicable
      if (deleteTarget.profile_image_url && deleteTarget.profile_image_url.includes('clinician-avatars')) {
        try {
          const parts = deleteTarget.profile_image_url.split('/clinician-avatars/');
          if (parts[1]) {
            await supabase.storage.from('clinician-avatars').remove([parts[1]]);
          }
        } catch (stErr) {
          console.warn('Storage deletion notice:', stErr);
        }
      }

      // 2. Delete database record
      let { error: delErr } = await supabase
        .from('clinicians')
        .delete()
        .eq('id', deleteTarget.id);

      if (delErr) {
        const adminDel = await supabaseAdmin
          .from('clinicians')
          .delete()
          .eq('id', deleteTarget.id);
        delErr = adminDel.error;
      }

      if (delErr) {
        console.error('Supabase delete error:', delErr);
        toast.error(`Database error: ${delErr.message}`);
        return;
      }

      toast.success(`Clinician "${deleteTarget.clinician_name}" removed from practice.`);
      setDeleteTarget(null);
      await fetchClinicians();
    } catch (err) {
      console.error('Error deleting clinician:', err);
      toast.error('Failed to delete clinician: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 10. COPY HELPER
  // ─────────────────────────────────────────────────────────────
  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copied ${fieldName} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ─────────────────────────────────────────────────────────────
  // 11. FILTERED CLINICIANS & SEARCH
  // ─────────────────────────────────────────────────────────────
  const filteredClinicians = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return clinicians.filter((c) => {
      const matchSearch =
        !q ||
        c.clinician_name.toLowerCase().includes(q) ||
        c.clinical_title.toLowerCase().includes(q) ||
        c.specialization.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q);

      const matchStatus = statusFilter === 'ALL' || c.practice_status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [clinicians, searchTerm, statusFilter]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // ─────────────────────────────────────────────────────────────
  // 12. TABLE COLUMNS DEFINITION
  // ─────────────────────────────────────────────────────────────
  const columns = [
    {
      header: 'Clinician / Provider',
      accessor: 'clinician_name',
      sortable: true,
      render: (row) => (
        <div
          onClick={() => setSelectedClinician(row)}
          className="clinician-profile-nav-link"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            cursor: 'pointer',
            userSelect: 'none'
          }}
          title={`View ${row.clinician_name}'s Profile`}
        >
          {row.profile_image_url ? (
            <img
              src={row.profile_image_url}
              alt={row.clinician_name}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                flexShrink: 0,
                transition: 'transform 0.15s ease'
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#e0f2fe',
                color: '#0369a1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
                border: '1px solid #bae6fd',
                flexShrink: 0,
                transition: 'transform 0.15s ease'
              }}
            >
              {row.clinician_name.replace('Dr. ', '').substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div
              className="clinician-name-link"
              style={{
                fontWeight: 600,
                color: '#0f2942',
                fontSize: '0.92rem',
                transition: 'color 0.15s ease'
              }}
            >
              {row.clinician_name}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '1px' }}>
              {row.clinical_title}
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'Specialization',
      accessor: 'specialization',
      sortable: true,
      render: (row) => (
        <span style={{ fontSize: '0.84rem', color: '#334155', fontWeight: 500 }}>
          {row.specialization}
        </span>
      )
    },
    {
      header: 'Contact Info',
      accessor: 'email',
      render: (row) => (
        <div>
          <div style={{ fontSize: '0.84rem', color: '#1e5aa8', fontWeight: 500 }}>
            {row.email}
          </div>
          {row.phone && (
            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
              {row.phone}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Availability Status',
      accessor: 'practice_status',
      sortable: true,
      render: (row) => (
        <AdminBadge status={row.practice_status || 'Active'} />
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      align: 'right',
      width: '80px',
      minWidth: '80px',
      render: (row) => {
        const isOpen = actionMenuClinicianId === row.id;
        return (
          <div
            className="clinician-action-menu-container"
            style={{ position: 'relative', display: 'inline-flex', justifyContent: 'flex-end' }}
          >
            <button
              type="button"
              className={`clinician-action-trigger-btn ${isOpen ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (actionMenuClinicianId === row.id) {
                  setActionMenuClinicianId(null);
                  setActionMenuPosition(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dropdownHeight = 185;
                  const spaceBelow = window.innerHeight - rect.bottom;
                  const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
                  setActionMenuPosition({
                    top: openUpward ? Math.max(10, rect.top - dropdownHeight - 6) : rect.bottom + 6,
                    right: Math.max(16, window.innerWidth - rect.right)
                  });
                  setActionMenuClinicianId(row.id);
                }
              }}
              title="Clinician Actions"
              aria-label="Clinician actions"
              aria-haspopup="true"
              aria-expanded={isOpen}
            >
              <MoreVertical size={16} />
            </button>

            {isOpen && actionMenuPosition && typeof document !== 'undefined' && createPortal(
              <div
                className="clinician-action-dropdown-menu"
                style={{
                  position: 'fixed',
                  top: `${actionMenuPosition.top}px`,
                  right: `${actionMenuPosition.right}px`,
                  width: '190px',
                  zIndex: 99999
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 1. View Profile */}
                <button
                  type="button"
                  className="clinician-action-item item-view"
                  onClick={() => {
                    setActionMenuClinicianId(null);
                    setActionMenuPosition(null);
                    setSelectedClinician(row);
                  }}
                >
                  <Eye size={15} color="#1e5aa8" />
                  <span>View Profile</span>
                </button>

                {/* 2. Edit Clinician */}
                <button
                  type="button"
                  className="clinician-action-item"
                  onClick={() => {
                    setActionMenuClinicianId(null);
                    setActionMenuPosition(null);
                    handleOpenEditDrawer(row);
                  }}
                >
                  <Edit2 size={15} color="#475569" />
                  <span>Edit Clinician</span>
                </button>

                {/* 3. Quick Status Toggle */}
                <button
                  type="button"
                  className={`clinician-action-item ${row.practice_status === 'Active' ? 'item-status-active' : 'item-status-inactive'}`}
                  onClick={() => {
                    setActionMenuClinicianId(null);
                    setActionMenuPosition(null);
                    handleQuickToggleStatus(row);
                  }}
                >
                  {row.practice_status === 'Active' ? (
                    <>
                      <XCircle size={15} color="#d97706" />
                      <span>Mark as Inactive</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} color="#10b981" />
                      <span>Mark as Active</span>
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="clinician-action-separator" />

                {/* 4. Delete Clinician */}
                <button
                  type="button"
                  className="clinician-action-item item-danger"
                  onClick={() => {
                    setActionMenuClinicianId(null);
                    setActionMenuPosition(null);
                    setDeleteTarget(row);
                  }}
                >
                  <Trash2 size={15} color="#dc2626" />
                  <span>Delete Clinician</span>
                </button>
              </div>,
              document.body
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Medical Staff & Clinical Providers</h1>
          <p>Manage physicians, aesthetic nurse practitioners, clinician availability rosters, and suites.</p>
        </div>

        <div className="admin-page-actions">
          <AdminButton
            variant="primary"
            onClick={handleOpenAddDrawer}
            icon={<Plus size={16} />}
          >
            Add Clinician
          </AdminButton>
        </div>
      </div>



      {/* ── Toolbar with Dynamic Search and Shadcn Status Filter ── */}
      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search providers by name, discipline, email..."
        hasActiveFilters={Boolean(searchTerm) || statusFilter !== 'ALL'}
        onClearFilters={() => {
          setSearchTerm('');
          setStatusFilter('ALL');
        }}
        filters={[
          {
            id: 'status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Active', value: 'Active' },
              { label: 'Inactive', value: 'Inactive' }
            ]
          }
        ]}
      />

      {/* ── Main Providers Table (Max 20 per page, dynamic Supabase) ── */}
      <AdminTable
        columns={columns}
        data={filteredClinicians}
        loading={loading}
        error={error}
        onRetry={fetchClinicians}
        itemsPerPage={20}
        itemLabel="clinicians"
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        emptyTitle="No providers found"
        emptyDescription="Adjust your search criteria or register a new clinician."
        emptyActionLabel="Add Clinician"
        onEmptyAction={handleOpenAddDrawer}
      />

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── REGISTER / EDIT CLINICIAN RIGHT-SIDE DRAWER ──             */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <AdminDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          if (!submitting) {
            setIsDrawerOpen(false);
            setEditingClinician(null);
          }
        }}
        title={editingClinician ? "Edit Clinician Profile" : "Register New Clinician"}
        subtitle="Configure clinician credentials, practice availability, and contact details."
        width="660px"
        footer={
          <div style={{ display: 'flex', justifyContent: editingClinician ? 'space-between' : 'flex-end', alignItems: 'center', gap: '12px', width: '100%' }}>
            {editingClinician && (
              <AdminButton
                type="button"
                variant="secondary"
                icon={<Eye size={14} color="#1e5aa8" />}
                onClick={() => {
                  const target = editingClinician;
                  setIsDrawerOpen(false);
                  setEditingClinician(null);
                  setSelectedClinician(target);
                }}
                style={{ color: '#1e5aa8', fontWeight: 600 }}
              >
                View Clinician Profile
              </AdminButton>
            )}
            <div style={{ display: 'flex', gap: '10px', marginLeft: editingClinician ? 'auto' : '0' }}>
              <AdminButton
                variant="secondary"
                disabled={submitting}
                onClick={() => {
                  setIsDrawerOpen(false);
                  setEditingClinician(null);
                }}
              >
                Cancel
              </AdminButton>
              <AdminButton
                variant="primary"
                disabled={submitting}
                onClick={handleSaveClinician}
              >
                {submitting ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid #ffffff',
                        borderRightColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.7s linear infinite'
                      }}
                    />
                    <span>Saving...</span>
                  </span>
                ) : editingClinician ? (
                  "Save Clinician Record"
                ) : (
                  "Register Clinician"
                )}
              </AdminButton>
            </div>
          </div>
        }
      >
        <form
          autoComplete="off"
          onSubmit={handleSaveClinician}
          style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}
        >

          {/* 1. Profile Picture Upload & Preview Card */}
          <div
            style={{
              padding: '18px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px'
            }}
          >
            <label className="admin-form-label" style={{ marginBottom: '12px' }}>
              Profile Picture
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              {/* Image Preview */}
              <div
                style={{
                  width: '74px',
                  height: '74px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: '2px solid #cbd5e1',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  flexShrink: 0
                }}
              >
                {previewImageUrl ? (
                  <img
                    src={previewImageUrl}
                    alt="Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <User size={36} color="#94a3b8" />
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/jpg"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <AdminButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<Upload size={14} />}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  >
                    {previewImageUrl ? 'Replace Image' : 'Upload Image'}
                  </AdminButton>

                  {previewImageUrl && (
                    <AdminButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<X size={14} />}
                      onClick={handleRemovePhoto}
                    >
                      Remove
                    </AdminButton>
                  )}
                </div>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Supports JPG, PNG, WEBP up to 5MB. Stored securely in Supabase Storage.
                </span>
                {photoError && (
                  <span style={{ fontSize: '0.76rem', color: '#dc2626', fontWeight: 500 }}>
                    {photoError}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Clinician Primary Fields Grid */}
          <div className="admin-form-grid-2">
            {/* Clinician Name & Credentials */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Clinician Name & Credentials <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                name="clinician_full_name"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                aria-autocomplete="none"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                required
                className={`admin-form-input ${formErrors.clinician_name ? 'error' : ''}`}
                placeholder="e.g. Dr. Alistair Vance, MD"
                value={formData.clinician_name}
                onChange={(e) => {
                  setFormData({ ...formData, clinician_name: e.target.value });
                  if (formErrors.clinician_name) {
                    setFormErrors(prev => ({ ...prev, clinician_name: null }));
                  }
                }}
              />
              {formErrors.clinician_name && (
                <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '4px' }}>
                  {formErrors.clinician_name}
                </div>
              )}
            </div>

            {/* Clinical Title / Role */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Clinical Title / Role <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                name="clinician_clinical_title"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                aria-autocomplete="none"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                required
                className={`admin-form-input ${formErrors.clinical_title ? 'error' : ''}`}
                placeholder="e.g. Medical Director & Aesthetic Physician"
                value={formData.clinical_title}
                onChange={(e) => {
                  setFormData({ ...formData, clinical_title: e.target.value });
                  if (formErrors.clinical_title) {
                    setFormErrors(prev => ({ ...prev, clinical_title: null }));
                  }
                }}
              />
              {formErrors.clinical_title && (
                <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '4px' }}>
                  {formErrors.clinical_title}
                </div>
              )}
            </div>

            {/* Specialization */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Specialization <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                name="clinician_specialization"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                aria-autocomplete="none"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                required
                className={`admin-form-input ${formErrors.specialization ? 'error' : ''}`}
                placeholder="e.g. Injectables, Polynucleotides & Deep RF"
                value={formData.specialization}
                onChange={(e) => {
                  setFormData({ ...formData, specialization: e.target.value });
                  if (formErrors.specialization) {
                    setFormErrors(prev => ({ ...prev, specialization: null }));
                  }
                }}
              />
              {formErrors.specialization && (
                <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '4px' }}>
                  {formErrors.specialization}
                </div>
              )}
            </div>

            {/* Practice Status (Shadcn Select) */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Practice Status <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <ShadcnSelect
                value={formData.practice_status}
                onChange={(val) => setFormData({ ...formData, practice_status: val })}
                options={[
                  { label: 'Active (Taking Appointments)', value: 'Active' },
                  { label: 'Inactive (Unavailable)', value: 'Inactive' }
                ]}
              />
            </div>

            {/* Staff Email Address */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Staff Email Address <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="email"
                name="staff_contact_email_addr"
                id="staff_contact_email_addr"
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck="false"
                aria-autocomplete="none"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                required
                className={`admin-form-input ${formErrors.email ? 'error' : ''}`}
                placeholder="clinician@beautyoasisrx.com"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (formErrors.email) {
                    setFormErrors(prev => ({ ...prev, email: null }));
                  }
                }}
              />
              {formErrors.email && (
                <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '4px' }}>
                  {formErrors.email}
                </div>
              )}
            </div>

            {/* Direct Contact Phone */}
            <div className="admin-form-group">
              <label className="admin-form-label">Direct Contact Phone</label>
              <input
                type="tel"
                name="staff_direct_phone_number"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                aria-autocomplete="none"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                className={`admin-form-input ${formErrors.phone ? 'error' : ''}`}
                placeholder="(214) 555-0100"
                value={formData.phone}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                  if (formErrors.phone) {
                    setFormErrors(prev => ({ ...prev, phone: null }));
                  }
                }}
              />
              {formErrors.phone && (
                <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '4px' }}>
                  {formErrors.phone}
                </div>
              )}
            </div>
          </div>

          {/* 3. Weekly Suite Availability Schedule */}
          <div
            style={{
              padding: '18px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <div>
                <label className="admin-form-label" style={{ margin: 0 }}>
                  Weekly Suite Availability Schedule
                </label>
                <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                  Configure working hours with Shadcn time pickers or toggle Set Off.
                </span>
              </div>

              <button
                type="button"
                onClick={handleApplyWeekdayPreset}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#1e5aa8',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Clock size={12} />
                <span>Apply 9 AM – 5 PM Weekdays</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {DAYS_OF_WEEK.map((day) => {
                const dayVal = formData.availability_schedule?.[day] || 'Off';
                const { isOff, start, end } = parseDaySchedule(dayVal);
                const dayError = formErrors.schedule?.[day];

                return (
                  <div
                    key={day}
                    style={{
                      background: isOff ? '#f8fafc' : '#ffffff',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: dayError
                        ? '1px solid #fca5a5'
                        : isOff
                          ? '1px solid #e2e8f0'
                          : '1px solid #cbd5e1',
                      boxShadow: isOff ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.86rem', color: '#0f2942', fontWeight: 700 }}>
                          {day}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: isOff ? '#f1f5f9' : '#dcfce7',
                            color: isOff ? '#64748b' : '#15803d',
                            border: isOff ? '1px solid #e2e8f0' : '1px solid #bbf7d0'
                          }}
                        >
                          {isOff ? 'Off (Closed)' : 'Open'}
                        </span>
                      </div>

                      {/* Set Hours & Set Off Controls */}
                      <div
                        style={{
                          display: 'inline-flex',
                          borderRadius: '7px',
                          background: '#f1f5f9',
                          padding: '2px',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleSetHours(day)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            borderRadius: '5px',
                            border: 'none',
                            cursor: 'pointer',
                            background: !isOff ? '#1e5aa8' : 'transparent',
                            color: !isOff ? '#ffffff' : '#475569',
                            boxShadow: !isOff ? '0 1px 3px rgba(30, 90, 168, 0.25)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Set Hours
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetOff(day)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            borderRadius: '5px',
                            border: 'none',
                            cursor: 'pointer',
                            background: isOff ? '#dc2626' : 'transparent',
                            color: isOff ? '#ffffff' : '#475569',
                            boxShadow: isOff ? '0 1px 3px rgba(220, 38, 38, 0.25)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Set Off
                        </button>
                      </div>
                    </div>

                    {/* Start Time & End Time Pickers (Shadcn UI Select) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px' }}>
                      <div>
                        <span
                          style={{
                            fontSize: '0.70rem',
                            color: isOff ? '#94a3b8' : '#64748b',
                            fontWeight: 600,
                            display: 'block',
                            marginBottom: '3px'
                          }}
                        >
                          Start Time
                        </span>
                        <ShadcnSelect
                          value={isOff ? '' : start}
                          onChange={(val) => handleTimeChange(day, 'start', val)}
                          options={TIME_OPTIONS}
                          placeholder={isOff ? 'Closed' : 'Select Start Time'}
                          disabled={isOff}
                          className={dayError ? 'error' : ''}
                        />
                      </div>

                      <div
                        style={{
                          paddingTop: '16px',
                          fontSize: '0.76rem',
                          color: isOff ? '#cbd5e1' : '#94a3b8',
                          fontWeight: 600,
                          textAlign: 'center'
                        }}
                      >
                        to
                      </div>

                      <div>
                        <span
                          style={{
                            fontSize: '0.70rem',
                            color: isOff ? '#94a3b8' : '#64748b',
                            fontWeight: 600,
                            display: 'block',
                            marginBottom: '3px'
                          }}
                        >
                          End Time
                        </span>
                        <ShadcnSelect
                          value={isOff ? '' : end}
                          onChange={(val) => handleTimeChange(day, 'end', val)}
                          options={TIME_OPTIONS}
                          placeholder={isOff ? 'Closed' : 'Select End Time'}
                          disabled={isOff}
                          className={dayError ? 'error' : ''}
                        />
                      </div>
                    </div>

                    {dayError && (
                      <div
                        style={{
                          marginTop: '8px',
                          fontSize: '0.74rem',
                          color: '#dc2626',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <AlertCircle size={13} style={{ flexShrink: 0 }} />
                        <span>{dayError}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Biography & Clinical Philosophy */}
          <div className="admin-form-group">
            <label className="admin-form-label">
              Biography & Clinical Philosophy
            </label>
            <textarea
              className="admin-form-textarea"
              rows="4"
              placeholder="Detail medical credentials, training background, areas of clinical focus, and patient care philosophy..."
              value={formData.biography}
              autoComplete="off"
              spellCheck="false"
              data-lpignore="true"
              onChange={(e) => setFormData({ ...formData, biography: e.target.value })}
            />
          </div>
        </form>
      </AdminDrawer>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── VIEW CLINICIAN DETAILS RIGHT-SIDE DRAWER ──               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <AdminDrawer
        isOpen={Boolean(selectedClinician)}
        onClose={() => setSelectedClinician(null)}
        title="Clinician Profile"
        subtitle={selectedClinician?.clinical_title}
        width="560px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <AdminButton
              variant="secondary"
              onClick={() => {
                const target = selectedClinician;
                setSelectedClinician(null);
                handleOpenEditDrawer(target);
              }}
              icon={<Edit2 size={14} />}
            >
              Edit Clinician
            </AdminButton>
            <AdminButton variant="primary" onClick={() => setSelectedClinician(null)}>
              Done
            </AdminButton>
          </div>
        }
      >
        {selectedClinician && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header Identity Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
                padding: '18px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}
            >
              {selectedClinician.profile_image_url ? (
                <img
                  src={selectedClinician.profile_image_url}
                  alt={selectedClinician.clinician_name}
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #cbd5e1',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    border: '2px solid #bae6fd'
                  }}
                >
                  {selectedClinician.clinician_name.replace('Dr. ', '').substring(0, 2).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.2rem', color: '#0f2942', fontWeight: 700 }}>
                  {selectedClinician.clinician_name}
                </h3>
                <div style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '8px' }}>
                  {selectedClinician.clinical_title}
                </div>
                <AdminBadge status={selectedClinician.practice_status} />
              </div>
            </div>

            {/* Specialization & Contact */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.86rem', color: '#0f2942', fontWeight: 700 }}>
                Specialization & Contact
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.84rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.76rem', display: 'block' }}>Specialization</span>
                  <span style={{ color: '#0f2942', fontWeight: 600 }}>{selectedClinician.specialization}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Mail size={15} color="#1e5aa8" />
                    <span style={{ color: '#1e5aa8', fontWeight: 500 }}>{selectedClinician.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedClinician.email, 'email')}
                    title="Copy Email"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
                  >
                    {copiedField === 'email' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  </button>
                </div>

                {selectedClinician.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Phone size={15} color="#64748b" />
                      <span style={{ color: '#334155' }}>{selectedClinician.phone}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedClinician.phone, 'phone')}
                      title="Copy Phone"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
                    >
                      {copiedField === 'phone' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Clinical Background */}
            {selectedClinician.biography && (
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.86rem', color: '#0f2942', fontWeight: 700 }}>
                  Clinical Background & Philosophy
                </h4>
                <p style={{ margin: 0, fontSize: '0.84rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {selectedClinician.biography}
                </p>
              </div>
            )}

            {/* Weekly Schedule */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Calendar size={16} color="#1e5aa8" />
                <h4 style={{ margin: 0, fontSize: '0.86rem', color: '#0f2942', fontWeight: 700 }}>
                  Weekly Suite Availability Schedule
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                {DAYS_OF_WEEK.map((day) => {
                  const val = selectedClinician.availability_schedule?.[day] || 'Off';
                  const { isOff, start, end } = parseDaySchedule(val);
                  const displayHours = isOff
                    ? 'Off (Closed)'
                    : `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`;

                  return (
                    <div
                      key={day}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingBottom: '6px',
                        borderBottom: '1px solid #f1f5f9'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#334155' }}>{day}</span>
                      <span
                        style={{
                          color: isOff ? '#94a3b8' : '#15803d',
                          fontWeight: isOff ? 400 : 600,
                          fontSize: '0.80rem'
                        }}
                      >
                        {displayHours}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </AdminDrawer>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── DELETE CLINICIAN CONFIRMATION DIALOG ──                   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <AdminConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteClinician}
        loading={deleting}
        title="Delete Clinician Profile"
        message={`Are you certain you want to remove ${deleteTarget?.clinician_name || 'this clinician'} from active practice schedules and records? This action cannot be undone.`}
        confirmText="Delete Clinician"
        confirmVariant="danger"
      />
    </div>
  );
};

export default ProvidersPage;
