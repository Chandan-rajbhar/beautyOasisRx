import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Plus,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  MoreVertical,
  FolderPlus,
  Tag,
  AlertCircle,
  RefreshCw,
  X,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';
import { ShadcnSelect } from '../../components/ui/select';
import { TimePicker } from '../../components/ui/TimePicker';

// ─────────────────────────────────────────────────────────────
// PRESET CLINICAL OPTIONS
// ─────────────────────────────────────────────────────────────
export const DEFAULT_CLINICAL_CATEGORIES = [
  'Skin Rejuvenation',
  'Anti-Ageing',
  'Laser & IPL',
  'Body Contouring',
  'Injectables & Fillers',
  'Acne & Scarring',
  'Men\'s Aesthetics'
];

export const DEFAULT_CLINICAL_DURATIONS = [
  '15 Mins',
  '30 Mins',
  '45 Mins',
  '60 Mins',
  '75 Mins',
  '90 Mins',
  '120 Mins'
];

export const DURATION_OPTIONS = DEFAULT_CLINICAL_DURATIONS.map(d => ({ value: d, label: d }));

export const parseMinutesFromLabel = (label) => {
  const match = String(label).match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

export const APPOINTMENT_TIME_OPTIONS = [
  { value: '08:00 AM', label: '08:00 AM' },
  { value: '08:30 AM', label: '08:30 AM' },
  { value: '09:00 AM', label: '09:00 AM' },
  { value: '09:30 AM', label: '09:30 AM' },
  { value: '10:00 AM', label: '10:00 AM' },
  { value: '10:30 AM', label: '10:30 AM' },
  { value: '11:00 AM', label: '11:00 AM' },
  { value: '11:30 AM', label: '11:30 AM' },
  { value: '12:00 PM', label: '12:00 PM' },
  { value: '12:30 PM', label: '12:30 PM' },
  { value: '01:00 PM', label: '01:00 PM' },
  { value: '01:30 PM', label: '01:30 PM' },
  { value: '02:00 PM', label: '02:00 PM' },
  { value: '02:30 PM', label: '02:30 PM' },
  { value: '03:00 PM', label: '03:00 PM' },
  { value: '03:30 PM', label: '03:30 PM' },
  { value: '04:00 PM', label: '04:00 PM' },
  { value: '04:30 PM', label: '04:30 PM' },
  { value: '05:00 PM', label: '05:00 PM' },
  { value: '05:30 PM', label: '05:30 PM' },
  { value: '06:00 PM', label: '06:00 PM' },
  { value: '06:30 PM', label: '06:30 PM' },
  { value: '07:00 PM', label: '07:00 PM' }
];

export const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${m}/${d}/${y}`;
  }
  return dateStr;
};

const DEFAULT_FORM = {
  protocol_title: '',
  category_id: '',
  category: '',
  price: '',
  duration: '60 Mins',
  status: 'Active',
  appointment_date: new Date().toISOString().split('T')[0],
  appointment_time: '10:30 AM',
  tagline: '',
  clinical_description: ''
};

export const ServicesPage = () => {
  // Global admin context for cross-module sync
  const adminCtx = useAdminData();

  // Primary Data States
  const [treatments, setTreatments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Drawer & Modal States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [selectedTreatment, setSelectedTreatment] = useState(null);
  const [deleteConfirmTreatment, setDeleteConfirmTreatment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Category Management Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [categoryDeleteTarget, setCategoryDeleteTarget] = useState(null);
  const [categoryActionLoading, setCategoryActionLoading] = useState(false);

  // Duration Management Modal State
  const [durations, setDurations] = useState([]);
  const [isDurationModalOpen, setIsDurationModalOpen] = useState(false);
  const [newDurationLabel, setNewDurationLabel] = useState('');
  const [editingDuration, setEditingDuration] = useState(null);
  const [editingDurationLabel, setEditingDurationLabel] = useState('');
  const [durationDeleteTarget, setDurationDeleteTarget] = useState(null);
  const [durationActionLoading, setDurationActionLoading] = useState(false);

  // Three-dot Action Menu State (Viewport Positioned Portal)
  const [actionMenuTreatmentId, setActionMenuTreatmentId] = useState(null);
  const [actionMenuPosition, setActionMenuPosition] = useState(null);

  // Form State & Validation Errors
  const [formData, setFormData] = useState({ ...DEFAULT_FORM });
  const [formErrors, setFormErrors] = useState({});

  // Close actions dropdown on click outside, scroll, resize or Esc key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.protocol-action-menu-container') && !e.target.closest('.protocol-action-dropdown-menu')) {
        setActionMenuTreatmentId(null);
        setActionMenuPosition(null);
      }
    };
    const handleWindowChange = () => {
      if (actionMenuTreatmentId) {
        setActionMenuTreatmentId(null);
        setActionMenuPosition(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && actionMenuTreatmentId) {
        setActionMenuTreatmentId(null);
        setActionMenuPosition(null);
      }
    };
    if (actionMenuTreatmentId) {
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
  }, [actionMenuTreatmentId]);

  // ─────────────────────────────────────────────────────────────
  // 1. FETCH CATEGORIES (SUPABASE)
  // ─────────────────────────────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    try {
      let { data, error: catErr } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (catErr) {
        const adminRes = await supabaseAdmin
          .from('categories')
          .select('*')
          .order('name', { ascending: true });
        if (!adminRes.error && adminRes.data) {
          data = adminRes.data;
          catErr = null;
        }
      }

      // If categories table is empty, auto-seed default clinical categories
      if (!catErr && (!data || data.length === 0)) {
        const seedPayload = DEFAULT_CLINICAL_CATEGORIES.map(name => ({ name }));
        try {
          const { data: seeded } = await supabase.from('categories').insert(seedPayload).select();
          if (seeded && seeded.length > 0) {
            data = seeded;
          }
        } catch (_) { }
      }

      if (data && data.length > 0) {
        setCategories(data);
        try { localStorage.setItem('bo_categories_cache', JSON.stringify(data)); } catch (_) { }
      } else {
        // Fallback to local default objects
        const fallbackCats = DEFAULT_CLINICAL_CATEGORIES.map((name, i) => ({ id: `cat-${i}`, name }));
        setCategories(fallbackCats);
      }
    } catch (err) {
      console.error('Error fetching categories from Supabase:', err);
      const fallbackCats = DEFAULT_CLINICAL_CATEGORIES.map((name, i) => ({ id: `cat-${i}`, name }));
      setCategories(fallbackCats);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 1B. FETCH DURATIONS (SUPABASE)
  // ─────────────────────────────────────────────────────────────
  const fetchDurations = useCallback(async () => {
    try {
      let { data, error: durErr } = await supabase
        .from('durations')
        .select('*')
        .order('minutes', { ascending: true, nullsFirst: false });

      if (durErr) {
        const adminRes = await supabaseAdmin
          .from('durations')
          .select('*')
          .order('minutes', { ascending: true, nullsFirst: false });
        if (!adminRes.error && adminRes.data) {
          data = adminRes.data;
          durErr = null;
        }
      }

      // If durations table exists but is empty, auto-seed default clinical durations
      if (!durErr && (!data || data.length === 0)) {
        const seedPayload = DEFAULT_CLINICAL_DURATIONS.map(label => ({
          label,
          minutes: parseMinutesFromLabel(label)
        }));
        try {
          const { data: seeded } = await supabase.from('durations').insert(seedPayload).select();
          if (seeded && seeded.length > 0) {
            data = seeded;
          }
        } catch (_) { }
      }

      if (data && data.length > 0) {
        // Sort numerically by minutes
        const sorted = [...data].sort((a, b) => (a.minutes || parseMinutesFromLabel(a.label)) - (b.minutes || parseMinutesFromLabel(b.label)));
        setDurations(sorted);
        try { localStorage.setItem('bo_durations_cache', JSON.stringify(sorted)); } catch (_) { }
      } else {
        const fallback = DEFAULT_CLINICAL_DURATIONS.map((label, i) => ({
          id: `dur-${i}`,
          label,
          minutes: parseMinutesFromLabel(label)
        }));
        setDurations(fallback);
      }
    } catch (err) {
      console.error('Error fetching durations from Supabase:', err);
      const fallback = DEFAULT_CLINICAL_DURATIONS.map((label, i) => ({
        id: `dur-${i}`,
        label,
        minutes: parseMinutesFromLabel(label)
      }));
      setDurations(fallback);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 2. FETCH TREATMENTS (SUPABASE)
  // ─────────────────────────────────────────────────────────────
  const fetchTreatments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let treatmentsResult = [];
      // Primary: query treatment_protocols
      let { data, error: treatErr } = await supabase
        .from('treatment_protocols')
        .select('*')
        .order('created_at', { ascending: false });

      if (treatErr) {
        // Attempt admin client
        const adminRes = await supabaseAdmin
          .from('treatment_protocols')
          .select('*')
          .order('created_at', { ascending: false });
        if (!adminRes.error && adminRes.data) {
          data = adminRes.data;
          treatErr = null;
        }
      }

      // Fallback: check if existing services table has data
      if (treatErr) {
        let { data: srvData, error: srvErr } = await supabase
          .from('services')
          .select('*')
          .order('created_at', { ascending: false });
        if (!srvErr && srvData) {
          data = srvData;
          treatErr = null;
        }
      }

      if (treatErr) {
        console.warn('Could not query treatment_protocols or services in Supabase:', treatErr.message);
        // Load from cache if available
        const cached = localStorage.getItem('bo_treatment_protocols_cache');
        if (cached) {
          try {
            treatmentsResult = JSON.parse(cached);
          } catch (_) { }
        }
      } else if (data) {
        // Normalize rows so both protocol_title and title work cleanly
        treatmentsResult = data.map(item => ({
          ...item,
          protocol_title: item.protocol_title || item.title || 'Untitled Protocol',
          price: Number(item.price || item.numericPrice || 0),
          duration: item.duration || '60 Mins',
          status: item.status || 'Active',
          appointment_date: item.appointment_date || (item.created_at ? item.created_at.split('T')[0] : '2026-09-30'),
          appointment_time: item.appointment_time || '10:30 AM',
          category: item.category || 'Skin Rejuvenation',
          tagline: item.tagline || '',
          clinical_description: item.clinical_description || item.description || ''
        }));
      }

      setTreatments(treatmentsResult);
      try {
        localStorage.setItem('bo_treatment_protocols_cache', JSON.stringify(treatmentsResult));
      } catch (_) { }

      // Keep AdminDataContext in sync so other components don't break
      if (adminCtx && typeof adminCtx.updateItem === 'function' && Array.isArray(treatmentsResult)) {
        try { localStorage.setItem('bo_cache_services', JSON.stringify(treatmentsResult)); } catch (_) { }
      }
    } catch (err) {
      console.error('Network error fetching treatment protocols:', err);
      setError('Unable to load treatment protocols. Please check your Supabase connection.');
    } finally {
      setLoading(false);
    }
  }, [adminCtx]);

  // Initial Load
  useEffect(() => {
    fetchCategories();
    fetchDurations();
    fetchTreatments();
  }, [fetchCategories, fetchDurations, fetchTreatments]);

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter]);

  // ─────────────────────────────────────────────────────────────
  // 3. FILTERED DATA & STATS
  // ─────────────────────────────────────────────────────────────
  const filteredTreatments = useMemo(() => {
    return treatments.filter((treatment) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        (treatment.protocol_title && treatment.protocol_title.toLowerCase().includes(q)) ||
        (treatment.category && treatment.category.toLowerCase().includes(q)) ||
        (treatment.clinical_description && treatment.clinical_description.toLowerCase().includes(q)) ||
        (treatment.tagline && treatment.tagline.toLowerCase().includes(q));

      const matchCategory = categoryFilter === 'ALL' || treatment.category === categoryFilter;
      const matchStatus = statusFilter === 'ALL' || treatment.status === statusFilter;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [treatments, searchTerm, categoryFilter, statusFilter]);

  // Dynamic Category Options for dropdowns
  const categoryOptions = useMemo(() => {
    return categories.map(c => ({
      value: c.name,
      label: c.name
    }));
  }, [categories]);

  // Dynamic Duration Options for dropdowns
  const durationOptions = useMemo(() => {
    if (!durations || durations.length === 0) {
      return DURATION_OPTIONS;
    }
    return durations.map(d => ({
      value: d.label,
      label: d.label
    }));
  }, [durations]);

  // ─────────────────────────────────────────────────────────────
  // 4. DRAWER OPEN & CLOSE HANDLERS
  // ─────────────────────────────────────────────────────────────
  const handleOpenAddDrawer = () => {
    const firstCat = categories.length > 0 ? categories[0].name : 'Skin Rejuvenation';
    const firstDur = durations.length > 0 ? (durations.find(d => d.label === '60 Mins')?.label || durations[0].label) : '60 Mins';
    setFormData({
      ...DEFAULT_FORM,
      category: firstCat,
      category_id: categories[0]?.id || '',
      duration: firstDur,
      appointment_date: new Date().toISOString().split('T')[0]
    });
    setFormErrors({});
    setEditingTreatment(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (treatment) => {
    setFormData({
      protocol_title: treatment.protocol_title || treatment.title || '',
      category_id: treatment.category_id || '',
      category: treatment.category || (categories[0]?.name || 'Skin Rejuvenation'),
      price: treatment.price ? String(treatment.price) : '',
      duration: treatment.duration || '60 Mins',
      status: treatment.status || 'Active',
      appointment_date: treatment.appointment_date || new Date().toISOString().split('T')[0],
      appointment_time: treatment.appointment_time || '10:30 AM',
      tagline: treatment.tagline || '',
      clinical_description: treatment.clinical_description || treatment.description || ''
    });
    setFormErrors({});
    setEditingTreatment(treatment);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    if (!submitting) {
      setIsDrawerOpen(false);
      setEditingTreatment(null);
      setFormErrors({});
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 5. VALIDATION & SAVE TREATMENT (CREATE & UPDATE)
  // ─────────────────────────────────────────────────────────────
  const validateForm = () => {
    const errors = {};
    if (!formData.protocol_title.trim()) {
      errors.protocol_title = 'Protocol title is required.';
    }
    if (!formData.category.trim()) {
      errors.category = 'Category is required.';
    }
    const numPrice = parseFloat(formData.price);
    if (!formData.price || isNaN(numPrice) || numPrice < 0) {
      errors.price = 'Please enter a valid price ($ USD).';
    }
    if (!formData.duration.trim()) {
      errors.duration = 'Duration is required.';
    }
    if (!formData.status) {
      errors.status = 'Status is required.';
    }
    if (!formData.appointment_date) {
      errors.appointment_date = 'Appointment date is required.';
    }
    if (!formData.appointment_time) {
      errors.appointment_time = 'Appointment time is required.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveTreatment = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      toast.error('Please complete all required fields.');
      return;
    }

    setSubmitting(true);
    const numPrice = parseFloat(formData.price);
    const matchedCategory = categories.find(c => c.name.toLowerCase() === formData.category.toLowerCase());

    const treatmentPayload = {
      protocol_title: formData.protocol_title.trim(),
      category: formData.category.trim(),
      category_id: matchedCategory?.id || null,
      price: numPrice,
      duration: formData.duration.trim(),
      status: formData.status,
      appointment_date: formData.appointment_date,
      appointment_time: formData.appointment_time,
      tagline: formData.tagline?.trim() || null,
      clinical_description: formData.clinical_description?.trim() || null,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingTreatment) {
        // UPDATE Existing Protocol
        let { data, error: updateErr } = await supabase
          .from('treatment_protocols')
          .update(treatmentPayload)
          .eq('id', editingTreatment.id)
          .select()
          .single();

        if (updateErr) {
          const adminRes = await supabaseAdmin
            .from('treatment_protocols')
            .update(treatmentPayload)
            .eq('id', editingTreatment.id)
            .select()
            .single();
          if (!adminRes.error && adminRes.data) {
            data = adminRes.data;
            updateErr = null;
          }
        }

        // Fallback to services table if treatment_protocols was not found
        if (updateErr) {
          const srvPayload = {
            title: treatmentPayload.protocol_title,
            category: treatmentPayload.category,
            numericPrice: treatmentPayload.price,
            price: `$${treatmentPayload.price}`,
            duration: treatmentPayload.duration,
            status: treatmentPayload.status,
            appointment_date: treatmentPayload.appointment_date,
            appointment_time: treatmentPayload.appointment_time,
            tagline: treatmentPayload.tagline,
            description: treatmentPayload.clinical_description
          };
          const fallbackRes = await supabase
            .from('services')
            .update(srvPayload)
            .eq('id', editingTreatment.id)
            .select()
            .single();
          if (!fallbackRes.error && fallbackRes.data) {
            data = fallbackRes.data;
            updateErr = null;
          }
        }

        if (updateErr) {
          console.error('Update treatment error:', updateErr);
          toast.error(`Database error: ${updateErr.message}`);
          return;
        }

        toast.success(`Protocol "${treatmentPayload.protocol_title}" updated successfully.`);
        await fetchTreatments();
        setIsDrawerOpen(false);
        setEditingTreatment(null);
      } else {
        // CREATE New Protocol
        const insertPayload = {
          ...treatmentPayload,
          created_at: new Date().toISOString()
        };

        let { data, error: insertErr } = await supabase
          .from('treatment_protocols')
          .insert([insertPayload])
          .select()
          .single();

        if (insertErr) {
          const adminRes = await supabaseAdmin
            .from('treatment_protocols')
            .insert([insertPayload])
            .select()
            .single();
          if (!adminRes.error && adminRes.data) {
            data = adminRes.data;
            insertErr = null;
          }
        }

        // Fallback to services table if needed
        if (insertErr) {
          const srvPayload = {
            title: insertPayload.protocol_title,
            category: insertPayload.category,
            numericPrice: insertPayload.price,
            price: `$${insertPayload.price}`,
            duration: insertPayload.duration,
            status: insertPayload.status,
            appointment_date: insertPayload.appointment_date,
            appointment_time: insertPayload.appointment_time,
            tagline: insertPayload.tagline,
            description: insertPayload.clinical_description,
            created_at: insertPayload.created_at
          };
          const fallbackRes = await supabase
            .from('services')
            .insert([srvPayload])
            .select()
            .single();
          if (!fallbackRes.error && fallbackRes.data) {
            data = fallbackRes.data;
            insertErr = null;
          }
        }

        if (insertErr) {
          console.error('Insert treatment error:', insertErr);
          toast.error(`Database error: ${insertErr.message}`);
          return;
        }

        toast.success(`Treatment protocol "${treatmentPayload.protocol_title}" created.`);
        await fetchTreatments();
        setIsDrawerOpen(false);
      }
    } catch (err) {
      console.error('Save treatment exception:', err);
      toast.error('Unexpected error while saving treatment protocol.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 6. TOGGLE STATUS (ACTIVE / INACTIVE)
  // ─────────────────────────────────────────────────────────────
  const handleQuickToggleStatus = async (treatment) => {
    const nextStatus = treatment.status === 'Active' ? 'Inactive' : 'Active';
    try {
      let { error: statusErr } = await supabase
        .from('treatment_protocols')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', treatment.id);

      if (statusErr) {
        const adminRes = await supabaseAdmin
          .from('treatment_protocols')
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', treatment.id);
        statusErr = adminRes.error;
      }

      if (statusErr) {
        // Fallback to services
        const fallbackRes = await supabase
          .from('services')
          .update({ status: nextStatus })
          .eq('id', treatment.id);
        statusErr = fallbackRes.error;
      }

      if (statusErr) {
        console.error('Status toggle error:', statusErr);
        toast.error(`Database error: ${statusErr.message}`);
        return;
      }

      toast.success(`Protocol status changed to ${nextStatus}.`);
      await fetchTreatments();
    } catch (err) {
      console.error('Error toggling status:', err);
      toast.error('Failed to change protocol status.');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 7. DELETE TREATMENT
  // ─────────────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteConfirmTreatment) return;
    setDeleting(true);
    try {
      let { error: delErr } = await supabase
        .from('treatment_protocols')
        .delete()
        .eq('id', deleteConfirmTreatment.id);

      if (delErr) {
        const adminRes = await supabaseAdmin
          .from('treatment_protocols')
          .delete()
          .eq('id', deleteConfirmTreatment.id);
        delErr = adminRes.error;
      }

      if (delErr) {
        const fallbackRes = await supabase
          .from('services')
          .delete()
          .eq('id', deleteConfirmTreatment.id);
        delErr = fallbackRes.error;
      }

      if (delErr) {
        console.error('Delete treatment error:', delErr);
        toast.error(`Failed to delete protocol: ${delErr.message}`);
        return;
      }

      toast.success(`Protocol "${deleteConfirmTreatment.protocol_title}" deleted.`);
      setDeleteConfirmTreatment(null);
      await fetchTreatments();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Unexpected error while deleting protocol.');
    } finally {
      setDeleting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 8. CATEGORY CRUD OPERATIONS
  // ─────────────────────────────────────────────────────────────
  const handleCreateCategory = async (e) => {
    if (e) e.preventDefault();
    const cleanName = newCategoryName.trim();
    if (!cleanName) {
      toast.error('Category name cannot be empty.');
      return;
    }

    const alreadyExists = categories.some(
      c => c.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (alreadyExists) {
      toast.error(`Category "${cleanName}" already exists.`);
      return;
    }

    setCategoryActionLoading(true);
    try {
      const payload = { name: cleanName, created_at: new Date().toISOString() };
      let created = null;

      const { data, error: catErr } = await supabase.from('categories').insert([payload]).select().single();
      if (!catErr && data) {
        created = data;
      } else {
        const adminRes = await supabaseAdmin.from('categories').insert([payload]).select().single();
        if (!adminRes.error && adminRes.data) created = adminRes.data;
      }

      const newCatItem = created || { id: `cat-${Date.now()}`, name: cleanName };
      const updatedList = [...categories, newCatItem].sort((a, b) => a.name.localeCompare(b.name));
      setCategories(updatedList);
      try { localStorage.setItem('bo_categories_cache', JSON.stringify(updatedList)); } catch (_) { }

      // If user was creating a treatment, set this new category as selected
      setFormData(prev => ({ ...prev, category: cleanName, category_id: newCatItem.id }));
      setNewCategoryName('');
      toast.success(`Category "${cleanName}" added.`);
    } catch (err) {
      console.error('Error adding category:', err);
      toast.error('Failed to add category: ' + (err?.message || 'Error'));
    } finally {
      setCategoryActionLoading(false);
    }
  };

  const handleUpdateCategory = async (catId, currentName) => {
    const cleanNewName = editingCategoryName.trim();
    if (!cleanNewName) {
      toast.error('Category name cannot be empty.');
      return;
    }
    if (cleanNewName.toLowerCase() === currentName.toLowerCase()) {
      setEditingCategory(null);
      return;
    }

    setCategoryActionLoading(true);
    try {
      // 1. Update in Supabase categories table
      await supabase.from('categories').update({ name: cleanNewName, updated_at: new Date().toISOString() }).eq('id', catId);

      // 2. Cascade rename on treatments using this category
      try {
        await supabase.from('treatment_protocols').update({ category: cleanNewName }).eq('category', currentName);
      } catch (_) { }

      // Update local state
      setCategories(prev =>
        prev.map(c => (c.id === catId || c.name === currentName) ? { ...c, name: cleanNewName } : c)
      );

      setTreatments(prev =>
        prev.map(t => t.category === currentName ? { ...t, category: cleanNewName } : t)
      );

      if (categoryFilter === currentName) setCategoryFilter(cleanNewName);
      if (formData.category === currentName) setFormData(f => ({ ...f, category: cleanNewName }));

      setEditingCategory(null);
      setEditingCategoryName('');
      toast.success(`Category renamed to "${cleanNewName}".`);
    } catch (err) {
      console.error('Error updating category:', err);
      toast.error('Failed to update category.');
    } finally {
      setCategoryActionLoading(false);
    }
  };

  const handlePromptDeleteCategory = (cat) => {
    const count = treatments.filter(t => t.category === cat.name).length;
    setCategoryDeleteTarget({ ...cat, count });
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryDeleteTarget) return;
    const { id, name, count } = categoryDeleteTarget;

    // Safety check: prevent deleting if protocols currently use it
    if (count > 0) {
      toast.error(`Cannot delete "${name}" because ${count} treatment protocol(s) are using it. Please reassign them first.`);
      setCategoryDeleteTarget(null);
      return;
    }

    setCategoryActionLoading(true);
    try {
      await supabase.from('categories').delete().eq('id', id);
      await supabase.from('categories').delete().eq('name', name);

      const updatedList = categories.filter(c => c.id !== id && c.name !== name);
      setCategories(updatedList);
      try { localStorage.setItem('bo_categories_cache', JSON.stringify(updatedList)); } catch (_) { }

      if (categoryFilter === name) setCategoryFilter('ALL');
      if (formData.category === name) {
        setFormData(f => ({ ...f, category: updatedList[0]?.name || '', category_id: updatedList[0]?.id || '' }));
      }

      setCategoryDeleteTarget(null);
      toast.success(`Category "${name}" deleted.`);
    } catch (err) {
      console.error('Error deleting category:', err);
      toast.error('Failed to delete category.');
    } finally {
      setCategoryActionLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 8B. DURATION CRUD OPERATIONS (SUPABASE)
  // ─────────────────────────────────────────────────────────────
  const handleCreateDuration = async (e) => {
    if (e) e.preventDefault();
    let cleanLabel = newDurationLabel.trim();
    if (!cleanLabel) {
      toast.error('Duration label cannot be empty.');
      return;
    }
    // If user enters just a number like "40", format it to "40 Mins"
    if (/^\d+$/.test(cleanLabel)) {
      cleanLabel = `${cleanLabel} Mins`;
    }

    const alreadyExists = durations.some(
      d => d.label.toLowerCase() === cleanLabel.toLowerCase()
    );
    if (alreadyExists) {
      toast.error(`Duration "${cleanLabel}" already exists.`);
      return;
    }

    setDurationActionLoading(true);
    try {
      const minutes = parseMinutesFromLabel(cleanLabel);
      const payload = {
        label: cleanLabel,
        minutes,
        created_at: new Date().toISOString()
      };
      let created = null;

      const { data, error: durErr } = await supabase.from('durations').insert([payload]).select().single();
      if (!durErr && data) {
        created = data;
      } else {
        const adminRes = await supabaseAdmin.from('durations').insert([payload]).select().single();
        if (!adminRes.error && adminRes.data) created = adminRes.data;
      }

      const newDurItem = created || { id: `dur-${Date.now()}`, label: cleanLabel, minutes };
      const updatedList = [...durations, newDurItem].sort((a, b) => (a.minutes || 0) - (b.minutes || 0));
      setDurations(updatedList);
      try { localStorage.setItem('bo_durations_cache', JSON.stringify(updatedList)); } catch (_) { }

      // Immediately select new duration in form
      setFormData(prev => ({ ...prev, duration: cleanLabel }));
      setNewDurationLabel('');
      toast.success(`Duration "${cleanLabel}" added.`);
    } catch (err) {
      console.error('Error adding duration:', err);
      toast.error('Failed to add duration: ' + (err?.message || 'Error'));
    } finally {
      setDurationActionLoading(false);
    }
  };

  const handleUpdateDuration = async (durId, currentLabel) => {
    let cleanNew = editingDurationLabel.trim();
    if (!cleanNew) {
      toast.error('Duration label cannot be empty.');
      return;
    }
    if (/^\d+$/.test(cleanNew)) {
      cleanNew = `${cleanNew} Mins`;
    }
    if (cleanNew.toLowerCase() === currentLabel.toLowerCase()) {
      setEditingDuration(null);
      return;
    }

    setDurationActionLoading(true);
    try {
      const minutes = parseMinutesFromLabel(cleanNew);
      await supabase.from('durations').update({ label: cleanNew, minutes, updated_at: new Date().toISOString() }).eq('id', durId);

      // Cascade update treatments using this duration
      try {
        await supabase.from('treatment_protocols').update({ duration: cleanNew }).eq('duration', currentLabel);
      } catch (_) { }

      setDurations(prev =>
        prev.map(d => (d.id === durId || d.label === currentLabel) ? { ...d, label: cleanNew, minutes } : d)
      );

      setTreatments(prev =>
        prev.map(t => t.duration === currentLabel ? { ...t, duration: cleanNew } : t)
      );

      if (formData.duration === currentLabel) setFormData(f => ({ ...f, duration: cleanNew }));

      setEditingDuration(null);
      setEditingDurationLabel('');
      toast.success(`Duration updated to "${cleanNew}".`);
    } catch (err) {
      console.error('Error updating duration:', err);
      toast.error('Failed to update duration.');
    } finally {
      setDurationActionLoading(false);
    }
  };

  const handlePromptDeleteDuration = (dur) => {
    const count = treatments.filter(t => t.duration === dur.label).length;
    setDurationDeleteTarget({ ...dur, count });
  };

  const handleConfirmDeleteDuration = async () => {
    if (!durationDeleteTarget) return;
    const { id, label, count } = durationDeleteTarget;

    // Safety check: prevent deleting if protocols currently use it
    if (count > 0) {
      toast.error(`Cannot delete "${label}" because ${count} treatment protocol(s) are using it. Please reassign them first.`);
      setDurationDeleteTarget(null);
      return;
    }

    setDurationActionLoading(true);
    try {
      await supabase.from('durations').delete().eq('id', id);
      await supabase.from('durations').delete().eq('label', label);

      const updatedList = durations.filter(d => d.id !== id && d.label !== label);
      setDurations(updatedList);
      try { localStorage.setItem('bo_durations_cache', JSON.stringify(updatedList)); } catch (_) { }

      if (formData.duration === label) {
        setFormData(f => ({ ...f, duration: updatedList[0]?.label || '60 Mins' }));
      }

      setDurationDeleteTarget(null);
      toast.success(`Duration "${label}" deleted.`);
    } catch (err) {
      console.error('Error deleting duration:', err);
      toast.error('Failed to delete duration.');
    } finally {
      setDurationActionLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 9. TABLE COLUMNS DEFINITION
  // ─────────────────────────────────────────────────────────────
  const columns = [
    {
      header: 'Protocol / Service',
      accessor: 'protocol_title',
      sortable: true,
      render: (row) => (
        <div
          onClick={() => setSelectedTreatment(row)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
          title={`View ${row.protocol_title} details`}
        >
          <div style={{ fontWeight: 600, color: '#0f2942', fontSize: '0.92rem' }}>
            {row.protocol_title}
          </div>
          {row.tagline && (
            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
              {row.tagline}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Category',
      accessor: 'category',
      sortable: true,
      render: (row) => (
        <span
          style={{
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#334155',
            whiteSpace: 'nowrap'
          }}
        >
          {row.category || 'General'}
        </span>
      )
    },
    {
      header: 'Duration',
      accessor: 'duration',
      render: (row) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.84rem', color: '#475569' }}>
          <Clock size={13} color="#94a3b8" />
          <span>{row.duration || '60 Mins'}</span>
        </div>
      )
    },
    {
      header: 'Price',
      accessor: 'price',
      sortable: true,
      render: (row) => (
        <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.92rem' }}>
          ${Number(row.price || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
      )
    },
    {
      header: 'Appointment Date',
      accessor: 'appointment_date',
      sortable: true,
      render: (row) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.84rem', color: '#334155' }}>
          <Calendar size={13} color="#94a3b8" />
          <span>{formatDateDisplay(row.appointment_date)}</span>
        </div>
      )
    },
    {
      header: 'Appointment Time',
      accessor: 'appointment_time',
      render: (row) => (
        <div style={{ fontSize: '0.84rem', color: '#475569', fontWeight: 500 }}>
          {row.appointment_time || '—'}
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={() => handleQuickToggleStatus(row)}
          title="Click to toggle Active / Inactive"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <AdminBadge status={row.status || 'Active'} />
        </button>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      align: 'right',
      width: '80px',
      minWidth: '80px',
      render: (row) => {
        const isOpen = actionMenuTreatmentId === row.id;
        return (
          <div
            className="protocol-action-menu-container"
            style={{ position: 'relative', display: 'inline-flex', justifyContent: 'flex-end' }}
          >
            <button
              type="button"
              className={`protocol-action-trigger-btn ${isOpen ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (actionMenuTreatmentId === row.id) {
                  setActionMenuTreatmentId(null);
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
                  setActionMenuTreatmentId(row.id);
                }
              }}
              title="Treatment Actions"
              aria-label="Treatment actions menu"
              aria-haspopup="true"
              aria-expanded={isOpen}
            >
              <MoreVertical size={16} />
            </button>

            {isOpen && actionMenuPosition && typeof document !== 'undefined' && createPortal(
              <div
                className="protocol-action-dropdown-menu"
                style={{
                  position: 'fixed',
                  top: `${actionMenuPosition.top}px`,
                  right: `${actionMenuPosition.right}px`,
                  width: '190px',
                  zIndex: 99999
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 1. View */}
                <button
                  type="button"
                  className="protocol-action-item item-view"
                  onClick={() => {
                    setActionMenuTreatmentId(null);
                    setActionMenuPosition(null);
                    setSelectedTreatment(row);
                  }}
                >
                  <Eye size={15} color="#1e5aa8" />
                  <span>View Details</span>
                </button>

                {/* 2. Edit */}
                <button
                  type="button"
                  className="protocol-action-item"
                  onClick={() => {
                    setActionMenuTreatmentId(null);
                    setActionMenuPosition(null);
                    handleOpenEditDrawer(row);
                  }}
                >
                  <Edit2 size={15} color="#475569" />
                  <span>Edit Protocol</span>
                </button>

                {/* 3. Activate / Deactivate Toggle */}
                <button
                  type="button"
                  className={`protocol-action-item ${row.status === 'Active' ? 'item-status-active' : 'item-status-inactive'}`}
                  onClick={() => {
                    setActionMenuTreatmentId(null);
                    setActionMenuPosition(null);
                    handleQuickToggleStatus(row);
                  }}
                >
                  {row.status === 'Active' ? (
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

                <div className="protocol-action-separator" />

                {/* 4. Delete */}
                <button
                  type="button"
                  className="protocol-action-item item-danger"
                  onClick={() => {
                    setActionMenuTreatmentId(null);
                    setActionMenuPosition(null);
                    setDeleteConfirmTreatment(row);
                  }}
                >
                  <Trash2 size={15} color="#dc2626" />
                  <span>Delete Protocol</span>
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
          <h1>Clinical Services & Treatment Protocols</h1>
          <p>Manage treatment definitions, pricing, durations, categories, and schedule availability.</p>
        </div>

        <div className="admin-page-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>


          <AdminButton
            variant="primary"
            onClick={handleOpenAddDrawer}
            icon={<Plus size={16} />}
          >
            Add Treatment Protocol
          </AdminButton>
        </div>
      </div>

      {/* ── Search & Filters Toolbar ── */}
      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search treatments by title, category, description..."
        hasActiveFilters={Boolean(searchTerm) || categoryFilter !== 'ALL' || statusFilter !== 'ALL'}
        onClearFilters={() => {
          setSearchTerm('');
          setCategoryFilter('ALL');
          setStatusFilter('ALL');
        }}
        filters={[
          {
            id: 'category',
            value: categoryFilter,
            onChange: setCategoryFilter,
            options: [
              { label: 'All Categories', value: 'ALL' },
              ...categories.map(c => ({ label: c.name, value: c.name }))
            ]
          },
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

      {/* ── Database-Driven Table with Pagination ── */}
      <AdminTable
        columns={columns}
        data={filteredTreatments}
        loading={loading}
        itemsPerPage={20}
        itemLabel="treatment protocols"
        emptyTitle="No treatment protocols found"
        emptyDescription="Adjust your search criteria or register a new treatment protocol."
        emptyActionLabel="Add Treatment Protocol"
        onEmptyAction={handleOpenAddDrawer}
      />

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── ADD / EDIT TREATMENT PROTOCOL RIGHT-SIDE DRAWER ──          */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <AdminDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        title={editingTreatment ? "Edit Treatment Protocol" : "Add New Treatment Protocol"}
        subtitle="Configure clinician credentials, protocol pricing, duration, and appointment timing."
        width="660px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
            <AdminButton
              variant="secondary"
              disabled={submitting}
              onClick={handleCloseDrawer}
            >
              Cancel
            </AdminButton>
            <AdminButton
              variant="primary"
              disabled={submitting}
              onClick={handleSaveTreatment}
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
              ) : editingTreatment ? (
                "Update Protocol"
              ) : (
                "Create Treatment Protocol"
              )}
            </AdminButton>
          </div>
        }
      >
        <form
          autoComplete="off"
          onSubmit={handleSaveTreatment}
          style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}
        >
          {/* Section: Protocol Primary Details */}
          <div className="admin-form-grid-2">
            {/* Protocol Title * */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Protocol / Service Name<span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                required
                name="treatment_protocol_title"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                className={`admin-form-input ${formErrors.protocol_title ? 'error' : ''}`}
                placeholder="e.g. Hydrafacial Deluxe Pro"
                value={formData.protocol_title}
                onChange={(e) => {
                  setFormData({ ...formData, protocol_title: e.target.value });
                  if (formErrors.protocol_title) {
                    setFormErrors(prev => ({ ...prev, protocol_title: null }));
                  }
                }}
              />
              {formErrors.protocol_title && (
                <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '4px' }}>
                  {formErrors.protocol_title}
                </div>
              )}
            </div>

            {/* Category * with Quick Add Button */}
            <div className="admin-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="admin-form-label" style={{ margin: 0 }}>
                  Category <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1e5aa8',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  + Manage Categories
                </button>
              </div>
              <ShadcnSelect
                value={formData.category}
                onChange={(val) => {
                  const match = categories.find(c => c.name === val);
                  setFormData({ ...formData, category: val, category_id: match?.id || '' });
                  if (formErrors.category) {
                    setFormErrors(prev => ({ ...prev, category: null }));
                  }
                }}
                options={categoryOptions}
                placeholder="Select a category..."
              />
              {formErrors.category && (
                <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '4px' }}>
                  {formErrors.category}
                </div>
              )}
            </div>

            {/* Price ($ USD) * */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Price ($ USD) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748b',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }}
                >
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  name="treatment_price"
                  autoComplete="off"
                  className={`admin-form-input ${formErrors.price ? 'error' : ''}`}
                  style={{ paddingLeft: '28px' }}
                  placeholder="185.00"
                  value={formData.price}
                  onChange={(e) => {
                    setFormData({ ...formData, price: e.target.value });
                    if (formErrors.price) {
                      setFormErrors(prev => ({ ...prev, price: null }));
                    }
                  }}
                />
              </div>
              {formErrors.price && (
                <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '4px' }}>
                  {formErrors.price}
                </div>
              )}
            </div>

            {/* Duration * with Quick Manage Button */}
            <div className="admin-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="admin-form-label" style={{ margin: 0 }}>
                  Duration <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsDurationModalOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1e5aa8',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  + Manage Durations
                </button>
              </div>
              <ShadcnSelect
                value={formData.duration}
                onChange={(val) => {
                  setFormData({ ...formData, duration: val });
                  if (formErrors.duration) {
                    setFormErrors(prev => ({ ...prev, duration: null }));
                  }
                }}
                options={durationOptions}
              />
              {formErrors.duration && (
                <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '4px' }}>
                  {formErrors.duration}
                </div>
              )}
            </div>

            {/* Status * (Active / Inactive) */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Status <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <ShadcnSelect
                value={formData.status}
                onChange={(val) => setFormData({ ...formData, status: val })}
                options={[
                  { label: 'Active', value: 'Active' },
                  { label: 'Inactive', value: 'Inactive' }
                ]}
              />
            </div>

            {/* Appointment Date * */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Appointment Date <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="date"
                required
                name="treatment_appointment_date"
                autoComplete="off"
                className={`admin-form-input ${formErrors.appointment_date ? 'error' : ''}`}
                value={formData.appointment_date}
                onChange={(e) => {
                  setFormData({ ...formData, appointment_date: e.target.value });
                  if (formErrors.appointment_date) {
                    setFormErrors(prev => ({ ...prev, appointment_date: null }));
                  }
                }}
              />
              {formErrors.appointment_date && (
                <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '4px' }}>
                  {formErrors.appointment_date}
                </div>
              )}
            </div>

            {/* Appointment Time * (Custom 3-Column TimePicker) */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Appointment Time <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <TimePicker
                value={formData.appointment_time}
                onChange={(val) => {
                  setFormData({ ...formData, appointment_time: val });
                  if (formErrors.appointment_time) {
                    setFormErrors(prev => ({ ...prev, appointment_time: null }));
                  }
                }}
                placeholder="Select appointment time..."
                error={Boolean(formErrors.appointment_time)}
              />
              {formErrors.appointment_time && (
                <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '4px' }}>
                  {formErrors.appointment_time}
                </div>
              )}
            </div>
          </div>

          {/* Tagline (Optional) */}
          <div className="admin-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="admin-form-label">Tagline</label>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Optional</span>
            </div>
            <input
              type="text"
              name="treatment_tagline"
              autoComplete="off"
              spellCheck="false"
              className="admin-form-input"
              placeholder="e.g. Deep Dermal Cleanse & Vortex Infusion"
              value={formData.tagline}
              onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
            />
          </div>

          {/* Clinical Description (Optional) */}
          <div className="admin-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="admin-form-label">Clinical Description</label>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Optional</span>
            </div>
            <textarea
              className="admin-form-textarea"
              rows="4"
              name="treatment_description"
              autoComplete="off"
              spellCheck="false"
              placeholder="Describe protocol methodology, physiological mechanisms, clinical indications, and expected patient outcomes..."
              value={formData.clinical_description}
              onChange={(e) => setFormData({ ...formData, clinical_description: e.target.value })}
            />
          </div>
        </form>
      </AdminDrawer>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── VIEW TREATMENT OVERVIEW RIGHT-SIDE DRAWER ──              */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <AdminDrawer
        isOpen={Boolean(selectedTreatment)}
        onClose={() => setSelectedTreatment(null)}
        title="Protocol Overview"
        subtitle={selectedTreatment?.protocol_title}
        width="560px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <AdminButton
              variant="secondary"
              onClick={() => {
                const tr = selectedTreatment;
                setSelectedTreatment(null);
                handleOpenEditDrawer(tr);
              }}
              icon={<Edit2 size={14} />}
            >
              Edit Protocol
            </AdminButton>
            <AdminButton variant="primary" onClick={() => setSelectedTreatment(null)}>
              Done
            </AdminButton>
          </div>
        }
      >
        {selectedTreatment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Identity Card */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '18px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Status
                </span>
                <div style={{ marginTop: '4px' }}>
                  <AdminBadge status={selectedTreatment.status} />
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Standard Fee
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#15803d' }}>
                  ${Number(selectedTreatment.price || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Protocol Information Box */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <div style={{ fontSize: '0.72rem', color: '#1e5aa8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                {selectedTreatment.category}
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', color: '#0f2942', fontWeight: 700 }}>
                {selectedTreatment.protocol_title}
              </h3>
              {selectedTreatment.tagline && (
                <p style={{ margin: '0 0 12px', fontSize: '0.86rem', color: '#475569', fontStyle: 'italic' }}>
                  "{selectedTreatment.tagline}"
                </p>
              )}
              {selectedTreatment.clinical_description ? (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155', lineHeight: 1.6 }}>
                  {selectedTreatment.clinical_description}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  No clinical description provided.
                </p>
              )}
            </div>

            {/* Clinical Specifications */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '0.88rem', color: '#0f2942', fontWeight: 700 }}>
                Appointment & Scheduling Parameters
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.84rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Category</span>
                  <span style={{ fontWeight: 600, color: '#0f2942' }}>{selectedTreatment.category}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Protocol Duration</span>
                  <span style={{ fontWeight: 600, color: '#0f2942' }}>{selectedTreatment.duration || '60 Mins'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Appointment Date</span>
                  <span style={{ fontWeight: 600, color: '#0f2942' }}>{formatDateDisplay(selectedTreatment.appointment_date)}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Appointment Time</span>
                  <span style={{ fontWeight: 600, color: '#0f2942' }}>{selectedTreatment.appointment_time || '—'}</span>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', fontSize: '0.75rem', color: '#94a3b8' }}>
              <span>Created: {selectedTreatment.created_at ? new Date(selectedTreatment.created_at).toLocaleDateString() : '—'}</span>
              <span>Last Updated: {selectedTreatment.updated_at ? new Date(selectedTreatment.updated_at).toLocaleDateString() : '—'}</span>
            </div>
          </div>
        )}
      </AdminDrawer>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── MANAGE CATEGORIES MODAL (DYNAMIC CRUD) ──                   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <AdminModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
          setNewCategoryName('');
          setCategoryDeleteTarget(null);
        }}
        title="Manage Treatment Categories"
        maxWidth="540px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Create Category Form */}
          <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="admin-form-input"
              placeholder="e.g. Laser Resurfacing & Peels"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              disabled={categoryActionLoading}
              style={{ flex: 1 }}
            />
            <AdminButton
              type="submit"
              variant="primary"
              disabled={categoryActionLoading || !newCategoryName.trim()}
              icon={<Plus size={15} />}
            >
              Add Category
            </AdminButton>
          </form>

          {/* Categories List */}
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
              Active Clinical Categories ({categories.length})
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              {categories.map((cat) => {
                const count = treatments.filter(t => t.category === cat.name).length;
                const isEditing = editingCategory?.id === cat.id;

                return (
                  <div
                    key={cat.id || cat.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      background: '#ffffff'
                    }}
                  >
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, marginRight: '10px' }}>
                        <input
                          type="text"
                          className="admin-form-input"
                          style={{ padding: '6px 10px', fontSize: '0.84rem' }}
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          autoFocus
                          disabled={categoryActionLoading}
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCategory(cat.id, cat.name)}
                          disabled={categoryActionLoading}
                          style={{
                            background: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            cursor: 'pointer'
                          }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCategory(null)}
                          disabled={categoryActionLoading}
                          style={{
                            background: '#f1f5f9',
                            color: '#64748b',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f2942' }}>
                          {cat.name}
                        </span>
                        <span
                          style={{
                            marginLeft: '8px',
                            fontSize: '0.72rem',
                            color: count > 0 ? '#1e5aa8' : '#94a3b8',
                            background: count > 0 ? '#eff6ff' : '#f8fafc',
                            padding: '2px 7px',
                            borderRadius: '9999px',
                            fontWeight: 600
                          }}
                        >
                          {count} {count === 1 ? 'protocol' : 'protocols'}
                        </span>
                      </div>
                    )}

                    {!isEditing && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(cat);
                            setEditingCategoryName(cat.name);
                          }}
                          title="Rename Category"
                          style={{
                            background: 'transparent',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '5px 7px',
                            cursor: 'pointer',
                            color: '#475569'
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePromptDeleteCategory(cat)}
                          title="Delete Category"
                          style={{
                            background: 'transparent',
                            border: '1px solid #fee2e2',
                            borderRadius: '6px',
                            padding: '5px 7px',
                            cursor: 'pointer',
                            color: '#dc2626'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
            <AdminButton
              variant="secondary"
              onClick={() => {
                setIsCategoryModalOpen(false);
                setEditingCategory(null);
                setNewCategoryName('');
              }}
            >
              Done
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      {/* ── Category Safe Delete Confirmation Dialog ── */}
      <AdminConfirmDialog
        isOpen={Boolean(categoryDeleteTarget)}
        onClose={() => setCategoryDeleteTarget(null)}
        onConfirm={handleConfirmDeleteCategory}
        title="Delete Category"
        message={
          categoryDeleteTarget?.count > 0
            ? `Cannot delete "${categoryDeleteTarget.name}" because ${categoryDeleteTarget.count} treatment protocol(s) are actively assigned to it. Please reassign or delete those protocols first.`
            : `Are you sure you want to delete the category "${categoryDeleteTarget?.name}"? This action cannot be undone.`
        }
      />

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── MANAGE DURATIONS MODAL (DYNAMIC CRUD) ──                    */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <AdminModal
        isOpen={isDurationModalOpen}
        onClose={() => {
          setIsDurationModalOpen(false);
          setEditingDuration(null);
          setNewDurationLabel('');
          setDurationDeleteTarget(null);
        }}
        title="Manage Treatment Durations"
        maxWidth="540px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Create Duration Form */}
          <form onSubmit={handleCreateDuration} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="admin-form-input"
              placeholder="e.g. 20 Mins or 150 Mins"
              value={newDurationLabel}
              onChange={(e) => setNewDurationLabel(e.target.value)}
              disabled={durationActionLoading}
              style={{ flex: 1 }}
            />
            <AdminButton
              type="submit"
              variant="primary"
              disabled={durationActionLoading || !newDurationLabel.trim()}
              icon={<Plus size={15} />}
            >
              Add Duration
            </AdminButton>
          </form>

          {/* Durations List */}
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
              Active Clinical Durations ({durations.length})
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              {durations.map((dur) => {
                const count = treatments.filter(t => t.duration === dur.label).length;
                const isEditing = editingDuration?.id === dur.id;

                return (
                  <div
                    key={dur.id || dur.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      background: '#ffffff'
                    }}
                  >
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, marginRight: '10px' }}>
                        <input
                          type="text"
                          className="admin-form-input"
                          style={{ padding: '6px 10px', fontSize: '0.84rem' }}
                          value={editingDurationLabel}
                          onChange={(e) => setEditingDurationLabel(e.target.value)}
                          autoFocus
                          disabled={durationActionLoading}
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateDuration(dur.id, dur.label)}
                          disabled={durationActionLoading}
                          style={{
                            background: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            cursor: 'pointer'
                          }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDuration(null)}
                          disabled={durationActionLoading}
                          style={{
                            background: '#f1f5f9',
                            color: '#64748b',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={14} color="#64748b" />
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f2942' }}>
                          {dur.label}
                        </span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: count > 0 ? '#1e5aa8' : '#94a3b8',
                            background: count > 0 ? '#eff6ff' : '#f8fafc',
                            padding: '2px 7px',
                            borderRadius: '9999px',
                            fontWeight: 600
                          }}
                        >
                          {count} {count === 1 ? 'protocol' : 'protocols'}
                        </span>
                      </div>
                    )}

                    {!isEditing && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDuration(dur);
                            setEditingDurationLabel(dur.label);
                          }}
                          title="Rename Duration"
                          style={{
                            background: 'transparent',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '5px 7px',
                            cursor: 'pointer',
                            color: '#475569'
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePromptDeleteDuration(dur)}
                          title="Delete Duration"
                          style={{
                            background: 'transparent',
                            border: '1px solid #fee2e2',
                            borderRadius: '6px',
                            padding: '5px 7px',
                            cursor: 'pointer',
                            color: '#dc2626'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
            <AdminButton
              variant="secondary"
              onClick={() => {
                setIsDurationModalOpen(false);
                setEditingDuration(null);
                setNewDurationLabel('');
              }}
            >
              Done
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      {/* ── Duration Safe Delete Confirmation Dialog ── */}
      <AdminConfirmDialog
        isOpen={Boolean(durationDeleteTarget)}
        onClose={() => setDurationDeleteTarget(null)}
        onConfirm={handleConfirmDeleteDuration}
        title="Delete Duration"
        message={
          durationDeleteTarget?.count > 0
            ? `Cannot delete "${durationDeleteTarget.label}" because ${durationDeleteTarget.count} treatment protocol(s) are actively using this duration. Please reassign those protocols first.`
            : `Are you sure you want to delete the duration "${durationDeleteTarget?.label}"? This action cannot be undone.`
        }
      />

      {/* ── Treatment Protocol Delete Confirmation Dialog ── */}
      <AdminConfirmDialog
        isOpen={Boolean(deleteConfirmTreatment)}
        onClose={() => setDeleteConfirmTreatment(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Treatment Protocol"
        message={`Are you sure you want to permanently delete "${deleteConfirmTreatment?.protocol_title}"? It will no longer be visible or bookable.`}
      />
    </div>
  );
};
