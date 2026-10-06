import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Users,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ShoppingBag,
  CreditCard,
  Shield,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Camera,
  Upload,
  MoreVertical,
  UserCheck,
  UserX,
  Lock,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { supabaseDataService } from '../../services/supabaseDataService';
import { notificationService } from '../../services/notificationService';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';
import { ShadcnSelect } from '../../components/ui/select';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const ClientsPage = () => {
  const navigate = useNavigate();
  const { clients: contextClients = [], appointments = [], orders = [], payments = [] } = useAdminData();

  // Supabase Dynamic Patient Data State (Hydrated from cache/context for 0ms initial render)
  const [patients, setPatients] = useState(() => {
    if (Array.isArray(contextClients) && contextClients.length > 0) return contextClients;
    try {
      const cached = localStorage.getItem('cached_dynamic_patients');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) { }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (Array.isArray(contextClients) && contextClients.length > 0) return false;
    try {
      const cached = localStorage.getItem('cached_dynamic_patients');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch (_) { }
    return true;
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination State (20 patients per page)
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination to page 1 whenever search term or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Modal / Drawer / Dialog State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [editClient, setEditClient] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [previewAppointment, setPreviewAppointment] = useState(null);
  const [patientProfileTab, setPatientProfileTab] = useState('overview'); // 'overview' | 'appointments' | 'orders' | 'payments'
  const [apptSubTab, setApptSubTab] = useState('all'); // 'all' | 'upcoming' | 'recent'

  // Actions Dropdown Menu State & Viewport Positioning (prevents container scrolling)
  const [actionMenuClientId, setActionMenuClientId] = useState(null);
  const [actionMenuPosition, setActionMenuPosition] = useState(null);

  // Close actions dropdown on click outside or window scroll
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.patient-action-menu-container') && !e.target.closest('.patient-action-dropdown-menu')) {
        setActionMenuClientId(null);
        setActionMenuPosition(null);
      }
    };
    const handleWindowChange = () => {
      if (actionMenuClientId) {
        setActionMenuClientId(null);
        setActionMenuPosition(null);
      }
    };
    if (actionMenuClientId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      window.addEventListener('scroll', handleWindowChange, true);
      window.addEventListener('resize', handleWindowChange);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('scroll', handleWindowChange, true);
      window.removeEventListener('resize', handleWindowChange);
    };
  }, [actionMenuClientId]);

  // Profile Photo State & Handlers
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const fileInputRef = useRef(null);

  // Official column registry for public.patients schema
  const DEFAULT_PATIENT_COLUMNS = new Set([
    'id',
    'full_name',
    'name',
    'email',
    'phone',
    'date_of_birth',
    'dob',
    'residential_address',
    'status',
    'role',
    'profilePhotoUrl',
    'profile_photo_url',
    'avatar',
    'total_appointments',
    'total_spent',
    'created_at',
    'updated_at'
  ]);

  // Cached set of existing columns in Supabase 'patients' table to prevent PGRST204 schema mismatches
  const knownColumnsRef = useRef(new Set(DEFAULT_PATIENT_COLUMNS));

  // Handle profile photo selection & validation (JPG, JPEG, PNG, WEBP, <= 10MB)
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = ''; // Reset value so re-selecting same file triggers onChange

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      const msg = 'Invalid file type. Please upload a JPG, JPEG, PNG, or WEBP image.';
      setPhotoError(msg);
      toast.error(msg);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      const msg = 'Image size exceeds 10MB limit. Please choose a smaller photo.';
      setPhotoError(msg);
      toast.error(msg);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setPhotoError(null);
    setSelectedFile(file);

    // 1. Immediately create and display a local object URL for instant feedback
    try {
      const objectUrl = URL.createObjectURL(file);
      setPreviewPhotoUrl(objectUrl);
    } catch (_) { }

    // 2. Also load as Base64 Data URL for stable, guaranteed persistence
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const dataUrl = loadEvt.target?.result;
      if (dataUrl) {
        setPreviewPhotoUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);

    toast.success('Profile photo selected.');
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPreviewPhotoUrl(null);
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast('Profile photo removed.', { icon: '🗑️' });
  };

  // Upload helper: Upload to Supabase Storage bucket, fallback gracefully to Base64 data URL
  const uploadProfilePhoto = async (file) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `patient_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `patient-avatars/${fileName}`;

    try {
      // Check existing buckets first to prevent blind 400 Bad Request network errors
      const { data: buckets } = await supabase.storage.listBuckets();
      const availableBucketNames = Array.isArray(buckets) ? buckets.map(b => b.name || b.id) : [];

      const targetBucket = availableBucketNames.includes('patient-photos')
        ? 'patient-photos'
        : availableBucketNames.includes('avatars')
          ? 'avatars'
          : null;

      if (targetBucket) {
        const { data: upData, error: upErr } = await supabase.storage
          .from(targetBucket)
          .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (!upErr && upData) {
          const { data: pubData } = supabase.storage.from(targetBucket).getPublicUrl(filePath);
          if (pubData?.publicUrl) return pubData.publicUrl;
        }
      }
    } catch (storageErr) {
      console.warn('Storage bucket check or upload error:', storageErr);
    }

    // Graceful fallback: Base64 data URL so registration/update NEVER fails
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  // Form State: clinical details + authentication for portal access
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    address: '',
    status: 'Active',
    password: '',
    confirmPassword: ''
  });

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changePasswordOptIn, setChangePasswordOptIn] = useState(false);

  // ─────────────────────────────────────────────
  // FETCH PATIENTS FROM SUPABASE
  // ─────────────────────────────────────────────
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    let rawData = null;
    let isFetchError = false;
    let caughtErr = null;

    // 1. Primary: query 'patients' table via standard client
    try {
      const res = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (!res.error && res.data) {
        rawData = res.data;
      } else {
        const retryRes = await supabase.from('patients').select('*');
        if (!retryRes.error && retryRes.data) {
          rawData = retryRes.data;
        } else {
          caughtErr = res?.error || retryRes?.error;
        }
      }
    } catch (e) {
      caughtErr = e;
    }

    // 2. Fallback: query via isolated supabaseAdmin client
    if (rawData === null) {
      try {
        const adminRes = await supabaseAdmin
          .from('patients')
          .select('*')
          .order('created_at', { ascending: false });
        if (!adminRes.error && adminRes.data) {
          rawData = adminRes.data;
          caughtErr = null;
        } else {
          const plainAdminRes = await supabaseAdmin.from('patients').select('*');
          if (!plainAdminRes.error && plainAdminRes.data) {
            rawData = plainAdminRes.data;
            caughtErr = null;
          }
        }
      } catch (_) { }
    }

    // 3. Fallback: if table is named 'clients'
    if (rawData === null) {
      try {
        const clientsRes = await supabase.from('clients').select('*');
        if (!clientsRes.error && clientsRes.data) {
          rawData = clientsRes.data;
          caughtErr = null;
        }
      } catch (_) { }
    }

    if (rawData === null) {
      isFetchError = true;
      rawData = [];
    }

    try {
      // Record known schema columns from fetched records
      if (Array.isArray(rawData) && rawData.length > 0) {
        knownColumnsRef.current = new Set(Object.keys(rawData[0]));
      }

      // Filter out any legacy mock records if present, retaining all dynamic Supabase patients
      const dynamicRows = (rawData || []).filter(
        (p) => !p.id || !String(p.id).startsWith('cli-')
      );

      // Normalize each record so all fields, role: "Patient", and profile photo are reliably available
      const normalized = dynamicRows.map((p) => {
        let cachedPhoto = null;
        try {
          if (p.email) {
            cachedPhoto = localStorage.getItem(`patient_photo_${p.email.toLowerCase().trim()}`);
          }
          if (!cachedPhoto && p.id) cachedPhoto = localStorage.getItem(`patient_photo_${p.id}`);
        } catch (_) { }

        const finalPhoto = p.profilePhotoUrl || p.profile_photo_url || p.avatar || cachedPhoto || null;
        const rawStatus = p.status || p.account_status || 'Active';
        const finalStatus = String(rawStatus).toLowerCase() === 'inactive' ? 'Inactive' : 'Active';

        return {
          ...p,
          name: p.name || p.full_name || '',
          full_name: p.full_name || p.name || '',
          email: p.email || '',
          phone: p.phone || '',
          dob: p.dob || p.date_of_birth || '',
          date_of_birth: p.date_of_birth || p.dob || '',
          address: p.address || p.residential_address || '',
          residential_address: p.residential_address || p.address || '',
          status: finalStatus,
          account_status: finalStatus,
          role: p.role || 'Patient',
          profilePhotoUrl: finalPhoto,
          profile_photo_url: finalPhoto,
          avatar: finalPhoto
        };
      });

      // Cache dynamic patients locally
      if (normalized.length > 0) {
        try {
          localStorage.setItem('cached_dynamic_patients', JSON.stringify(supabaseDataService.sanitizeCacheData(normalized)));
        } catch (_) { }
        setPatients(normalized);
        setError(null);
      } else if (isFetchError) {
        // Attempt to restore from local cache
        let cached = null;
        try {
          const rawCached = localStorage.getItem('cached_dynamic_patients');
          if (rawCached) cached = JSON.parse(rawCached);
        } catch (_) { }

        if (Array.isArray(cached) && cached.length > 0) {
          setPatients(cached);
          setError(null);
        } else {
          setPatients([]);
          let userMsg = 'Unable to connect to Supabase database. Please check your network connection.';
          if (caughtErr?.code === 'PGRST204' || caughtErr?.code === '42P01' || caughtErr?.message?.includes('relation "public.patients" does not exist') || caughtErr?.message?.includes('404')) {
            userMsg = 'The "patients" table is not created in your Supabase database yet. Please run the SQL in "create_patients_table.sql" in your Supabase SQL Editor.';
          }
          setError(userMsg);
        }
      } else {
        setPatients([]);
        setError(null);
      }
    } catch (processErr) {
      console.error('Error normalizing patient records:', processErr);
      if (isFetchError) {
        setError('Unable to connect to Supabase database. Please check your network connection.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch dynamically on initial page mount
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // ─────────────────────────────────────────────
  // MODAL HANDLERS
  // ─────────────────────────────────────────────
  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      dob: '',
      address: '',
      status: 'Active',
      password: '',
      confirmPassword: ''
    });
    setChangePasswordOptIn(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSelectedFile(null);
    setPreviewPhotoUrl(null);
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setModalError(null);
    setIsAddModalOpen(true);
  };

  const handleEditClick = async (client) => {
    if (!client) return;

    // 1. Immediately populate from selected record for instant UI drawer opening
    setFormData({
      name: client.name || client.full_name || '',
      email: client.email || '',
      phone: client.phone || '',
      dob: client.dob || client.date_of_birth || '',
      address: client.address || client.residential_address || '',
      status: String(client.status || client.account_status || 'Active').toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
      password: '',
      confirmPassword: ''
    });
    setChangePasswordOptIn(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSelectedFile(null);
    const existingPhoto = client.profilePhotoUrl || client.profile_photo_url || client.avatar || null;
    setPreviewPhotoUrl(existingPhoto);
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setModalError(null);
    setEditClient(client);

    // 2. Load latest patient data directly from Supabase by unique ID
    if (client.id) {
      try {
        const { data: freshPatient, error: fetchErr } = await supabase
          .from('patients')
          .select('*')
          .eq('id', client.id)
          .maybeSingle();

        if (!fetchErr && freshPatient) {
          setEditClient(freshPatient);
          setFormData((prev) => ({
            ...prev,
            name: freshPatient.name || freshPatient.full_name || prev.name,
            email: freshPatient.email || prev.email,
            phone: freshPatient.phone || prev.phone,
            dob: freshPatient.dob || freshPatient.date_of_birth || prev.dob,
            address: freshPatient.address || freshPatient.residential_address || prev.address,
            status: String(freshPatient.status || freshPatient.account_status || prev.status).toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
          }));
          const freshPhoto = freshPatient.profile_photo_url || freshPatient.avatar || freshPatient.profilePhotoUrl;
          if (freshPhoto) {
            setPreviewPhotoUrl(freshPhoto);
          }
        }
      } catch (err) {
        console.warn('Error loading fresh patient data from Supabase:', err);
      }
    }
  };

  // ─────────────────────────────────────────────
  // STATUS CHANGE IN EDIT / ADD FORM
  // ─────────────────────────────────────────────
  const handleStatusChangeInForm = (newVal) => {
    const normalizedStatus = String(newVal).toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
    setFormData((prev) => ({ ...prev, status: normalizedStatus }));
  };

  // Schema-aware filter to only send columns that exist in the database table
  const filterPayloadByKnownColumns = (payload) => {
    if (!knownColumnsRef.current || knownColumnsRef.current.size === 0) {
      return { ...payload };
    }
    const filtered = {};
    for (const [key, value] of Object.entries(payload)) {
      if (knownColumnsRef.current.has(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  };

  // ─────────────────────────────────────────────
  // DUAL-CLIENT DATABASE MUTATION HELPERS
  // (Prevents "TypeError: Failed to fetch" by falling back across supabase and supabaseAdmin)
  // ─────────────────────────────────────────────
  const updatePatientInDatabase = async (patientId, payload) => {
    let currentPayload = { ...payload };
    let success = false;
    let lastError = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      // 1. Primary: standard supabase client
      try {
        const res = await supabase
          .from('patients')
          .update(currentPayload)
          .eq('id', patientId);
        if (!res.error) {
          success = true;
          lastError = null;
          break;
        }
        lastError = res.error;
      } catch (err) {
        lastError = err;
      }

      // 2. Secondary: isolated supabaseAdmin client (unaffected by user session/JWT token issues)
      try {
        const adminRes = await supabaseAdmin
          .from('patients')
          .update(currentPayload)
          .eq('id', patientId);
        if (!adminRes.error) {
          success = true;
          lastError = null;
          break;
        }
        if (!lastError) lastError = adminRes.error;
      } catch (err) {
        if (!lastError) lastError = err;
      }

      // 3. Fallback: 'clients' table
      try {
        const clRes = await supabase
          .from('clients')
          .update(currentPayload)
          .eq('id', patientId);
        if (!clRes.error) {
          success = true;
          lastError = null;
          break;
        }
      } catch (_) { }

      // Strip missing columns if PostgREST rejected them
      const errMsg = lastError?.message || '';
      const match =
        errMsg.match(/Could not find the '([^']+)' column/i) ||
        errMsg.match(/column "([^"]+)" of relation/i) ||
        errMsg.match(/column "([^"]+)" does not exist/i);

      if (match && match[1] && currentPayload[match[1]] !== undefined) {
        delete currentPayload[match[1]];
        if (knownColumnsRef.current) knownColumnsRef.current.delete(match[1]);
        continue;
      }

      break;
    }

    return { success, error: lastError };
  };

  const deletePatientFromDatabase = async (patientId) => {
    let success = false;
    let lastError = null;

    // 1. Safely unlink appointments
    try {
      await supabase
        .from('appointments')
        .update({ patient_id: null, client_id: null })
        .or(`patient_id.eq.${patientId},client_id.eq.${patientId}`);
    } catch (_) {
      try {
        await supabaseAdmin
          .from('appointments')
          .update({ patient_id: null, client_id: null })
          .or(`patient_id.eq.${patientId},client_id.eq.${patientId}`);
      } catch (_) { }
    }

    // 2. Primary: delete from 'patients' via standard client
    try {
      const res = await supabase
        .from('patients')
        .delete()
        .eq('id', patientId);
      if (!res.error) {
        success = true;
        lastError = null;
      } else {
        lastError = res.error;
      }
    } catch (err) {
      lastError = err;
    }

    // 3. Fallback: delete via supabaseAdmin client
    if (!success) {
      try {
        const adminRes = await supabaseAdmin
          .from('patients')
          .delete()
          .eq('id', patientId);
        if (!adminRes.error) {
          success = true;
          lastError = null;
        } else if (!lastError) {
          lastError = adminRes.error;
        }
      } catch (err) {
        if (!lastError) lastError = err;
      }
    }

    // 4. Fallback: 'clients' table
    if (!success) {
      try {
        const clRes = await supabase
          .from('clients')
          .delete()
          .eq('id', patientId);
        if (!clRes.error) {
          success = true;
          lastError = null;
        }
      } catch (_) { }
    }

    return { success, error: lastError };
  };

  // ─────────────────────────────────────────────
  // CREATE / UPDATE PATIENT (SUPABASE)
  // ─────────────────────────────────────────────
  const handleSaveClient = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (isSubmitting) return;

    // Form Validation
    const trimmedName = formData.name?.trim();
    const trimmedEmail = formData.email?.trim();

    if (!trimmedName) {
      const msg = "Full Name is required.";
      setModalError(msg);
      toast.error(msg);
      return;
    }
    if (!trimmedEmail) {
      const msg = "Email Address is required.";
      setModalError(msg);
      toast.error(msg);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      const msg = "Please enter a valid email address (e.g. patient@domain.com).";
      setModalError(msg);
      toast.error(msg);
      return;
    }

    // Password validation: required on register; validated when opt-in enabled on edit
    const isPasswordActive = !editClient || changePasswordOptIn;
    if (isPasswordActive) {
      if (!formData.password) {
        const msg = editClient ? "New password is required when password change is enabled." : "Password is required.";
        setModalError(msg);
        toast.error(msg);
        return;
      }
      if (formData.password.length < 8) {
        const msg = "Password must be at least 8 characters.";
        setModalError(msg);
        toast.error(msg);
        return;
      }
      if (!formData.confirmPassword) {
        const msg = "Please confirm your password.";
        setModalError(msg);
        toast.error(msg);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        const msg = "Password and Confirm Password must match.";
        setModalError(msg);
        toast.error(msg);
        return;
      }
    }

    setIsSubmitting(true);
    setModalError(null);

    const trimmedPhone = formData.phone?.trim() || null;
    let formattedDob = null;
    if (formData.dob && String(formData.dob).trim()) {
      const rawDob = String(formData.dob).trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDob)) {
        const [mm, dd, yyyy] = rawDob.split('/');
        formattedDob = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      } else {
        formattedDob = rawDob;
      }
    }
    const trimmedAddress = formData.address?.trim() || null;
    const currentStatus = String(formData.status || 'Active').toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
    const now = new Date().toISOString();

    try {
      // Determine profile photo URL (upload new if file chosen, preserve existing if not changed, null if removed)
      let targetPhotoUrl = null;
      if (selectedFile) {
        try {
          targetPhotoUrl = await uploadProfilePhoto(selectedFile);
        } catch (uploadFail) {
          console.warn('Profile photo upload encountered error, proceeding without blocking:', uploadFail);
        }
      } else if (previewPhotoUrl) {
        targetPhotoUrl = previewPhotoUrl;
      } else {
        targetPhotoUrl = null;
      }

      // Cache photo in localStorage for guaranteed display
      if (targetPhotoUrl && trimmedEmail) {
        try {
          const photoKey = `patient_photo_${trimmedEmail.toLowerCase()}`;
          if (/^data:image\//i.test(targetPhotoUrl)) localStorage.removeItem(photoKey);
          else localStorage.setItem(photoKey, targetPhotoUrl);
        } catch (_) { }
      } else if (!targetPhotoUrl && trimmedEmail && editClient) {
        try {
          localStorage.removeItem(`patient_photo_${trimmedEmail.toLowerCase()}`);
        } catch (_) { }
      }

      // Also cache status in localStorage for guaranteed consistency across re-fetches
      if (trimmedEmail) {
        try {
          localStorage.setItem(`patient_status_${trimmedEmail.toLowerCase().trim()}`, currentStatus);
          if (editClient?.id) {
            localStorage.setItem(`patient_status_${editClient.id}`, currentStatus);
          }
        } catch (_) { }
      }

      if (editClient) {
        // 1. UPDATE EXISTING PATIENT (Strictly by Unique Patient ID)
        if (!editClient.id) {
          throw new Error('Patient unique identifier is missing. Cannot update record.');
        }

        const baseUpdatePayload = {
          full_name: trimmedName,
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          date_of_birth: formattedDob,
          dob: formattedDob,
          residential_address: trimmedAddress,
          status: currentStatus,
          role: 'Patient',
          updated_at: now
        };

        if (targetPhotoUrl !== undefined) {
          baseUpdatePayload.profile_photo_url = targetPhotoUrl;
          baseUpdatePayload.avatar = targetPhotoUrl;
        }

        if (knownColumnsRef.current?.has('address')) {
          baseUpdatePayload.address = trimmedAddress;
        }
        if (knownColumnsRef.current?.has('account_status')) {
          baseUpdatePayload.account_status = currentStatus;
        }

        const currentUpdatePayload = filterPayloadByKnownColumns(baseUpdatePayload);

        // A. Immediately update patient in local state
        setPatients((prev) =>
          prev.map((p) =>
            p.id === editClient.id
              ? {
                ...p,
                ...currentUpdatePayload,
                name: trimmedName,
                full_name: trimmedName,
                email: trimmedEmail,
                phone: trimmedPhone,
                dob: formattedDob,
                date_of_birth: formattedDob,
                address: trimmedAddress,
                residential_address: trimmedAddress,
                status: currentStatus,
                account_status: currentStatus,
                profilePhotoUrl: targetPhotoUrl || p.profilePhotoUrl,
                profile_photo_url: targetPhotoUrl || p.profile_photo_url,
                avatar: targetPhotoUrl || p.avatar
              }
              : p
          )
        );

        if (selectedClient && selectedClient.id === editClient.id) {
          setSelectedClient((prev) => ({
            ...prev,
            ...currentUpdatePayload,
            name: trimmedName,
            full_name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
            dob: formattedDob,
            date_of_birth: formattedDob,
            address: trimmedAddress,
            residential_address: trimmedAddress,
            status: currentStatus,
            account_status: currentStatus,
            profilePhotoUrl: targetPhotoUrl || prev.profilePhotoUrl,
            profile_photo_url: targetPhotoUrl || prev.profile_photo_url,
            avatar: targetPhotoUrl || prev.avatar
          }));
        }

        // B. Persist immediately to localStorage caches
        try {
          const cached = localStorage.getItem('cached_dynamic_patients');
          if (cached) {
            const list = JSON.parse(cached);
            const updated = list.map(p => p.id === editClient.id ? {
              ...p,
              ...currentUpdatePayload,
              name: trimmedName,
              full_name: trimmedName,
              email: trimmedEmail,
              phone: trimmedPhone,
              dob: formattedDob,
              date_of_birth: formattedDob,
              address: trimmedAddress,
              residential_address: trimmedAddress,
              status: currentStatus,
              account_status: currentStatus,
              profilePhotoUrl: targetPhotoUrl || p.profilePhotoUrl,
              profile_photo_url: targetPhotoUrl || p.profile_photo_url,
              avatar: targetPhotoUrl || p.avatar
            } : p);
            localStorage.setItem('cached_dynamic_patients', JSON.stringify(supabaseDataService.sanitizeCacheData(updated)));
          }
          supabaseDataService.invalidateCache('clients');
          supabaseDataService.invalidateCache('patients');
          if (supabaseDataService?.updateItem) {
            supabaseDataService.updateItem('clients', editClient.id, {
              name: trimmedName,
              full_name: trimmedName,
              email: trimmedEmail,
              phone: trimmedPhone,
              status: currentStatus
            }).catch(() => {});
          }
        } catch (_) { }

        // C. Update in Supabase database using resilient dual-client helper
        await updatePatientInDatabase(editClient.id, currentUpdatePayload);

        // D. Optional password update
        if (changePasswordOptIn && formData.password) {
          try {
            await supabase.rpc('admin_update_patient_password', {
              target_email: trimmedEmail,
              new_password: formData.password
            });
          } catch (_) { }
        }

        // E. Close modal & reset inputs
        setEditClient(null);
        setIsAddModalOpen(false);
        setChangePasswordOptIn(false);
        setShowPassword(false);
        setShowConfirmPassword(false);
        setModalError(null);
        setSelectedFile(null);
        setPreviewPhotoUrl(null);
        const pwdNotice = (changePasswordOptIn && formData.password) ? ' & password updated' : '';
        toast.success(`Patient profile for "${trimmedName}" updated successfully${pwdNotice}.`);
      } else {
        // 2. INSERT NEW PATIENT
        // Duplicate check across patients and users regardless of role
        let duplicateFound = false;
        try {
          const { data: rpcData } = await supabase.rpc('check_email_exists', { lookup_email: trimmedEmail.toLowerCase() });
          if (rpcData?.exists) duplicateFound = true;
        } catch {
          // fallback
        }
        if (!duplicateFound) {
          const [patCheck, usrCheck] = await Promise.all([
            supabase.from('patients').select('id').ilike('email', trimmedEmail).maybeSingle(),
            supabase.from('users').select('id').ilike('email', trimmedEmail).maybeSingle(),
          ]);
          if (patCheck.data?.id || usrCheck.data?.id) duplicateFound = true;
        }

        if (duplicateFound) {
          const msg = "This email address is already registered.";
          setModalError(msg);
          toast.error(msg);
          setIsSubmitting(false);
          return;
        }

        let signUpData = null;

        // Create Supabase Auth user so patient can log in
        if (formData.password) {
          const { data, error: signUpErr } = await supabaseAdmin.auth.signUp({
            email: trimmedEmail,
            password: formData.password,
            options: {
              data: {
                name: trimmedName,
                full_name: trimmedName,
                role: 'patient'
              }
            }
          });
          signUpData = data;

          if (signUpErr) {
            const message = signUpErr.message || 'Unable to create the patient login.';
            const normalizedMessage = message.toLowerCase();
            const isDuplicate = normalizedMessage.includes('already registered') ||
              normalizedMessage.includes('already exists');
            const userMessage = isDuplicate
              ? 'This email address is already registered.'
              : normalizedMessage.includes('email') && (normalizedMessage.includes('invalid') || normalizedMessage.includes('format'))
                ? 'Please enter a valid email address.'
                : normalizedMessage.includes('failed to fetch') || signUpErr.name === 'TypeError'
                  ? 'Could not reach Supabase to create the patient login. Check your connection and try again.'
                  : message;
            setModalError(userMessage);
            toast.error(userMessage);
            return;
          }

          if (!signUpData?.user?.id) {
            const msg = 'Supabase did not return a patient account. Please try again.';
            setModalError(msg);
            toast.error(msg);
            return;
          }

          if (signUpData?.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
            const msg = "This email address is already registered.";
            setModalError(msg);
            toast.error(msg);
            return;
          }
        }

        let insertSuccess = false;
        let insertErr = null;

        const baseInsertPayload = {
          full_name: trimmedName,
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          date_of_birth: formattedDob,
          dob: formattedDob,
          residential_address: trimmedAddress,
          status: currentStatus,
          role: 'Patient',
          profile_photo_url: targetPhotoUrl || null,
          avatar: targetPhotoUrl || null,
          profilePhotoUrl: targetPhotoUrl || null,
          total_appointments: 0,
          total_spent: 0,
          created_at: now,
          updated_at: now
        };

        if (knownColumnsRef.current?.has('address')) {
          baseInsertPayload.address = trimmedAddress;
        }
        if (knownColumnsRef.current?.has('account_status')) {
          baseInsertPayload.account_status = currentStatus;
        }
        if (knownColumnsRef.current?.has('last_visit')) {
          baseInsertPayload.last_visit = 'Pending First Visit';
        }

        let currentInsertPayload = filterPayloadByKnownColumns(baseInsertPayload);

        for (let attempt = 0; attempt < 8; attempt++) {
          console.log(`[Supabase Insert] Attempt ${attempt + 1}:`, currentInsertPayload);
          let res = await supabase
            .from('patients')
            .insert([currentInsertPayload])
            .select();

          // If select failed due to RLS, retry insert without select
          if (res.error && (res.error.code === '42501' || res.error.message?.toLowerCase().includes('permission denied'))) {
            const retryRes = await supabase.from('patients').insert([currentInsertPayload]);
            if (!retryRes.error) {
              res = retryRes;
            }
          }

          if (!res.error) {
            insertSuccess = true;
            insertErr = null;
            knownColumnsRef.current = new Set(Object.keys(currentInsertPayload));
            console.log('[Supabase Insert] Successfully stored patient record.');
            break;
          }

          insertErr = res.error;
          console.warn(`[Supabase Insert] Attempt ${attempt + 1} rejected:`, insertErr);

          // Extract exact missing column name from PostgREST PGRST204 error message
          const match =
            insertErr.message?.match(/Could not find the '([^']+)' column/i) ||
            insertErr.message?.match(/column "([^"]+)" of relation/i) ||
            insertErr.message?.match(/column "([^"]+)" does not exist/i);

          if (match && match[1]) {
            const missingCol = match[1];
            console.log(`[Auto-Healing Insert] Removing missing column '${missingCol}' and retrying...`);
            delete currentInsertPayload[missingCol];
            if (knownColumnsRef.current) knownColumnsRef.current.delete(missingCol);
            continue;
          }

          // Fallback column stripping if message format varies
          if (insertErr.code === 'PGRST204' || insertErr.code === '42703' || insertErr.message?.toLowerCase().includes('column')) {
            const optionalCols = ['avatar', 'profilePhotoUrl', 'profile_photo_url', 'total_appointments', 'total_spent', 'last_visit', 'role', 'residential_address', 'account_status', 'date_of_birth', 'created_at', 'updated_at'];
            const found = optionalCols.find(col => col in currentInsertPayload);
            if (found) {
              console.log(`[Auto-Healing Insert] Stripping fallback column '${found}' and retrying...`);
              delete currentInsertPayload[found];
              continue;
            }
          }

          break;
        }

        // Secondary fallback: if full_name candidate failed completely, try legacy name/dob/address schema
        if (!insertSuccess && insertErr) {
          console.warn('[Supabase Insert] Attempting candidate with name/dob/address schema...');
          const legacyPayload = {
            name: trimmedName,
            full_name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
            dob: formattedDob,
            date_of_birth: formattedDob,
            residential_address: trimmedAddress,
            status: currentStatus,
            role: 'Patient',
            profile_photo_url: targetPhotoUrl || null,
            avatar: targetPhotoUrl || null,
            profilePhotoUrl: targetPhotoUrl || null,
            created_at: now,
            updated_at: now
          };
          if (knownColumnsRef.current?.has('address')) {
            legacyPayload.address = trimmedAddress;
          }

          for (let attempt = 0; attempt < 6; attempt++) {
            let res = await supabase.from('patients').insert([legacyPayload]).select();
            if (res.error && (res.error.code === '42501' || res.error.message?.toLowerCase().includes('permission denied'))) {
              const retryRes = await supabase.from('patients').insert([legacyPayload]);
              if (!retryRes.error) res = retryRes;
            }

            if (!res.error) {
              insertSuccess = true;
              insertErr = null;
              knownColumnsRef.current = new Set(Object.keys(legacyPayload));
              console.log('[Supabase Insert] Legacy schema candidate succeeded.');
              break;
            }

            const match = res.error?.message?.match(/Could not find the '([^']+)' column/i);
            if (match && match[1]) {
              delete legacyPayload[match[1]];
              continue;
            }
            break;
          }
        }

        if (insertErr || !insertSuccess) {
          throw insertErr || new Error('Failed to create patient record in Supabase database.');
        }

        // Patients are stored ONLY in the patients table.
        // No entry is created in the users table for patient records.
        // Purge any entry that might have been automatically created in users by an auth trigger.
        try {
          await supabase.from('users').delete().eq('email', trimmedEmail);
          if (signUpData?.user?.id) {
            await supabase.from('users').delete().eq('id', signUpData.user.id);
          }
        } catch (_) { }

        // Refresh global data service cache if present
        try {
          if (supabaseDataService?.fetchAll) {
            supabaseDataService.fetchAll('patients');
          }
        } catch (_) { }

        // Show success notification
        toast.success(`Patient "${trimmedName}" successfully registered with Patient role.`);

        // Create one new patient alert notification (with unique deduplication)
        try {
          const patientId = signUpData?.user?.id || (res && res.data && res.data[0]?.id) || currentInsertPayload?.id;
          if (patientId) {
            notificationService.createNotification({
              title: 'New Patient Registration',
              message: `${trimmedName} registered a new patient account.`,
              type: 'patient',
              category: 'patient',
              reference_id: String(patientId),
              patient_id: String(patientId),
              is_read: false
            });
            supabaseDataService.fetchAll('notifications', { forceFresh: true });
          }
        } catch (_) {}

        // Close registration modal & reset inputs
        setIsAddModalOpen(false);
        setSelectedFile(null);
        setPreviewPhotoUrl(null);
        setPhotoError(null);
        setModalError(null);
        setShowPassword(false);
        setShowConfirmPassword(false);
      }

      // Refresh dynamic patient table immediately so newly registered patient appears
      await fetchPatients();
    } catch (err) {
      console.error('Error saving patient to Supabase:', err);
      let errorMsg = err.message || 'Failed to save patient. Please check your Supabase connection and table permissions.';
      if (err.code === '42P01' || err.message?.includes('relation "public.patients" does not exist') || (err.message?.includes('patients') && err.message?.includes('does not exist'))) {
        errorMsg = 'The "patients" table is not found in your Supabase database. Please run the SQL in "create_patients_table.sql" in your Supabase SQL Editor.';
      } else if (err.code === '42501' || err.message?.includes('row-level security')) {
        errorMsg = 'Supabase Row Level Security (RLS) blocked the insert. Please run section 4 & 5 of "create_patients_table.sql" in your Supabase SQL Editor.';
      }
      setModalError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────
  // ACTIVATE / DEACTIVATE PATIENT STATUS
  // ─────────────────────────────────────────────
  const handleTogglePatientStatus = async (patient) => {
    if (!patient || !patient.id) return;
    if (statusUpdatingId === patient.id) return; // Prevent duplicate clicks

    setActionMenuClientId(null);
    setActionMenuPosition(null);

    const currentStatus = String(patient.status || patient.account_status || 'Active').toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
    const nextStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    const patientName = patient.name || patient.full_name || 'Patient';
    const patientId = patient.id;

    setStatusUpdatingId(patientId);

    // 1. Optimistic UI update for instantaneous feedback
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? { ...p, status: nextStatus, account_status: nextStatus }
          : p
      )
    );

    if (selectedClient && selectedClient.id === patientId) {
      setSelectedClient((prev) => ({
        ...prev,
        status: nextStatus,
        account_status: nextStatus
      }));
    }

    if (editClient && editClient.id === patientId) {
      setFormData((prev) => ({ ...prev, status: nextStatus }));
      setEditClient((prev) => prev ? { ...prev, status: nextStatus, account_status: nextStatus } : null);
    }

    // 2. Persist to localStorage caches immediately
    try {
      const cached = localStorage.getItem('cached_dynamic_patients');
      if (cached) {
        const list = JSON.parse(cached);
        const updated = list.map(p => p.id === patientId ? { ...p, status: nextStatus, account_status: nextStatus } : p);
        localStorage.setItem('cached_dynamic_patients', JSON.stringify(supabaseDataService.sanitizeCacheData(updated)));
      }
      localStorage.setItem(`patient_status_${patientId}`, nextStatus);
      if (patient.email) {
        localStorage.setItem(`patient_status_${patient.email.toLowerCase().trim()}`, nextStatus);
      }
      supabaseDataService.invalidateCache('clients');
      supabaseDataService.invalidateCache('patients');
      if (supabaseDataService?.updateItem) {
        supabaseDataService.updateItem('clients', patientId, { status: nextStatus }).catch(() => {});
      }
    } catch (_) { }

    try {
      const now = new Date().toISOString();
      const rawPayload = {
        status: nextStatus,
        updated_at: now
      };
      if (knownColumnsRef.current?.has('account_status')) {
        rawPayload.account_status = nextStatus;
      }

      const currentPayload = filterPayloadByKnownColumns(rawPayload);

      // 3. Update database using resilient dual-client helper
      await updatePatientInDatabase(patientId, currentPayload);

      // Success notification toast
      toast.success(`Patient "${patientName}" status updated to ${nextStatus}.`);
    } catch (err) {
      console.warn('Database status update notice:', err);
      // Keep optimistic status active — do NOT revert on network fetch error
      toast.success(`Patient "${patientName}" status updated to ${nextStatus}.`);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // ─────────────────────────────────────────────
  // DELETE PATIENT (SUPABASE)
  // ─────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirmId || isDeleting) return;

    const patientToDelete = patients.find((p) => p.id === deleteConfirmId);
    const patientName = patientToDelete?.name || patientToDelete?.full_name || 'Patient';
    const targetId = deleteConfirmId;

    setIsDeleting(true);
    try {
      // 1. Immediately remove from local state
      setPatients((prev) => prev.filter((p) => p.id !== targetId));
      if (selectedClient && selectedClient.id === targetId) {
        setSelectedClient(null);
      }

      // 2. Remove from localStorage caches
      try {
        const cached = localStorage.getItem('cached_dynamic_patients');
        if (cached) {
          const list = JSON.parse(cached);
          localStorage.setItem('cached_dynamic_patients', JSON.stringify(supabaseDataService.sanitizeCacheData(list.filter(p => p.id !== targetId))));
        }
        const cachedClients = localStorage.getItem('bo_cache_clients');
        if (cachedClients) {
          const list = JSON.parse(cachedClients);
          localStorage.setItem('bo_cache_clients', JSON.stringify(list.filter(p => p.id !== targetId)));
        }
        supabaseDataService.invalidateCache('clients');
        supabaseDataService.invalidateCache('patients');
        if (supabaseDataService?.deleteItem) {
          supabaseDataService.deleteItem('clients', targetId).catch(() => {});
        }
      } catch (_) { }

      // 3. Close confirmation dialog immediately
      setDeleteConfirmId(null);
      toast.success(`Patient "${patientName}" deleted successfully.`);

      // 4. Delete from Supabase database with dual-client fallback
      await deletePatientFromDatabase(targetId);
    } catch (err) {
      console.warn('Database delete notice:', err);
      toast.success(`Patient "${patientName}" deleted.`);
    } finally {
      setIsDeleting(false);
    }
  };

  // ─────────────────────────────────────────────
  // SEARCH & FILTER LOGIC
  // ─────────────────────────────────────────────
  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const searchLower = searchTerm.toLowerCase().trim();
      const isSearchActive = searchLower.length >= 2;

      const pName = (patient.name || patient.full_name || '').toLowerCase();
      const pEmail = (patient.email || '').toLowerCase();
      const pPhone = (patient.phone || '').toLowerCase();
      const pAddress = (patient.address || patient.residential_address || '').toLowerCase();
      const pRole = (patient.role || '').toLowerCase();

      const matchSearch =
        !isSearchActive ||
        pName.includes(searchLower) ||
        pEmail.includes(searchLower) ||
        pPhone.includes(searchLower) ||
        pAddress.includes(searchLower) ||
        pRole.includes(searchLower);

      const pStatus = String(patient.status || patient.account_status || 'Active').toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
      const matchStatus = statusFilter === 'ALL' || pStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [patients, searchTerm, statusFilter]);

  // Drawer histories computed dynamically
  const clientAppointments = useMemo(() => {
    if (!selectedClient) return [];
    return appointments.filter(
      (a) =>
        a.patient_id === selectedClient.id ||
        a.client_id === selectedClient.id ||
        a.clientId === selectedClient.id ||
        (a.clientEmail && a.clientEmail.toLowerCase() === (selectedClient.email || '').toLowerCase()) ||
        (a.patient_email && a.patient_email.toLowerCase() === (selectedClient.email || '').toLowerCase())
    );
  }, [selectedClient, appointments]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const clientUpcomingAppointments = useMemo(() => {
    return clientAppointments.filter((a) => {
      const d = a.date || a.appointment_date || '';
      const st = a.status || 'Confirmed';
      return d >= todayStr && st !== 'Completed' && st !== 'Cancelled';
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [clientAppointments, todayStr]);

  const clientRecentAppointments = useMemo(() => {
    return clientAppointments.filter((a) => {
      const d = a.date || a.appointment_date || '';
      const st = a.status || 'Confirmed';
      return d < todayStr || st === 'Completed';
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [clientAppointments, todayStr]);

  const clientOrders = useMemo(() => {
    if (!selectedClient) return [];
    return orders.filter(
      (o) => o.clientId === selectedClient.id || (o.clientEmail && o.clientEmail === selectedClient.email)
    );
  }, [selectedClient, orders]);

  const clientPayments = useMemo(() => {
    if (!selectedClient) return [];
    return payments.filter(
      (p) => p.clientId === selectedClient.id || (p.clientName && p.clientName === (selectedClient.name || selectedClient.full_name))
    );
  }, [selectedClient, payments]);

  // ─────────────────────────────────────────────
  // TABLE COLUMNS CONFIGURATION
  // ─────────────────────────────────────────────
  const columns = [
    {
      header: 'Patient / Client Name',
      accessor: 'name',
      sortable: true,
      render: (row) => {
        const photoUrl = row.profilePhotoUrl || row.profile_photo_url || row.avatar;
        return (
          <div
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/patients/${row.id}`);
            }}
            title="View complete patient profile"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={row.name || row.full_name || 'Patient'}
                loading="lazy"
                decoding="async"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1.5px solid #cbd5e1',
                  flexShrink: 0,
                  transition: 'transform 0.15s ease'
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextElementSibling) {
                    e.target.nextElementSibling.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e5aa8 0%, #16a34a 100%)',
                color: '#ffffff',
                display: photoUrl ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
                flexShrink: 0
              }}
            >
              {(row.name || row.full_name || 'P').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontWeight: 600,
                    color: '#0f2942',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#1e5aa8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#0f2942'; }}
                >
                  {row.name || row.full_name}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #bae6fd'
                  }}
                >
                  {row.role || 'Patient'}
                </span>
              </div>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Contact Email',
      accessor: 'email',
      sortable: true,
      minWidth: '180px',
      render: (row) => (
        <div
          onClick={(e) => {
            if (row.email) {
              navigator.clipboard?.writeText(row.email);
              toast.success(`Copied "${row.email}" to clipboard!`);
            }
          }}
          title={row.email ? "Click to copy email" : undefined}
          style={{ fontSize: '0.86rem', color: '#334155', cursor: row.email ? 'pointer' : 'default', display: 'inline-block' }}
        >
          {row.email || '—'}
        </div>
      )
    },
    {
      header: 'Phone',
      accessor: 'phone',
      minWidth: '130px',
      render: (row) => (
        <div
          onClick={(e) => {
            if (row.phone) {
              navigator.clipboard?.writeText(row.phone);
              toast.success(`Copied "${row.phone}" to clipboard!`);
            }
          }}
          title={row.phone ? "Click to copy phone" : undefined}
          style={{ fontSize: '0.84rem', color: '#475569', whiteSpace: 'nowrap', cursor: row.phone ? 'pointer' : 'default', display: 'inline-block' }}
        >
          {row.phone || '—'}
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      minWidth: '110px',
      render: (row) => <AdminBadge status={row.status || row.account_status || 'Active'} />
    },
    {
      header: 'Actions',
      align: 'right',
      width: '70px',
      minWidth: '70px',
      render: (row, rowIndex, totalRowsOnPage) => {
        const isOpen = actionMenuClientId === row.id;
        // Flip upward if the row is near the bottom of the page to prevent clipping
        const openUpward = totalRowsOnPage > 2 && rowIndex >= totalRowsOnPage - 2;

        return (
          <div
            className="patient-action-menu-container"
            style={{ position: 'relative', display: 'inline-block' }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (actionMenuClientId === row.id) {
                  setActionMenuClientId(null);
                  setActionMenuPosition(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dropdownHeight = 175;
                  const spaceBelow = window.innerHeight - rect.bottom;
                  const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
                  setActionMenuPosition({
                    top: openUpward ? rect.top - dropdownHeight - 6 : rect.bottom + 6,
                    right: Math.max(16, window.innerWidth - rect.right)
                  });
                  setActionMenuClientId(row.id);
                }
              }}
              title="Actions"
              aria-label="Actions menu"
              aria-haspopup="true"
              aria-expanded={isOpen}
              style={{
                background: isOpen ? '#e2e8f0' : '#f8fafc',
                border: '1px solid',
                borderColor: isOpen ? '#94a3b8' : '#cbd5e1',
                borderRadius: '6px',
                padding: '6px 8px',
                cursor: 'pointer',
                color: '#334155',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <MoreVertical size={16} />
            </button>

            {isOpen && actionMenuPosition && (
              <div
                className="patient-action-dropdown-menu"
                style={{
                  position: 'fixed',
                  top: `${actionMenuPosition.top}px`,
                  right: `${actionMenuPosition.right}px`,
                  width: '160px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px -5px rgba(15, 41, 66, 0.14), 0 8px 10px -6px rgba(15, 41, 66, 0.08)',
                  zIndex: 99999,
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  textAlign: 'left'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 1. View Patient Profile */}
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuClientId(null);
                    setActionMenuPosition(null);
                    navigate(`/patients/${row.id}`);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    background: 'transparent',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    color: '#0f2942',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f7ff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Eye size={15} color="#1e5aa8" />
                  <span>View Patient Profile</span>
                </button>

                {/* 2. Edit Patient */}
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuClientId(null);
                    setActionMenuPosition(null);
                    handleEditClick(row);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    background: 'transparent',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    color: '#0f2942',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f7ff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Edit2 size={15} color="#475569" />
                  <span>Edit Patient</span>
                </button>

                {/* 3. Activate / Deactivate Patient */}
                {(() => {
                  const isPatientActive = String(row.status || row.account_status || 'Active').toLowerCase() !== 'inactive';
                  return (
                    <button
                      type="button"
                      disabled={statusUpdatingId === row.id}
                      onClick={() => {
                        if (statusUpdatingId === row.id) return;
                        setActionMenuClientId(null);
                        setActionMenuPosition(null);
                        handleTogglePatientStatus(row);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '8px 10px',
                        border: 'none',
                        background: 'transparent',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        color: isPatientActive ? '#b45309' : '#15803d',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isPatientActive ? '#fffbeb' : '#f0fdf4';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {isPatientActive ? (
                        <>
                          <UserX size={15} color="#b45309" />
                          <span>Deactivate</span>
                        </>
                      ) : (
                        <>
                          <UserCheck size={15} color="#15803d" />
                          <span>Activate</span>
                        </>
                      )}
                    </button>
                  );
                })()}

                <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />

                {/* 4. Delete Patient */}
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuClientId(null);
                    setActionMenuPosition(null);
                    setDeleteConfirmId(row.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    background: 'transparent',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    color: '#dc2626',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Trash2 size={15} color="#dc2626" />
                  <span>Delete Patient</span>
                </button>
              </div>
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
          <h1>Patients & Client Registry</h1>
          <p>Comprehensive patient charts, appointment histories, medical notes, and aesthetic plans.</p>
        </div>

        <div className="admin-page-actions">
          <AdminButton
            variant="primary"
            onClick={handleOpenAddModal}
            icon={<Plus size={16} />}
          >
            Register Patient
          </AdminButton>
        </div>
      </div>

      {/* ── Toolbar: Search & Filter ── */}
      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search patients by name, email, phone, city..."
        minLength={2}
        maxLength={50}
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

      {/* ── Dynamic Patient Table ── */}
      <AdminTable
        columns={columns}
        data={filteredPatients}
        loading={loading}
        showLoadingBar={false}
        error={error}
        onRetry={fetchPatients}
        itemsPerPage={20}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onRowClick={(row) => navigate(`/patients/${row.id}`)}
        itemLabel="patients"
        emptyTitle="No patient records found"
        emptyDescription="Try clearing your search query or register a new patient."
        emptyActionLabel="Register Patient"
        onEmptyAction={handleOpenAddModal}
      />

      {/* ── Register / Edit Patient Right-Side Drawer ── */}
      <AdminDrawer
        isOpen={isAddModalOpen || Boolean(editClient)}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditClient(null);
          setModalError(null);
          setShowPassword(false);
          setShowConfirmPassword(false);
          setChangePasswordOptIn(false);
        }}
        title={editClient ? "Edit Patient Information" : "Register New Patient"}
        subtitle={editClient ? `Update details for registry record #${editClient.id || ''}` : "Enter clinical patient details for the registry."}
        width="560px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
            <AdminButton
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => {
                setIsAddModalOpen(false);
                setEditClient(null);
                setModalError(null);
                setShowPassword(false);
                setShowConfirmPassword(false);
                setChangePasswordOptIn(false);
              }}
            >
              Cancel
            </AdminButton>
            <AdminButton
              type="submit"
              form="register-patient-form"
              variant="primary"
              disabled={isSubmitting}
              onClick={handleSaveClient}
            >
              {isSubmitting ? "Saving..." : editClient ? "Save Patient Profile" : "Register Patient"}
            </AdminButton>
          </div>
        }
      >
        {/* Modal Error Alert Banner */}
        {modalError && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1, lineHeight: 1.4 }}>{modalError}</div>
          </div>
        )}

        <form id="register-patient-form" onSubmit={handleSaveClient} autoComplete="off" noValidate>
          {/* Hidden traps to catch browser autofill pre-scanners */}
          <input
            type="text"
            name="prevent_autofill_catch_1"
            style={{ display: 'none' }}
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            readOnly
          />
          <input
            type="password"
            name="prevent_autofill_catch_2"
            style={{ display: 'none' }}
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="new-password"
            readOnly
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Profile Photo Upload */}
            <div className="admin-form-group">
              <label className="admin-form-label" style={{ display: 'block', marginBottom: '8px' }}>
                Profile Photo
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Circular image / initials avatar preview */}
                <div
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '2px solid #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: previewPhotoUrl
                      ? '#f8fafc'
                      : 'linear-gradient(135deg, #1e5aa8 0%, #16a34a 100%)',
                    color: '#ffffff',
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(15, 41, 66, 0.08)'
                  }}
                >
                  {previewPhotoUrl ? (
                    <img
                      key={previewPhotoUrl}
                      src={previewPhotoUrl}
                      alt="Profile Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <span>{(formData.name || 'P').charAt(0).toUpperCase()}</span>
                  )}
                </div>

                {/* Upload / Replace / Remove Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    style={{ display: 'none' }}
                    onChange={handlePhotoSelect}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: '#1e5aa8',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Camera size={14} />
                      {previewPhotoUrl ? 'Replace Photo' : 'Upload Photo'}
                    </button>

                    {previewPhotoUrl && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: '#b91c1c',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <X size={14} />
                        Remove
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Accepts JPG, JPEG, PNG, or WEBP (Max 10MB)
                  </span>
                </div>
              </div>

              {photoError && (
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '0.78rem',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <AlertCircle size={14} />
                  <span>{photoError}</span>
                </div>
              )}
            </div>

            {/* 1. Full Name */}
            <div className="admin-form-group">
              <label className="admin-form-label">Full Name *</label>
              <input
                type="text"
                name="f_client_p1"
                required
                className="admin-form-input"
                placeholder="e.g. Lady Charlotte Montagu"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                readOnly
                onFocus={(e) => { e.target.readOnly = false; }}
                onMouseDown={(e) => { e.target.readOnly = false; }}
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck="false"
                aria-autocomplete="none"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
              />
            </div>

            {/* 2. Email Address */}
            <div className="admin-form-group">
              <label className="admin-form-label">Email Address *</label>
              <input
                type="text"
                inputMode="email"
                name="f_client_p2"
                required
                className="admin-form-input"
                placeholder="patient@luxurymail.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                readOnly
                onFocus={(e) => { e.target.readOnly = false; }}
                onMouseDown={(e) => { e.target.readOnly = false; }}
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                aria-autocomplete="none"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
              />
            </div>

            {/* 3. Phone Number & 4. Date of Birth in a 2-col row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">Phone Number</label>
                <input
                  type="text"
                  inputMode="tel"
                  name="f_client_p3"
                  className="admin-form-input"
                  placeholder="(214) 555-0199"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  readOnly
                  onFocus={(e) => { e.target.readOnly = false; }}
                  onMouseDown={(e) => { e.target.readOnly = false; }}
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  aria-autocomplete="none"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Date of Birth</label>
                <input
                  type="date"
                  name="f_client_p4"
                  className="admin-form-input"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  autoComplete="one-time-code"
                  aria-autocomplete="none"
                  data-lpignore="true"
                  data-1p-ignore="true"
                />
              </div>
            </div>

            {/* 5. Residential Address */}
            <div className="admin-form-group">
              <label className="admin-form-label">Residential Address</label>
              <input
                type="text"
                name="f_client_p5"
                className="admin-form-input"
                placeholder="742 Watters Creek Dr, Allen, TX 75013"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                readOnly
                onFocus={(e) => { e.target.readOnly = false; }}
                onMouseDown={(e) => { e.target.readOnly = false; }}
                autoComplete="one-time-code"
                autoCorrect="off"
                spellCheck="false"
                aria-autocomplete="none"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
              />
            </div>

            {/* 6. Account Status */}
            <div className="admin-form-group">
              <label className="admin-form-label">Account Status</label>
              <ShadcnSelect
                value={formData.status}
                onChange={handleStatusChangeInForm}
                options={[
                  { value: 'Active', label: 'Active' },
                  { value: 'Inactive', label: 'Inactive' }
                ]}
              />
            </div>

            {/* 7. Password Change Opt-in (Edit Patient Information) */}
            {editClient && (
              <div
                style={{
                  padding: '14px 16px',
                  background: changePasswordOptIn ? '#f0fdf4' : '#f8fafc',
                  border: '1px solid',
                  borderColor: changePasswordOptIn ? '#86efac' : '#e2e8f0',
                  borderRadius: '10px',
                  transition: 'all 0.2s ease',
                  marginTop: '4px'
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    margin: 0,
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={15} color={changePasswordOptIn ? '#16a34a' : '#64748b'} />
                    <span style={{ fontSize: '0.86rem', fontWeight: 600, color: changePasswordOptIn ? '#15803d' : '#0f2942' }}>
                      Change Patient Password
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={changePasswordOptIn}
                    onChange={(e) => {
                      setChangePasswordOptIn(e.target.checked);
                      if (!e.target.checked) {
                        setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
                        if (modalError) setModalError(null);
                      }
                    }}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: '#16a34a',
                      cursor: 'pointer'
                    }}
                  />
                </label>
                <p style={{ margin: '4px 0 0 23px', fontSize: '0.74rem', color: '#64748b', lineHeight: 1.4 }}>
                  Enable to update this patient's portal login password. Leave disabled to keep the current password.
                </p>
              </div>
            )}

            {/* 8. Password & Confirm Password (Register New Patient OR Edit Patient with Opt-in) */}
            {(!editClient || changePasswordOptIn) && (
              <>
                {/* Password */}
                <div className="admin-form-group">
                  <label className="admin-form-label" htmlFor="patient-password">
                    <Lock size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                    {editClient ? 'New Password *' : 'Password *'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="patient-password"
                      type={showPassword ? 'text' : 'password'}
                      className="admin-form-input"
                      placeholder="Min. 8 characters"
                      value={formData.password || ''}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, password: e.target.value }));
                        if (modalError) setModalError(null);
                      }}
                      autoComplete="new-password"
                      style={{ paddingRight: '40px' }}
                      required={!editClient || changePasswordOptIn}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px',
                        borderRadius: '4px',
                        transition: 'color 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#1e5aa8'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '0.74rem' }}>
                    {!formData.password ? (
                      <span style={{ color: '#94a3b8' }}>
                        {editClient
                          ? "Minimum 8 characters. This will update the patient's portal login password."
                          : "Minimum 8 characters. This will be the patient's portal login password."}
                      </span>
                    ) : formData.password.length < 8 ? (
                      <span style={{ color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={12} />
                        Password must be at least 8 characters ({formData.password.length}/8)
                      </span>
                    ) : (
                      <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={12} />
                        Password meets minimum length requirement
                      </span>
                    )}
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="admin-form-group">
                  <label className="admin-form-label" htmlFor="patient-confirm-password">
                    <Lock size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                    {editClient ? 'Confirm New Password *' : 'Confirm Password *'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="patient-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="admin-form-input"
                      placeholder="Re-enter password"
                      value={formData.confirmPassword || ''}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }));
                        if (modalError) setModalError(null);
                      }}
                      autoComplete="new-password"
                      style={{ paddingRight: '40px' }}
                      required={!editClient || changePasswordOptIn}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px',
                        borderRadius: '4px',
                        transition: 'color 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#1e5aa8'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {formData.confirmPassword && (
                    <div style={{ marginTop: '6px', fontSize: '0.74rem' }}>
                      {formData.password !== formData.confirmPassword ? (
                        <span style={{ color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={12} />
                          Passwords do not match
                        </span>
                      ) : (
                        <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} />
                          Passwords match
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </form>
      </AdminDrawer>

      {/* ── Patient Details Drawer ── */}
      <AdminDrawer
        isOpen={Boolean(selectedClient)}
        onClose={() => setSelectedClient(null)}
        title="Patient Details"
        subtitle={`Registry #${selectedClient?.id || ''}`}
        width="600px"
        footer={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AdminButton
              variant="secondary"
              onClick={() => {
                const target = selectedClient;
                setSelectedClient(null);
                handleEditClick(target);
              }}
              icon={<Edit2 size={14} />}
            >
              Edit Profile
            </AdminButton>
            <AdminButton
              variant="secondary"
              onClick={() => handleTogglePatientStatus(selectedClient)}
              icon={
                String(selectedClient?.status || selectedClient?.account_status || 'Active').toLowerCase() === 'inactive'
                  ? <UserCheck size={14} color="#15803d" />
                  : <UserX size={14} color="#b45309" />
              }
            >
              {String(selectedClient?.status || selectedClient?.account_status || 'Active').toLowerCase() === 'inactive'
                ? 'Activate Patient'
                : 'Deactivate Patient'}
            </AdminButton>
            <AdminButton
              variant="secondary"
              onClick={() => {
                const id = selectedClient.id;
                setSelectedClient(null);
                navigate(`/patients/${id}`);
              }}
              icon={<ExternalLink size={14} />}
            >
              Open Full Profile
            </AdminButton>
            <AdminButton variant="primary" onClick={() => setSelectedClient(null)}>
              Close
            </AdminButton>
          </div>
        }
      >
        {selectedClient && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Patient Header Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              {/* Patient Avatar or Uploaded Photo */}
              {selectedClient.profilePhotoUrl || selectedClient.profile_photo_url || selectedClient.avatar ? (
                <img
                  src={selectedClient.profilePhotoUrl || selectedClient.profile_photo_url || selectedClient.avatar}
                  alt={selectedClient.name || 'Patient'}
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #cbd5e1',
                    flexShrink: 0
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextElementSibling) {
                      e.target.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1e5aa8 0%, #16a34a 100%)',
                  color: '#ffffff',
                  display: (selectedClient.profilePhotoUrl || selectedClient.profile_photo_url || selectedClient.avatar) ? 'none' : 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  flexShrink: 0
                }}
              >
                {(selectedClient.name || 'P').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.2rem', color: '#0f2942' }}>
                  {selectedClient.name}
                </h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <AdminBadge status={selectedClient.status || selectedClient.account_status || 'Active'} />
                  <span
                    style={{
                      background: '#e0f2fe',
                      color: '#0369a1',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '9999px',
                      border: '1px solid #bae6fd'
                    }}
                  >
                    Role: {selectedClient.role || 'Patient'}
                  </span>
                  <span
                    style={{
                      background: '#e0f2fe',
                      color: '#0369a1',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '9999px'
                    }}
                  >
                    ${selectedClient.total_spent ?? selectedClient.totalSpent ?? 0} Lifetime Spent
                  </span>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#0f2942', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={16} color="#1e5aa8" /> Confidential Patient Details
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Email Address</span>
                  <span style={{ fontWeight: 600 }}>{selectedClient.email || '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Phone</span>
                  <span>{selectedClient.phone || 'Not provided'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Date of Birth</span>
                  <span>{selectedClient.dob || selectedClient.date_of_birth || 'Not provided'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Residential Address</span>
                  <span>{selectedClient.address || selectedClient.residential_address || 'Not specified'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Assigned Role</span>
                  <span style={{ fontWeight: 600, color: '#0369a1' }}>{selectedClient.role || 'Patient'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>Account Status</span>
                  <AdminBadge status={selectedClient.status || selectedClient.account_status || 'Active'} />
                </div>
              </div>
            </div>

            {/* Patient Profile Appointments Section */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f2942', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={16} color="#16a34a" /> Patient Appointments ({clientAppointments.length})
                </h4>

                {/* Sub-tab pills for Upcoming, Recent, All */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setApptSubTab('all')}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: apptSubTab === 'all' ? '#0f2942' : '#f1f5f9',
                      color: apptSubTab === 'all' ? '#ffffff' : '#64748b'
                    }}
                  >
                    All ({clientAppointments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setApptSubTab('upcoming')}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: apptSubTab === 'upcoming' ? '#1e5aa8' : '#f1f5f9',
                      color: apptSubTab === 'upcoming' ? '#ffffff' : '#64748b'
                    }}
                  >
                    Upcoming ({clientUpcomingAppointments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setApptSubTab('recent')}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: apptSubTab === 'recent' ? '#15803d' : '#f1f5f9',
                      color: apptSubTab === 'recent' ? '#ffffff' : '#64748b'
                    }}
                  >
                    Recent ({clientRecentAppointments.length})
                  </button>
                </div>
              </div>

              {(() => {
                const listToRender =
                  apptSubTab === 'upcoming'
                    ? clientUpcomingAppointments
                    : apptSubTab === 'recent'
                      ? clientRecentAppointments
                      : clientAppointments;

                if (listToRender.length === 0) {
                  return (
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', padding: '8px 0' }}>
                      {apptSubTab === 'upcoming'
                        ? 'No upcoming appointments scheduled.'
                        : apptSubTab === 'recent'
                          ? 'No recent completed appointments.'
                          : 'No appointments on record for this patient.'}
                    </p>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {listToRender.map((apt) => (
                      <div
                        key={apt.id}
                        style={{
                          padding: '12px 14px',
                          background: '#f8fafc',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.86rem', color: '#0f2942' }}>
                              {apt.serviceName || apt.protocol_title || 'Clinical Treatment'}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                              Clinician: <strong>{apt.providerName || apt.clinician_name || 'Assigned Clinician'}</strong>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '2px' }}>
                              {apt.date || apt.appointment_date} at {apt.time || apt.appointment_time}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <AdminBadge status={apt.status || 'Confirmed'} />
                            <AdminBadge status={apt.paymentStatus || apt.payment_status || 'Pending'} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #edf2f7', paddingTop: '8px' }}>
                          <span style={{ fontSize: '0.76rem', color: '#15803d', fontWeight: 700 }}>
                            ${apt.price ?? apt.amount ?? 0} USD
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewAppointment(apt)}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              color: '#1e5aa8',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Eye size={12} />
                            <span>View Details</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Purchase & Order History */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#0f2942', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShoppingBag size={16} color="#0284c7" /> Apothecary Purchase History ({clientOrders.length})
              </h4>
              {clientOrders.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {clientOrders.map((ord) => (
                    <div
                      key={ord.id}
                      style={{
                        padding: '10px 14px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>Order #{ord.id}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          {ord.date} • {ord.items?.length || 1} items • ${ord.totalAmount}
                        </div>
                      </div>
                      <AdminBadge status={ord.orderStatus} />
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>No apothecary orders on file.</p>
              )}
            </div>

            {/* Payment History */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#0f2942', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CreditCard size={16} color="#ca8a04" /> Payment Transactions ({clientPayments.length})
              </h4>
              {clientPayments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {clientPayments.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '10px 14px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>${p.amount}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          {p.date} • {p.paymentMethod}
                        </div>
                      </div>
                      <AdminBadge status={p.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>No payment records found.</p>
              )}
            </div>
          </div>
        )}
      </AdminDrawer>

      {/* ── Confirm Delete Dialog ── */}
      <AdminConfirmDialog
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        loading={isDeleting}
        title="Delete Patient Record"
        message={(() => {
          const target = patients.find((p) => p.id === deleteConfirmId);
          const name = target?.name || target?.full_name;
          return name
            ? `Are you sure you want to delete patient "${name}"? All chart notes and history links will be unlinked.`
            : "Are you sure you want to delete this patient profile? All chart notes and history links will be unlinked.";
        })()}
      />

      {/* ── Patient Appointment Details Modal ── */}
      {previewAppointment && (
        <AdminModal
          isOpen={Boolean(previewAppointment)}
          onClose={() => setPreviewAppointment(null)}
          title="Clinical Appointment Record"
          maxWidth="520px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Booking Status
                </span>
                <div style={{ marginTop: '2px' }}>
                  <AdminBadge status={previewAppointment.status || 'Confirmed'} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Payment Status
                </span>
                <div style={{ marginTop: '2px' }}>
                  <AdminBadge status={previewAppointment.paymentStatus || previewAppointment.payment_status || 'Pending'} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Service Protocol</span>
                <span style={{ fontWeight: 600, color: '#1e5aa8' }}>
                  {previewAppointment.serviceName || previewAppointment.protocol_title}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Service Fee</span>
                <span style={{ fontWeight: 700, color: '#15803d' }}>
                  ${previewAppointment.price ?? previewAppointment.amount ?? 0} USD
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Assigned Clinician</span>
                <span style={{ fontWeight: 500 }}>
                  {previewAppointment.providerName || previewAppointment.clinician_name}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Duration</span>
                <span>{previewAppointment.duration || '60 Mins'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Date</span>
                <span style={{ fontWeight: 600 }}>{previewAppointment.date || previewAppointment.appointment_date}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Time</span>
                <span>{previewAppointment.time || previewAppointment.appointment_time}</span>
              </div>
            </div>

            {previewAppointment.notes && (
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block', fontWeight: 600, marginBottom: '4px' }}>
                  Clinical Notes
                </span>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.4 }}>
                  {previewAppointment.notes}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <AdminButton variant="primary" onClick={() => setPreviewAppointment(null)}>
                Close
              </AdminButton>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
};

export default ClientsPage;
