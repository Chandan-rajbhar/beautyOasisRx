import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Check,
  Upload,
  Link,
  Image as ImageIcon,
  Camera,
  Loader2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Maximize2,
  ChevronLeft,
  ChevronRight
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

const DURATION_OPTIONS = DEFAULT_CLINICAL_DURATIONS.map(d => ({ value: d, label: d }));

const parseMinutesFromLabel = (label) => {
  const match = String(label).match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};


const DEFAULT_FORM = {
  protocol_title: '',
  category_id: '',
  category: '',
  price: '',
  duration: '60 Mins',
  status: 'Active',
  tagline: '',
  clinical_description: '',
  image_url: '',
  images: []
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

  // Multiple Treatment Images State
  // Array of: { id, url, file, sequence, name, isNew }
  const [treatmentImages, setTreatmentImages] = useState([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageError, setImageError] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const replaceFileInputRef = useRef(null);
  const [replacingImageId, setReplacingImageId] = useState(null);

  // Drag and drop reordering sequence state
  const [draggedImageIndex, setDraggedImageIndex] = useState(null);

  // Full-resolution image lightbox view modal
  const [viewingImage, setViewingImage] = useState(null);

  // Edit image details modal (rename label or modify URL)
  const [editingImageItem, setEditingImageItem] = useState(null);
  const [editingImageName, setEditingImageName] = useState('');
  const [editingImageUrl, setEditingImageUrl] = useState('');

  // Overview drawer active hero preview index
  const [overviewActiveImageIndex, setOverviewActiveImageIndex] = useState(0);

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
  // 1. FETCH TREATMENT CATEGORIES (treatment_categories table)
  //    NOTE: This is intentionally separate from the 'categories'
  //    table which is used exclusively by the Products module.
  // ─────────────────────────────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    try {
      let { data, error: catErr } = await supabase
        .from('treatment_categories')
        .select('*')
        .order('name', { ascending: true });

      if (catErr) {
        const adminRes = await supabaseAdmin
          .from('treatment_categories')
          .select('*')
          .order('name', { ascending: true });
        if (!adminRes.error && adminRes.data) {
          data = adminRes.data;
          catErr = null;
        }
      }

      // If treatment_categories table is empty, auto-seed default clinical categories
      if (!catErr && (!data || data.length === 0)) {
        const seedPayload = DEFAULT_CLINICAL_CATEGORIES.map(name => ({ name }));
        try {
          const { data: seeded } = await supabase.from('treatment_categories').insert(seedPayload).select();
          if (seeded && seeded.length > 0) {
            data = seeded;
          }
        } catch (_) { }
      }

      if (data && data.length > 0) {
        setCategories(data);
        try { localStorage.setItem('bo_treatment_categories_cache', JSON.stringify(data)); } catch (_) { }
      } else {
        // Fallback to local default objects
        const fallbackCats = DEFAULT_CLINICAL_CATEGORIES.map((name, i) => ({ id: `cat-${i}`, name }));
        setCategories(fallbackCats);
      }
    } catch (err) {
      console.error('Error fetching treatment categories from Supabase:', err);
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
        // Normalize rows so both protocol_title, images, and sequence order work cleanly
        treatmentsResult = data.map(item => {
          let normalizedImages = [];
          if (Array.isArray(item.images)) {
            normalizedImages = item.images.map((img, idx) => {
              if (typeof img === 'string') {
                return { id: `img_${idx}`, url: img, sequence: idx + 1, name: `Image #${idx + 1}` };
              }
              return {
                id: img.id || `img_${idx}`,
                url: img.url || '',
                sequence: typeof img.sequence === 'number' ? img.sequence : idx + 1,
                name: img.name || `Image #${idx + 1}`
              };
            }).filter(img => Boolean(img.url)).sort((a, b) => a.sequence - b.sequence);
          } else if (typeof item.images === 'string') {
            try {
              const parsed = JSON.parse(item.images);
              if (Array.isArray(parsed)) {
                normalizedImages = parsed.map((img, idx) => {
                  if (typeof img === 'string') {
                    return { id: `img_${idx}`, url: img, sequence: idx + 1, name: `Image #${idx + 1}` };
                  }
                  return {
                    id: img.id || `img_${idx}`,
                    url: img.url || '',
                    sequence: typeof img.sequence === 'number' ? img.sequence : idx + 1,
                    name: img.name || `Image #${idx + 1}`
                  };
                }).filter(img => Boolean(img.url)).sort((a, b) => a.sequence - b.sequence);
              }
            } catch (_) {}
          }

          if (normalizedImages.length === 0 && (item.image_url || item.image)) {
            normalizedImages = [{
              id: 'img_primary',
              url: item.image_url || item.image,
              sequence: 1,
              name: 'Primary Image'
            }];
          }

          return {
            ...item,
            protocol_title: item.protocol_title || item.title || 'Untitled Protocol',
            price: Number(item.price || item.numericPrice || 0),
            duration: item.duration || '60 Mins',
            status: item.status || 'Active',
            appointment_date: item.appointment_date || (item.created_at ? item.created_at.split('T')[0] : '2026-09-30'),
            appointment_time: item.appointment_time || '10:30 AM',
            category: item.category || 'Skin Rejuvenation',
            tagline: item.tagline || '',
            clinical_description: item.clinical_description || item.description || '',
            images: normalizedImages,
            image_url: normalizedImages[0]?.url || item.image_url || item.image || ''
          };
        });
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

  // Dynamic Overview Drawer Images (ordered by sequence)
  const overviewImages = useMemo(() => {
    if (!selectedTreatment) return [];
    if (Array.isArray(selectedTreatment.images) && selectedTreatment.images.length > 0) {
      return [...selectedTreatment.images]
        .filter(item => Boolean(item && item.url))
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    }
    if (selectedTreatment.image_url || selectedTreatment.image) {
      return [{
        id: 'primary',
        url: selectedTreatment.image_url || selectedTreatment.image,
        sequence: 1,
        name: selectedTreatment.protocol_title || 'Primary Image'
      }];
    }
    return [];
  }, [selectedTreatment]);

  // ─────────────────────────────────────────────────────────────
  // 4. MULTI-IMAGE GALLERY, CRUD & SEQUENCE MANAGEMENT HANDLERS
  // ─────────────────────────────────────────────────────────────
  // Sync overview active index on treatment change
  useEffect(() => {
    setOverviewActiveImageIndex(0);
  }, [selectedTreatment]);

  // Add multiple files from device
  const handleAddFiles = (files) => {
    if (!files || files.length === 0) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif', 'image/svg+xml'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const newItems = [];
    let hasTypeError = false;
    let hasSizeError = false;

    Array.from(files).forEach((file, fileIdx) => {
      if (!validTypes.includes(file.type)) {
        hasTypeError = true;
        return;
      }
      if (file.size > maxSize) {
        hasSizeError = true;
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      const seq = treatmentImages.length + newItems.length + 1;
      newItems.push({
        id: `img_${Date.now()}_${fileIdx}_${Math.random().toString(36).substring(2, 7)}`,
        url: previewUrl,
        file: file,
        sequence: seq,
        name: file.name,
        isNew: true
      });
    });

    if (hasTypeError) {
      toast.error('Some files were skipped: JPG, PNG, WEBP, GIF, SVG only.');
    }
    if (hasSizeError) {
      toast.error('Some files were skipped: 10MB size limit exceeded.');
    }

    if (newItems.length > 0) {
      setTreatmentImages(prev => [...prev, ...newItems]);
      setImageError(null);
      toast.success(`${newItems.length} image${newItems.length > 1 ? 's' : ''} added to gallery.`);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Add image from public URL
  const handleAddUrlImage = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) {
      setImageError('Please enter a valid image URL.');
      return;
    }
    try {
      new URL(trimmed);
    } catch (_) {
      setImageError('Please enter a valid URL (starting with http:// or https://).');
      return;
    }

    const seq = treatmentImages.length + 1;
    let derivedName = `Image #${seq}`;
    try {
      const pathname = new URL(trimmed).pathname;
      const last = pathname.split('/').filter(Boolean).pop();
      if (last && last.includes('.')) {
        derivedName = decodeURIComponent(last);
      }
    } catch (_) {}

    const newItem = {
      id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url: trimmed,
      sequence: seq,
      name: derivedName
    };

    setTreatmentImages(prev => [...prev, newItem]);
    setImageUrlInput('');
    setImageError(null);
    toast.success('Image URL added.');
  };

  // Delete individual image and re-sequence
  const handleDeleteImage = (id) => {
    setTreatmentImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      return filtered.map((img, idx) => ({
        ...img,
        sequence: idx + 1
      }));
    });
    toast('Image removed from gallery.', { icon: '🗑️' });
  };

  // Move up / down sequence buttons
  const handleMoveImage = (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= treatmentImages.length) return;

    setTreatmentImages(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated.map((item, idx) => ({
        ...item,
        sequence: idx + 1
      }));
    });
  };

  // Drag-and-drop sequence management
  const handleDragStart = (e, index) => {
    setDraggedImageIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedImageIndex === null || draggedImageIndex === targetIndex) {
      setDraggedImageIndex(null);
      return;
    }

    setTreatmentImages(prev => {
      const updated = [...prev];
      const [movedItem] = updated.splice(draggedImageIndex, 1);
      updated.splice(targetIndex, 0, movedItem);
      return updated.map((item, idx) => ({
        ...item,
        sequence: idx + 1
      }));
    });
    setDraggedImageIndex(null);
    toast.success('Image sequence reordered.');
  };

  // Replace individual image file from device
  const handleInitiateReplace = (item) => {
    setReplacingImageId(item.id);
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.click();
    }
  };

  const handleReplaceFileChange = (e) => {
    const file = e.target?.files?.[0];
    if (!file || !replacingImageId) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload a JPG, PNG, WEBP, or GIF.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setTreatmentImages(prev => prev.map(item => {
      if (item.id === replacingImageId) {
        return {
          ...item,
          url: previewUrl,
          file: file,
          name: file.name
        };
      }
      return item;
    }));

    toast.success('Image replaced.');
    setReplacingImageId(null);
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
  };

  // Edit image details (label or URL)
  const handleOpenEditImageModal = (item) => {
    setEditingImageItem(item);
    setEditingImageName(item.name || `Image #${item.sequence}`);
    setEditingImageUrl(item.url || '');
  };

  const handleSaveEditedImage = () => {
    if (!editingImageItem) return;
    setTreatmentImages(prev => prev.map(item => {
      if (item.id === editingImageItem.id) {
        return {
          ...item,
          name: editingImageName.trim() || item.name,
          url: editingImageUrl.trim() || item.url
        };
      }
      return item;
    }));
    toast.success('Image details updated.');
    setEditingImageItem(null);
  };

  // Upload single image file to Supabase Storage
  const uploadTreatmentImage = async (file) => {
    if (!file) return null;
    const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
    const fileName = `treatment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `treatments/${fileName}`;

    let targetBucket = null;
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketNames = Array.isArray(buckets) ? buckets.map(b => b.name || b.id) : [];
      if (bucketNames.includes('treatments')) targetBucket = 'treatments';
      else if (bucketNames.includes('treatment-images')) targetBucket = 'treatment-images';
      else if (bucketNames.includes('services')) targetBucket = 'services';
      else if (bucketNames.includes('products')) targetBucket = 'products';
      else if (bucketNames.includes('avatars')) targetBucket = 'avatars';
      else if (bucketNames.length > 0) targetBucket = bucketNames[0];
    } catch (_) { }

    const candidateBuckets = targetBucket
      ? [targetBucket, 'treatments', 'treatment-images', 'services', 'products', 'avatars']
      : ['treatments', 'treatment-images', 'services', 'products', 'avatars'];
    const uniqueBuckets = [...new Set(candidateBuckets)];

    for (const b of uniqueBuckets) {
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

    // High-performance fallback: Data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  // ─────────────────────────────────────────────────────────────
  // 5. DRAWER OPEN & CLOSE HANDLERS
  // ─────────────────────────────────────────────────────────────
  const handleOpenAddDrawer = () => {
    const firstCat = categories.length > 0 ? categories[0].name : 'Skin Rejuvenation';
    const firstDur = durations.length > 0 ? (durations.find(d => d.label === '60 Mins')?.label || durations[0].label) : '60 Mins';
    setFormData({
      ...DEFAULT_FORM,
      category: firstCat,
      category_id: categories[0]?.id || '',
      duration: firstDur,
      image_url: '',
      images: []
    });
    setTreatmentImages([]);
    setImageUrlInput('');
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
    setFormErrors({});
    setEditingTreatment(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (treatment) => {
    let loadedImages = [];
    if (Array.isArray(treatment.images) && treatment.images.length > 0) {
      loadedImages = treatment.images
        .map((img, idx) => {
          if (typeof img === 'string') {
            return {
              id: `img_${idx}_${Date.now()}`,
              url: img,
              sequence: idx + 1,
              name: `Image #${idx + 1}`
            };
          }
          return {
            id: img.id || `img_${idx}_${Date.now()}`,
            url: img.url || '',
            sequence: typeof img.sequence === 'number' ? img.sequence : idx + 1,
            name: img.name || `Image #${idx + 1}`
          };
        })
        .filter(item => Boolean(item.url))
        .sort((a, b) => a.sequence - b.sequence);
    } else if (treatment.image_url || treatment.image) {
      const singleUrl = treatment.image_url || treatment.image;
      loadedImages = [
        {
          id: `img_primary_${Date.now()}`,
          url: singleUrl,
          sequence: 1,
          name: 'Primary Image'
        }
      ];
    }

    setTreatmentImages(loadedImages);
    setFormData({
      protocol_title: treatment.protocol_title || treatment.title || '',
      category_id: treatment.category_id || '',
      category: treatment.category || (categories[0]?.name || 'Skin Rejuvenation'),
      price: treatment.price ? String(treatment.price) : '',
      duration: treatment.duration || '60 Mins',
      status: treatment.status || 'Active',
      tagline: treatment.tagline || '',
      clinical_description: treatment.clinical_description || treatment.description || '',
      image_url: loadedImages[0]?.url || '',
      images: loadedImages
    });
    setImageUrlInput('');
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
    setFormErrors({});
    setEditingTreatment(treatment);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    if (!submitting) {
      setIsDrawerOpen(false);
      setEditingTreatment(null);
      setFormErrors({});
      setTreatmentImages([]);
      setImageUrlInput('');
      setImageError(null);
      setReplacingImageId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 6. VALIDATION & SAVE TREATMENT (CREATE & UPDATE)
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
    setUploadingImage(true);

    let finalImagesList = [];
    try {
      for (let i = 0; i < treatmentImages.length; i++) {
        const item = treatmentImages[i];
        let finalUrl = item.url;
        if (item.file) {
          try {
            const uploadedUrl = await uploadTreatmentImage(item.file);
            if (uploadedUrl) finalUrl = uploadedUrl;
          } catch (uploadErr) {
            console.warn('Image upload error for file:', item.name, uploadErr);
          }
        }
        finalImagesList.push({
          id: item.id || `img_${Date.now()}_${i}`,
          url: finalUrl,
          sequence: i + 1,
          name: item.name || `Image #${i + 1}`
        });
      }
    } finally {
      setUploadingImage(false);
    }

    const primaryImageUrl = finalImagesList[0]?.url || null;
    const numPrice = parseFloat(formData.price);

    const treatmentPayload = {
      protocol_title: formData.protocol_title.trim(),
      category: formData.category.trim(),
      // category_id intentionally omitted: the FK references the Products
      // 'categories' table. Treatment categories are managed independently
      // via the 'treatment_categories' table. The category name string is
      // the source of truth for treatment protocol lookups.
      price: numPrice,
      duration: formData.duration.trim(),
      status: formData.status,
      tagline: formData.tagline?.trim() || null,
      clinical_description: formData.clinical_description?.trim() || null,
      image_url: primaryImageUrl,
      images: finalImagesList,
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

        // Graceful retry without 'images' if column doesn't exist yet
        if (updateErr && (updateErr.message?.includes('images') || updateErr.code === '42703')) {
          const { images: _discardImages, ...fallbackImagesPayload } = treatmentPayload;
          const retryRes = await supabase
            .from('treatment_protocols')
            .update(fallbackImagesPayload)
            .eq('id', editingTreatment.id)
            .select()
            .single();
          if (!retryRes.error) {
            data = retryRes.data;
            updateErr = null;
          }
        }

        // Graceful retry without 'image_url' if column does not exist
        if (updateErr && (updateErr.message?.includes('image_url') || updateErr.code === '42703')) {
          const { image_url: _discardImg, images: _discardImg2, ...fallbackPayload } = treatmentPayload;
          const retryRes = await supabase
            .from('treatment_protocols')
            .update(fallbackPayload)
            .eq('id', editingTreatment.id)
            .select()
            .single();
          if (!retryRes.error) {
            data = retryRes.data;
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
            tagline: treatmentPayload.tagline,
            description: treatmentPayload.clinical_description,
            image_url: primaryImageUrl,
            image: primaryImageUrl
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
        if (selectedTreatment && selectedTreatment.id === editingTreatment.id) {
          setSelectedTreatment(prev => ({
            ...prev,
            ...treatmentPayload,
            images: finalImagesList
          }));
        }
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

        // Graceful retry without 'images' if column does not exist
        if (insertErr && (insertErr.message?.includes('images') || insertErr.code === '42703')) {
          const { images: _discardImages, ...fallbackImagesPayload } = insertPayload;
          const retryRes = await supabase
            .from('treatment_protocols')
            .insert([fallbackImagesPayload])
            .select()
            .single();
          if (!retryRes.error) {
            data = retryRes.data;
            insertErr = null;
          }
        }

        // Graceful retry without 'image_url' if column does not exist
        if (insertErr && (insertErr.message?.includes('image_url') || insertErr.code === '42703')) {
          const { image_url: _discardImg, images: _discardImg2, ...fallbackPayload } = insertPayload;
          const retryRes = await supabase
            .from('treatment_protocols')
            .insert([fallbackPayload])
            .select()
            .single();
          if (!retryRes.error) {
            data = retryRes.data;
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
            tagline: insertPayload.tagline,
            description: insertPayload.clinical_description,
            image_url: primaryImageUrl,
            image: primaryImageUrl,
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
  // 8. TREATMENT CATEGORY CRUD OPERATIONS
  //    NOTE: All operations target 'treatment_categories' table.
  //    The 'categories' table is used exclusively by Products
  //    and is never touched here.
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

      // Insert into treatment_categories (not the Products 'categories' table)
      const { data, error: catErr } = await supabase.from('treatment_categories').insert([payload]).select().single();
      if (!catErr && data) {
        created = data;
      } else {
        const adminRes = await supabaseAdmin.from('treatment_categories').insert([payload]).select().single();
        if (!adminRes.error && adminRes.data) created = adminRes.data;
      }

      const newCatItem = created || { id: `cat-${Date.now()}`, name: cleanName };
      const updatedList = [...categories, newCatItem].sort((a, b) => a.name.localeCompare(b.name));
      setCategories(updatedList);
      try { localStorage.setItem('bo_treatment_categories_cache', JSON.stringify(updatedList)); } catch (_) { }

      // If user was creating a treatment, set this new category as selected
      setFormData(prev => ({ ...prev, category: cleanName, category_id: newCatItem.id }));
      setNewCategoryName('');
      toast.success(`Category "${cleanName}" added.`);
    } catch (err) {
      console.error('Error adding treatment category:', err);
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
      // 1. Update in Supabase treatment_categories table (not Products 'categories')
      await supabase.from('treatment_categories').update({ name: cleanNewName, updated_at: new Date().toISOString() }).eq('id', catId);

      // 2. Cascade rename on treatment_protocols using this category
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
      console.error('Error updating treatment category:', err);
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
      // Delete from treatment_categories (not the Products 'categories' table)
      await supabase.from('treatment_categories').delete().eq('id', id);
      await supabase.from('treatment_categories').delete().eq('name', name);

      const updatedList = categories.filter(c => c.id !== id && c.name !== name);
      setCategories(updatedList);
      try { localStorage.setItem('bo_treatment_categories_cache', JSON.stringify(updatedList)); } catch (_) { }

      if (categoryFilter === name) setCategoryFilter('ALL');
      if (formData.category === name) {
        setFormData(f => ({ ...f, category: updatedList[0]?.name || '', category_id: updatedList[0]?.id || '' }));
      }

      setCategoryDeleteTarget(null);
      toast.success(`Category "${name}" deleted.`);
    } catch (err) {
      console.error('Error deleting treatment category:', err);
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
      render: (row) => {
        const rowImages = Array.isArray(row.images) ? row.images : [];
        const primaryImg = rowImages.find(img => img.sequence === 1) || rowImages[0];
        const imageUrl = primaryImg?.url || row.image_url || row.image || null;
        const totalCount = rowImages.length > 0 ? rowImages.length : (imageUrl ? 1 : 0);

        return (
          <div
            onClick={() => setSelectedTreatment(row)}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
            title={`View ${row.protocol_title} details & gallery`}
          >
            {/* Small dynamic thumbnail or fallback placeholder */}
            <div
              style={{
                position: 'relative',
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                overflow: 'hidden',
                flexShrink: 0,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={row.protocol_title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div
                style={{
                  color: '#94a3b8',
                  display: imageUrl ? 'none' : 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%'
                }}
              >
                <ImageIcon size={18} />
              </div>

              {/* Multi-image count overlay badge */}
              {totalCount > 1 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '2px',
                    background: 'rgba(15, 23, 42, 0.82)',
                    color: '#ffffff',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    padding: '1px 3.5px',
                    borderRadius: '4px',
                    lineHeight: 1,
                    letterSpacing: '-0.2px',
                    backdropFilter: 'blur(2px)'
                  }}
                  title={`${totalCount} treatment photos`}
                >
                  +{totalCount - 1}
                </div>
              )}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#0f2942', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.protocol_title}
                </span>
                {totalCount > 1 && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      color: '#475569',
                      background: '#f1f5f9',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      flexShrink: 0
                    }}
                    title={`${totalCount} treatment images saved`}
                  >
                    <ImageIcon size={10} />
                    {totalCount}
                  </span>
                )}
              </div>
              {row.tagline && (
                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.tagline}
                </div>
              )}
            </div>
          </div>
        );
      }
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
        showLoadingBar={false}
        showSkeleton={false}
        loadingMessage="Loading treatments..."
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
        subtitle="Configure clinician credentials, protocol pricing, and duration."
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

            {/* Status * (Active / Inactive) — spans full row since Appointment Date removed */}
            <div className="admin-form-group" style={{ gridColumn: '1 / -1' }}>
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
          </div>

          {/* Treatment Images & Multi-Image Gallery */}
          <div className="admin-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="admin-form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ImageIcon size={15} color="#1e5aa8" />
                <span>Treatment Images & Gallery</span>
              </label>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: treatmentImages.length > 0 ? '#1e5aa8' : '#94a3b8',
                  background: treatmentImages.length > 0 ? '#eff6ff' : '#f1f5f9',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  border: treatmentImages.length > 0 ? '1px solid #bfdbfe' : '1px solid #e2e8f0'
                }}
              >
                {treatmentImages.length} {treatmentImages.length === 1 ? 'Image' : 'Images'}
              </span>
            </div>

            <div style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: '12px', lineHeight: 1.4 }}>
              Add multiple images from your device or via public URLs. Drag and drop to adjust sequence. <strong style={{ color: '#0f2942' }}>Image #1</strong> serves as the primary cover image.
            </div>

            {/* Hidden native file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/jpg,image/gif,image/svg+xml"
              style={{ display: 'none' }}
              onChange={(e) => handleAddFiles(e.target.files)}
            />
            <input
              ref={replaceFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg,image/gif,image/svg+xml"
              style={{ display: 'none' }}
              onChange={handleReplaceFileChange}
            />

            {/* Gallery Image Sequence List */}
            {treatmentImages.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                {treatmentImages.map((item, index) => {
                  const isPrimary = index === 0;
                  const isDragged = draggedImageIndex === index;

                  return (
                    <div
                      key={item.id || index}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px',
                        borderRadius: '10px',
                        background: isPrimary ? '#f8faff' : '#ffffff',
                        border: isPrimary ? '1.5px solid #93c5fd' : '1px solid #e2e8f0',
                        opacity: isDragged ? 0.4 : 1,
                        boxShadow: isPrimary ? '0 2px 6px rgba(30,90,168,0.06)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Drag Handle */}
                      <div
                        style={{
                          cursor: 'grab',
                          color: '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '2px'
                        }}
                        title="Drag to reorder sequence"
                      >
                        <GripVertical size={16} />
                      </div>

                      {/* Sequence Badge */}
                      <div
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          whiteSpace: 'nowrap',
                          background: isPrimary ? '#1e5aa8' : '#f1f5f9',
                          color: isPrimary ? '#ffffff' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        title={`Sequence #${item.sequence || index + 1}`}
                      >
                        #{item.sequence || index + 1}
                        {isPrimary && <span style={{ fontSize: '0.62rem', opacity: 0.9 }}>Cover</span>}
                      </div>

                      {/* Thumbnail Preview */}
                      <div
                        onClick={() => setViewingImage(item)}
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          flexShrink: 0,
                          cursor: 'pointer',
                          position: 'relative'
                        }}
                        title="Click to view full size"
                      >
                        <img
                          src={item.url}
                          alt={item.name || `Image #${index + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>

                      {/* Image Meta / Name */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: '#1e293b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={item.name}
                        >
                          {item.name || `Image #${index + 1}`}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              color: item.file ? '#0284c7' : '#059669',
                              background: item.file ? '#e0f2fe' : '#d1fae5',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}
                          >
                            {item.file ? 'Device Upload' : 'URL Link'}
                          </span>
                          {item.file && (
                            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                              {(item.file.size / 1024).toFixed(0)} KB
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons: Move Up/Down, View, Edit, Replace, Delete */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <button
                          type="button"
                          onClick={() => handleMoveImage(index, 'up')}
                          disabled={index === 0}
                          style={{
                            background: 'transparent',
                            border: '1px solid #e2e8f0',
                            borderRadius: '5px',
                            padding: '4px',
                            cursor: index === 0 ? 'not-allowed' : 'pointer',
                            color: index === 0 ? '#cbd5e1' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Move up in sequence"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveImage(index, 'down')}
                          disabled={index === treatmentImages.length - 1}
                          style={{
                            background: 'transparent',
                            border: '1px solid #e2e8f0',
                            borderRadius: '5px',
                            padding: '4px',
                            cursor: index === treatmentImages.length - 1 ? 'not-allowed' : 'pointer',
                            color: index === treatmentImages.length - 1 ? '#cbd5e1' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Move down in sequence"
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewingImage(item)}
                          style={{
                            background: 'transparent',
                            border: '1px solid #e2e8f0',
                            borderRadius: '5px',
                            padding: '4px',
                            cursor: 'pointer',
                            color: '#1e5aa8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="View full image"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditImageModal(item)}
                          style={{
                            background: 'transparent',
                            border: '1px solid #e2e8f0',
                            borderRadius: '5px',
                            padding: '4px',
                            cursor: 'pointer',
                            color: '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Edit label or URL"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInitiateReplace(item)}
                          style={{
                            background: 'transparent',
                            border: '1px solid #e2e8f0',
                            borderRadius: '5px',
                            padding: '4px',
                            cursor: 'pointer',
                            color: '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Replace image from device"
                        >
                          <Camera size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(item.id)}
                          style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '5px',
                            padding: '4px',
                            cursor: 'pointer',
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Delete image"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Images Controls: Upload Multi-file & Add via URL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Dropzone Upload Button */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files?.length) {
                    handleAddFiles(e.dataTransfer.files);
                  }
                }}
                style={{
                  border: '1.5px dashed #cbd5e1',
                  borderRadius: '10px',
                  padding: '16px 14px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: '#f8fafc',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1e5aa8'; e.currentTarget.style.background = '#f0f7ff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#e0f2fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0284c7',
                    flexShrink: 0
                  }}
                >
                  <Upload size={16} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                    Select / Upload Images from Device
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Supports multi-selection • JPG, PNG, WEBP, GIF (up to 10MB each)
                  </div>
                </div>
              </div>

              {/* Add by Image URL Bar */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="url"
                  className="admin-form-input"
                  placeholder="Paste image URL (e.g. https://.../photo.jpg)"
                  value={imageUrlInput}
                  onChange={(e) => {
                    setImageUrlInput(e.target.value);
                    if (imageError) setImageError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddUrlImage();
                    }
                  }}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}
                />
                <AdminButton
                  type="button"
                  variant="secondary"
                  onClick={handleAddUrlImage}
                  disabled={!imageUrlInput.trim()}
                  icon={<Link size={13} />}
                  style={{ whiteSpace: 'nowrap', padding: '8px 14px' }}
                >
                  Add URL
                </AdminButton>
              </div>
            </div>

            {/* Error Message */}
            {imageError && (
              <div
                style={{
                  fontSize: '0.76rem',
                  color: '#dc2626',
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <AlertCircle size={13} />
                <span>{imageError}</span>
              </div>
            )}
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
            {/* Treatment Gallery & Hero Preview */}
            {overviewImages.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Active Hero Image Container */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '220px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: '#0f172a',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <img
                    src={overviewImages[overviewActiveImageIndex]?.url}
                    alt={overviewImages[overviewActiveImageIndex]?.name || selectedTreatment.protocol_title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />

                  {/* Sequence Pill Badge */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      background: 'rgba(15, 23, 42, 0.78)',
                      backdropFilter: 'blur(6px)',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '4px 9px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    #{overviewImages[overviewActiveImageIndex]?.sequence || overviewActiveImageIndex + 1}
                    {overviewActiveImageIndex === 0 && (
                      <span style={{ fontSize: '0.64rem', color: '#93c5fd' }}>• Cover Image</span>
                    )}
                  </div>

                  {/* View Full Screen / Zoom Button */}
                  <button
                    type="button"
                    onClick={() => setViewingImage(overviewImages[overviewActiveImageIndex])}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'rgba(15, 23, 42, 0.78)',
                      backdropFilter: 'blur(6px)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="View full resolution"
                  >
                    <Maximize2 size={14} />
                  </button>

                  {/* Previous / Next Arrow Controls */}
                  {overviewImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setOverviewActiveImageIndex(prev => (prev > 0 ? prev - 1 : overviewImages.length - 1))}
                        style={{
                          position: 'absolute',
                          left: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'rgba(255, 255, 255, 0.9)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                        title="Previous image"
                      >
                        <ChevronLeft size={16} color="#0f172a" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setOverviewActiveImageIndex(prev => (prev < overviewImages.length - 1 ? prev + 1 : 0))}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'rgba(255, 255, 255, 0.9)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                        title="Next image"
                      >
                        <ChevronRight size={16} color="#0f172a" />
                      </button>
                    </>
                  )}
                </div>

                {/* Horizontal Sequence Thumbnails Strip */}
                {overviewImages.length > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      overflowX: 'auto',
                      paddingBottom: '4px'
                    }}
                  >
                    {overviewImages.map((img, idx) => {
                      const isActive = idx === overviewActiveImageIndex;
                      return (
                        <button
                          key={img.id || idx}
                          type="button"
                          onClick={() => setOverviewActiveImageIndex(idx)}
                          style={{
                            position: 'relative',
                            width: '58px',
                            height: '58px',
                            flexShrink: 0,
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: isActive ? '2px solid #1e5aa8' : '1px solid #cbd5e1',
                            padding: 0,
                            cursor: 'pointer',
                            background: '#f8fafc',
                            transition: 'all 0.15s ease',
                            opacity: isActive ? 1 : 0.7
                          }}
                        >
                          <img
                            src={img.url}
                            alt={img.name || `Thumbnail #${idx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <span
                            style={{
                              position: 'absolute',
                              bottom: '2px',
                              right: '2px',
                              background: 'rgba(15, 23, 42, 0.8)',
                              color: '#fff',
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              padding: '1px 4px',
                              borderRadius: '3px'
                            }}
                          >
                            #{img.sequence || idx + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  width: '100%',
                  padding: '24px 16px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1.5px dashed #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  color: '#94a3b8'
                }}
              >
                <ImageIcon size={26} />
                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>No treatment imagery uploaded</span>
              </div>
            )}

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
                Protocol Specifications
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

      {/* ── Lightbox / Full-Resolution View Modal ── */}
      <AdminModal
        isOpen={Boolean(viewingImage)}
        onClose={() => setViewingImage(null)}
        title={viewingImage ? `Image #${viewingImage.sequence || 1} Preview` : 'Image Preview'}
        maxWidth="680px"
      >
        {viewingImage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                width: '100%',
                maxHeight: '480px',
                borderRadius: '10px',
                overflow: 'hidden',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #e2e8f0'
              }}
            >
              <img
                src={viewingImage.url}
                alt={viewingImage.name || 'Treatment Image'}
                style={{ maxWidth: '100%', maxHeight: '480px', objectFit: 'contain' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b' }}>
                  {viewingImage.name || `Image #${viewingImage.sequence || 1}`}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                  Sequence Order: #{viewingImage.sequence || 1} {viewingImage.sequence === 1 ? '• Primary Cover Photo' : ''}
                </div>
              </div>
              <AdminButton variant="secondary" onClick={() => setViewingImage(null)}>
                Close Preview
              </AdminButton>
            </div>
          </div>
        )}
      </AdminModal>

      {/* ── Edit Image Details Modal ── */}
      <AdminModal
        isOpen={Boolean(editingImageItem)}
        onClose={() => setEditingImageItem(null)}
        title="Edit Image Details"
        maxWidth="500px"
      >
        {editingImageItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid #cbd5e1',
                  flexShrink: 0,
                  background: '#f8fafc'
                }}
              >
                <img
                  src={editingImageItem.url}
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Sequence Position</div>
                <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0f2942' }}>
                  #{editingImageItem.sequence || 1} {editingImageItem.sequence === 1 ? '• Primary Cover' : ''}
                </div>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Image Label / Description</label>
              <input
                type="text"
                className="admin-form-input"
                value={editingImageName}
                onChange={(e) => setEditingImageName(e.target.value)}
                placeholder="e.g. Clinical Before & After, Close-up Result"
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Image URL / Reference</label>
              <input
                type="text"
                className="admin-form-input"
                value={editingImageUrl}
                onChange={(e) => setEditingImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <AdminButton variant="secondary" onClick={() => setEditingImageItem(null)}>
                Cancel
              </AdminButton>
              <AdminButton variant="primary" onClick={handleSaveEditedImage}>
                Save Details
              </AdminButton>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
};
