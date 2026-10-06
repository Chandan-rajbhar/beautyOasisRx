import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ShoppingBag,
  Plus,
  Eye,
  Edit2,
  Trash2,
  DollarSign,
  Package,
  Layers,
  AlertTriangle,
  MoreVertical,
  Camera,
  X,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  FolderPlus,
  Check,
  Loader2,
  Tag
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { sanitizeCacheData } from '../../services/supabaseDataService';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';
import { ShadcnSelect } from '../../components/ui/select';
import toast from 'react-hot-toast';

// ── Default Categories fallback ──────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  'Serums & Actives',
  'Cleansers & Tonics',
  'Creams & Balms',
  'Sun Protection',
  'Treatment Kits'
];

const cacheProductImage = (key, image) => {
  try {
    if (/^data:image\//i.test(image || '')) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, image);
  } catch (_) {}
};

// ── SKU Generator Strategy: BO-XXXX ──────────────────────────────────────────
const generateUniqueSku = (existingList = []) => {
  const existingSkus = new Set(
    existingList.map(p => (p.sku || '').toUpperCase().trim()).filter(Boolean)
  );

  for (let attempt = 0; attempt < 50; attempt++) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const candidate = `BO-${randomNum}`;
    if (!existingSkus.has(candidate)) {
      return candidate;
    }
  }
  return `BO-${Date.now().toString().slice(-4)}`;
};

export const ProductsPage = () => {
  const {
    products: contextProducts = [],
    categories: contextCategories = [],
    createItem,
    updateItem,
    deleteItem,
    isLoading: contextLoading
  } = useAdminData();

  // ── Dynamic State (Hydrated from cache/context for 0ms initial render) ────
  const [products, setProducts] = useState(() => {
    if (Array.isArray(contextProducts) && contextProducts.length > 0) return contextProducts;
    try {
      const cached = localStorage.getItem('cached_dynamic_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  });
  const [categories, setCategories] = useState(() => {
    if (Array.isArray(contextCategories) && contextCategories.length > 0) return contextCategories;
    try {
      const cached = localStorage.getItem('cached_product_categories');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_CATEGORIES.map((name, idx) => ({ id: `cat-${idx + 1}`, name }));
  });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Filters & Search ──────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter]);

  // ── Drawer & Modal States ─────────────────────────────────────────────────
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // ── Category Management Modal State ───────────────────────────────────────
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null); // { id, name } or string
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [categoryDeleteTarget, setCategoryDeleteTarget] = useState(null); // { id, name, count }
  const [categoryActionLoading, setCategoryActionLoading] = useState(false);

  // ── Three-dot action menu (viewport-positioned) ───────────────────────────
  const [actionMenuProductId, setActionMenuProductId] = useState(null);
  const [actionMenuPosition, setActionMenuPosition] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.product-action-menu-container') && !e.target.closest('.product-action-dropdown-menu')) {
        setActionMenuProductId(null);
        setActionMenuPosition(null);
      }
    };
    const handleWindowChange = () => {
      if (actionMenuProductId) {
        setActionMenuProductId(null);
        setActionMenuPosition(null);
      }
    };
    if (actionMenuProductId) {
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
  }, [actionMenuProductId]);

  // ── Product Image State ───────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [imageError, setImageError] = useState(null);
  const fileInputRef = useRef(null);

  // ── Product Form State ────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: '',
    subtitle: '',
    category: '',
    price: '',
    stock: '',
    sku: '',
    status: 'In Stock',
    description: ''
  });
  const [formError, setFormError] = useState('');

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH CATEGORIES FROM SUPABASE
  // ─────────────────────────────────────────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    try {
      // 1. Query Supabase categories table
      let { data, error: catErr } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      // Fallback with admin client if authenticated policy hits recursion
      if (catErr || !data) {
        try {
          const adminRes = await supabaseAdmin.from('categories').select('*').order('name', { ascending: true });
          if (!adminRes.error && adminRes.data) {
            data = adminRes.data;
            catErr = null;
          }
        } catch (_) {}
      }

      if (!catErr && Array.isArray(data) && data.length > 0) {
        const catList = data.map(c => typeof c === 'string' ? { id: c, name: c } : { id: c.id || c.name, name: c.name || c.category_name });
        setCategories(catList);
        try { localStorage.setItem('cached_product_categories', JSON.stringify(catList)); } catch (_) {}
        return catList;
      }
    } catch (err) {
      console.warn('Categories query notice:', err);
    }

    // Fallback: restore from localStorage or default list
    let fallbackCats = DEFAULT_CATEGORIES.map((name, idx) => ({ id: `cat-${idx + 1}`, name }));
    try {
      const raw = localStorage.getItem('cached_product_categories');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) fallbackCats = parsed;
      }
    } catch (_) {}

    setCategories(fallbackCats);
    return fallbackCats;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH PRODUCTS FROM SUPABASE
  // ─────────────────────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    let rawData = null;
    let isFetchError = false;

    // 1. Primary: query 'products' table via standard client
    try {
      const res = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (!res.error && res.data) {
        rawData = res.data;
      } else {
        const retryRes = await supabase.from('products').select('*');
        if (!retryRes.error && retryRes.data) {
          rawData = retryRes.data;
        }
      }
    } catch (_) {}

    // 2. Fallback: try supabaseAdmin client
    if (rawData === null) {
      try {
        const adminRes = await supabaseAdmin
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });
        if (!adminRes.error && adminRes.data) {
          rawData = adminRes.data;
        } else {
          const plainRes = await supabaseAdmin.from('products').select('*');
          if (!plainRes.error && plainRes.data) {
            rawData = plainRes.data;
          }
        }
      } catch (_) {}
    }

    if (rawData === null) {
      isFetchError = true;
      rawData = [];
    }

    try {
      // Normalize product records
      const normalized = (rawData || []).map((p) => {
        let cachedImage = null;
        try {
          if (p.sku) cachedImage = localStorage.getItem(`product_img_${p.sku}`);
          if (!cachedImage && p.id) cachedImage = localStorage.getItem(`product_img_${p.id}`);
        } catch (_) {}

        const finalImage = p.image_url || p.image || p.imageUrl || cachedImage || null;
        const rawStock = Number(p.stock !== undefined ? p.stock : (p.inventory_stock !== undefined ? p.inventory_stock : 0));
        const rawPrice = Number(p.price !== undefined ? p.price : 0);

        let finalStatus = p.status || p.stock_status || 'In Stock';
        if (rawStock <= 0) finalStatus = 'Out of Stock';
        else if (rawStock < 5 && finalStatus !== 'Out of Stock') finalStatus = 'Low Stock';

        return {
          ...p,
          id: p.id,
          name: p.name || p.product_name || 'Unnamed Product',
          subtitle: p.subtitle || p.packaging || p.volume_subtitle || '',
          category: p.category || 'Serums & Actives',
          sku: p.sku || `BO-${Math.floor(1000 + Math.random() * 9000)}`,
          price: isNaN(rawPrice) ? 0 : rawPrice,
          stock: isNaN(rawStock) ? 0 : rawStock,
          status: finalStatus,
          description: p.description || '',
          image: finalImage,
          image_url: finalImage,
          created_at: p.created_at || new Date().toISOString(),
          updated_at: p.updated_at || new Date().toISOString()
        };
      });

      if (normalized.length > 0) {
        try { localStorage.setItem('cached_dynamic_products', JSON.stringify(sanitizeCacheData(normalized))); } catch (_) {}
        setProducts(normalized);
        setError(null);
      } else if (isFetchError) {
        let cached = null;
        try {
          const rawCached = localStorage.getItem('cached_dynamic_products');
          if (rawCached) cached = JSON.parse(rawCached);
        } catch (_) {}

        if (Array.isArray(cached) && cached.length > 0) {
          setProducts(cached);
          setError(null);
        } else {
          setProducts([]);
        }
      } else {
        setProducts([]);
        setError(null);
      }
    } catch (procErr) {
      console.error('Error normalizing products:', procErr);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [fetchCategories, fetchProducts]);

  // Sync with context if context loads products
  useEffect(() => {
    if (Array.isArray(contextProducts) && contextProducts.length > 0 && products.length === 0) {
      setProducts(contextProducts);
    }
  }, [contextProducts, products.length]);

  // ─────────────────────────────────────────────────────────────────────────
  // IMAGE UPLOAD HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = '';

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      const msg = 'Invalid file type. Please upload a JPG, JPEG, PNG, or WEBP image.';
      setImageError(msg);
      toast.error(msg);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      const msg = 'Image size exceeds 10MB limit. Please choose a smaller image.';
      setImageError(msg);
      toast.error(msg);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setImageError(null);
    setSelectedFile(file);

    // Instant local preview
    try {
      const objectUrl = URL.createObjectURL(file);
      setPreviewImageUrl(objectUrl);
    } catch (_) {}

    // Base64 persistence fallback
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const dataUrl = loadEvt.target?.result;
      if (dataUrl) setPreviewImageUrl(dataUrl);
    };
    reader.readAsDataURL(file);

    toast.success('Product image selected.');
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewImageUrl(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast('Product image removed.', { icon: '🗑️' });
  };

  const uploadProductImage = async (file) => {
    if (!file) return null;
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `product_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `products/${fileName}`;

    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketNames = Array.isArray(buckets) ? buckets.map(b => b.name || b.id) : [];

      const targetBucket = bucketNames.includes('products')
        ? 'products'
        : bucketNames.includes('avatars')
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
      console.warn('Storage upload notice:', storageErr);
    }

    // Graceful fallback to Base64 data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // OPEN ADD PRODUCT DRAWER
  // ─────────────────────────────────────────────────────────────────────────
  const handleOpenAddDrawer = () => {
    const autoSku = generateUniqueSku(products);
    const defaultCat = categories.length > 0 ? categories[0].name : 'Serums & Actives';

    setFormData({
      name: '',
      subtitle: '',
      category: defaultCat,
      price: '',
      stock: '',
      sku: autoSku,
      status: 'In Stock',
      description: ''
    });
    setEditProduct(null);
    setSelectedFile(null);
    setPreviewImageUrl(null);
    setImageError(null);
    setFormError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsAddDrawerOpen(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // OPEN EDIT PRODUCT DRAWER
  // ─────────────────────────────────────────────────────────────────────────
  const handleEditClick = (prod) => {
    setFormData({
      name: prod.name || '',
      subtitle: prod.subtitle || '',
      category: prod.category || (categories[0]?.name || 'Serums & Actives'),
      price: prod.price !== undefined ? String(prod.price) : '',
      stock: prod.stock !== undefined ? String(prod.stock) : '',
      sku: prod.sku || '',
      status: prod.status || 'In Stock',
      description: prod.description || ''
    });
    const existingImg = prod.image_url || prod.image || localStorage.getItem(`product_img_${prod.sku}`) || null;
    setPreviewImageUrl(existingImg);
    setSelectedFile(null);
    setImageError(null);
    setFormError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setEditProduct(prod);
    setIsAddDrawerOpen(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SAVE PRODUCT FORM (ADD / EDIT)
  // ─────────────────────────────────────────────────────────────────────────
  const handleSaveProduct = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setFormError('');

    // Validations
    if (!formData.name.trim()) {
      setFormError('Product name is required.');
      return;
    }
    if (!formData.category) {
      setFormError('Please select a product category.');
      return;
    }
    const parsedPrice = parseFloat(formData.price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setFormError('Please enter a valid price ($ USD).');
      return;
    }
    const parsedStock = parseInt(formData.stock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      setFormError('Please enter a valid inventory stock count.');
      return;
    }

    setActionLoading(true);
    try {
      // 1. Process image upload
      let finalImageUrl = previewImageUrl;
      if (selectedFile) {
        try {
          const uploadedUrl = await uploadProductImage(selectedFile);
          if (uploadedUrl) finalImageUrl = uploadedUrl;
        } catch (_) {}
      }

      const now = new Date().toISOString();
      const currentStock = parsedStock;
      let calculatedStatus = formData.status || 'In Stock';
      if (currentStock <= 0) calculatedStatus = 'Out of Stock';
      else if (currentStock < 5 && calculatedStatus !== 'Out of Stock') calculatedStatus = 'Low Stock';

      if (editProduct) {
        // ── EDIT PRODUCT ──
        const updatePayload = {
          name: formData.name.trim(),
          subtitle: formData.subtitle?.trim() || '',
          category: formData.category,
          price: parsedPrice,
          stock: currentStock,
          status: calculatedStatus,
          description: formData.description?.trim() || '',
          image: finalImageUrl || null,
          image_url: finalImageUrl || null,
          updated_at: now
        };

        let updateSuccess = false;
        try {
          const { error: upErr } = await supabase
            .from('products')
            .update(updatePayload)
            .eq('id', editProduct.id);

          if (!upErr) updateSuccess = true;
          else {
            const adminUp = await supabaseAdmin.from('products').update(updatePayload).eq('id', editProduct.id);
            if (!adminUp.error) updateSuccess = true;
          }
        } catch (_) {}

        // Fallback update in context/service
        if (!updateSuccess && updateItem) {
          try { updateItem('products', editProduct.id, updatePayload); } catch (_) {}
        }

        // Cache image in localStorage
        if (finalImageUrl) {
          if (editProduct.sku) cacheProductImage(`product_img_${editProduct.sku}`, finalImageUrl);
          if (editProduct.id) cacheProductImage(`product_img_${editProduct.id}`, finalImageUrl);
        } else {
          try {
            if (editProduct.sku) localStorage.removeItem(`product_img_${editProduct.sku}`);
            if (editProduct.id) localStorage.removeItem(`product_img_${editProduct.id}`);
          } catch (_) {}
        }

        // Optimistic UI update
        setProducts(prev =>
          prev.map(p => p.id === editProduct.id ? { ...p, ...updatePayload, sku: editProduct.sku } : p)
        );

        toast.success(`Product "${formData.name.trim()}" updated successfully.`);
        setEditProduct(null);
        setIsAddDrawerOpen(false);
      } else {
        // ── ADD PRODUCT ──
        // Ensure SKU is strictly unique
        let finalSku = formData.sku || generateUniqueSku(products);
        const skuCollision = products.some(p => (p.sku || '').toUpperCase() === finalSku.toUpperCase());
        if (skuCollision) {
          finalSku = generateUniqueSku(products);
        }

        const insertPayload = {
          name: formData.name.trim(),
          subtitle: formData.subtitle?.trim() || '',
          category: formData.category,
          sku: finalSku,
          price: parsedPrice,
          stock: currentStock,
          status: calculatedStatus,
          description: formData.description?.trim() || '',
          image: finalImageUrl || null,
          image_url: finalImageUrl || null,
          created_at: now,
          updated_at: now
        };

        let insertSuccess = false;
        let createdRecord = null;

        try {
          const { data: insData, error: insErr } = await supabase
            .from('products')
            .insert([insertPayload])
            .select()
            .single();

          if (!insErr && insData) {
            insertSuccess = true;
            createdRecord = insData;
          } else {
            const adminIns = await supabaseAdmin.from('products').insert([insertPayload]).select().single();
            if (!adminIns.error && adminIns.data) {
              insertSuccess = true;
              createdRecord = adminIns.data;
            }
          }
        } catch (_) {}

        if (!insertSuccess && createItem) {
          try {
            createdRecord = await createItem('products', insertPayload);
            insertSuccess = true;
          } catch (_) {}
        }

        const newProductObj = {
          ...(createdRecord || insertPayload),
          id: createdRecord?.id || `prod-${Date.now()}`,
          ...insertPayload
        };

        // Cache image in localStorage
        if (finalImageUrl) {
          cacheProductImage(`product_img_${finalSku}`, finalImageUrl);
          if (newProductObj.id) cacheProductImage(`product_img_${newProductObj.id}`, finalImageUrl);
        }

        // Optimistic UI insert
        setProducts(prev => [newProductObj, ...prev]);

        toast.success(`Apothecary product "${formData.name.trim()}" created.`);
        setIsAddDrawerOpen(false);
      }

      await fetchProducts();
    } catch (err) {
      console.error('Error saving product:', err);
      const msg = err?.message || 'Failed to save product formulation. Please try again.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE PRODUCT
  // ─────────────────────────────────────────────────────────────────────────
  const handleDeleteProduct = async () => {
    if (!deleteConfirmId) return;
    const targetProduct = products.find(p => p.id === deleteConfirmId);
    const prodName = targetProduct?.name || 'Product';

    setActionLoading(true);
    try {
      let delSuccess = false;
      try {
        const { error: delErr } = await supabase.from('products').delete().eq('id', deleteConfirmId);
        if (!delErr) delSuccess = true;
        else {
          const adminDel = await supabaseAdmin.from('products').delete().eq('id', deleteConfirmId);
          if (!adminDel.error) delSuccess = true;
        }
      } catch (_) {}

      if (!delSuccess && deleteItem) {
        try { await deleteItem('products', deleteConfirmId); } catch (_) {}
      }

      setProducts(prev => prev.filter(p => p.id !== deleteConfirmId));
      if (selectedProduct?.id === deleteConfirmId) setSelectedProduct(null);
      setDeleteConfirmId(null);
      toast.success(`Product "${prodName}" deleted successfully.`);
      await fetchProducts();
    } catch (err) {
      console.error('Delete product error:', err);
      toast.error('Failed to delete product: ' + (err?.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY MANAGEMENT: ADD / EDIT / DELETE
  // ─────────────────────────────────────────────────────────────────────────
  const handleAddCategory = async (e) => {
    if (e?.preventDefault) e.preventDefault();
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
      const newCatPayload = { name: cleanName, created_at: new Date().toISOString() };
      let createdCat = null;

      try {
        const { data, error } = await supabase.from('categories').insert([newCatPayload]).select().single();
        if (!error && data) createdCat = data;
        else {
          const adminRes = await supabaseAdmin.from('categories').insert([newCatPayload]).select().single();
          if (!adminRes.error && adminRes.data) createdCat = adminRes.data;
        }
      } catch (_) {}

      const newCatItem = createdCat || { id: `cat-${Date.now()}`, name: cleanName };
      const updatedList = [...categories, newCatItem].sort((a, b) => a.name.localeCompare(b.name));

      setCategories(updatedList);
      try { localStorage.setItem('cached_product_categories', JSON.stringify(updatedList)); } catch (_) {}

      setNewCategoryName('');
      toast.success(`Category "${cleanName}" added.`);
    } catch (err) {
      console.error('Add category error:', err);
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
      // 1. Update in categories table
      try {
        await supabase.from('categories').update({ name: cleanNewName, updated_at: new Date().toISOString() }).eq('id', catId);
      } catch (_) {}

      // 2. Cascade rename on products with this category
      try {
        await supabase.from('products').update({ category: cleanNewName }).eq('category', currentName);
      } catch (_) {}

      // Update state
      setCategories(prev =>
        prev.map(c => (c.id === catId || c.name === currentName) ? { ...c, name: cleanNewName } : c)
      );

      // Update products state locally
      setProducts(prev =>
        prev.map(p => p.category === currentName ? { ...p, category: cleanNewName } : p)
      );

      if (categoryFilter === currentName) setCategoryFilter(cleanNewName);
      if (formData.category === currentName) setFormData(f => ({ ...f, category: cleanNewName }));

      setEditingCategory(null);
      setEditingCategoryName('');
      toast.success(`Category renamed to "${cleanNewName}".`);
    } catch (err) {
      console.error('Update category error:', err);
      toast.error('Failed to update category: ' + (err?.message || 'Error'));
    } finally {
      setCategoryActionLoading(false);
    }
  };

  const handlePromptDeleteCategory = (cat) => {
    const count = products.filter(p => p.category === cat.name).length;
    setCategoryDeleteTarget({ ...cat, count });
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryDeleteTarget) return;
    const { id, name, count } = categoryDeleteTarget;

    setCategoryActionLoading(true);
    try {
      // 1. Delete from categories table
      try {
        await supabase.from('categories').delete().eq('id', id);
        await supabase.from('categories').delete().eq('name', name);
      } catch (_) {}

      const updatedList = categories.filter(c => c.id !== id && c.name !== name);
      setCategories(updatedList);
      try { localStorage.setItem('cached_product_categories', JSON.stringify(updatedList)); } catch (_) {}

      // If products were in this category, reassign them to first available category
      if (count > 0 && updatedList.length > 0) {
        const fallbackName = updatedList[0].name;
        try {
          await supabase.from('products').update({ category: fallbackName }).eq('category', name);
        } catch (_) {}
        setProducts(prev =>
          prev.map(p => p.category === name ? { ...p, category: fallbackName } : p)
        );
      }

      if (categoryFilter === name) setCategoryFilter('ALL');
      if (formData.category === name) setFormData(f => ({ ...f, category: updatedList[0]?.name || '' }));

      setCategoryDeleteTarget(null);
      toast.success(`Category "${name}" deleted.`);
    } catch (err) {
      console.error('Delete category error:', err);
      toast.error('Failed to delete category: ' + (err?.message || 'Error'));
    } finally {
      setCategoryActionLoading(false);
    }
  };

  // ── Filtered Products ─────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const searchLower = searchTerm.toLowerCase().trim();
      const matchSearch =
        !searchLower ||
        (prod.name || '').toLowerCase().includes(searchLower) ||
        (prod.subtitle || '').toLowerCase().includes(searchLower) ||
        (prod.sku || '').toLowerCase().includes(searchLower) ||
        (prod.category || '').toLowerCase().includes(searchLower) ||
        (prod.description || '').toLowerCase().includes(searchLower);

      const matchCat = categoryFilter === 'ALL' || prod.category === categoryFilter;
      const matchStatus = statusFilter === 'ALL' || prod.status === statusFilter;

      return matchSearch && matchCat && matchStatus;
    });
  }, [products, searchTerm, categoryFilter, statusFilter]);

  // ─────────────────────────────────────────────────────────────────────────
  // TABLE COLUMNS CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────
  const columns = [
    {
      header: 'Product Name',
      accessor: 'name',
      sortable: true,
      render: (row) => {
        const img = row.image_url || row.image;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Product Image / Icon Thumbnail */}
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {img ? (
                <img
                  src={img}
                  alt={row.name}
                  loading="lazy"
                  decoding="async"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                style={{
                  display: img ? 'none' : 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  color: '#1e5aa8'
                }}
              >
                <Package size={18} />
              </div>
            </div>

            {/* Title & Subtitle */}
            <div>
              <div style={{ fontWeight: 600, color: '#0f2942', fontSize: '0.9rem', lineHeight: 1.3 }}>
                {row.name}
              </div>
              {row.subtitle ? (
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px', lineHeight: 1.2 }}>
                  {row.subtitle}
                </div>
              ) : (
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'monospace', marginTop: '2px' }}>
                  {row.sku}
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
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#334155',
            display: 'inline-block',
            border: '1px solid #e2e8f0'
          }}
        >
          {row.category}
        </span>
      )
    },
    {
      header: 'SKU',
      accessor: 'sku',
      sortable: true,
      render: (row) => (
        <span style={{ fontSize: '0.8rem', color: '#475569', fontFamily: 'monospace', fontWeight: 600 }}>
          {row.sku || '—'}
        </span>
      )
    },
    {
      header: 'Price',
      accessor: 'price',
      sortable: true,
      render: (row) => (
        <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.92rem' }}>
          ${Number(row.price || 0).toFixed(2)}
        </div>
      )
    },
    {
      header: 'Inventory Stock',
      accessor: 'stock',
      sortable: true,
      render: (row) => {
        const stockNum = Number(row.stock || 0);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, color: stockNum < 5 ? '#b91c1c' : '#0f2942', fontSize: '0.9rem' }}>
              {stockNum}
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>units</span>
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (row) => <AdminBadge status={row.status || (row.stock > 0 ? 'In Stock' : 'Out of Stock')} />
    },
    {
      header: 'Actions',
      align: 'right',
      width: '70px',
      render: (row) => {
        const isOpen = actionMenuProductId === row.id;
        return (
          <div className="product-action-menu-container" style={{ position: 'relative', display: 'inline-block' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (actionMenuProductId === row.id) {
                  setActionMenuProductId(null);
                  setActionMenuPosition(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dropdownH = 145;
                  const openUp = window.innerHeight - rect.bottom < dropdownH && rect.top > dropdownH;
                  setActionMenuPosition({
                    top: openUp ? rect.top - dropdownH - 6 : rect.bottom + 6,
                    right: Math.max(16, window.innerWidth - rect.right)
                  });
                  setActionMenuProductId(row.id);
                }
              }}
              title="Actions"
              aria-label="Actions menu"
              style={{
                background: isOpen ? '#e2e8f0' : '#f8fafc',
                border: `1px solid ${isOpen ? '#94a3b8' : '#cbd5e1'}`,
                borderRadius: '6px',
                padding: '6px 8px',
                cursor: 'pointer',
                color: '#334155',
                display: 'inline-flex',
                alignItems: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <MoreVertical size={16} />
            </button>

            {isOpen && actionMenuPosition && (
              <div
                className="product-action-dropdown-menu"
                style={{
                  position: 'fixed',
                  top: `${actionMenuPosition.top}px`,
                  right: `${actionMenuPosition.right}px`,
                  width: '155px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px -5px rgba(15,41,66,0.14), 0 8px 10px -6px rgba(15,41,66,0.08)',
                  zIndex: 99999,
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* View */}
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuProductId(null);
                    setActionMenuPosition(null);
                    setSelectedProduct(row);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '8px 10px', border: 'none',
                    background: 'transparent', borderRadius: '6px',
                    fontSize: '0.82rem', fontWeight: 500, color: '#0f2942',
                    cursor: 'pointer', transition: 'background 0.15s ease', textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f7ff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Eye size={15} color="#1e5aa8" />
                  <span>View Details</span>
                </button>

                {/* Edit */}
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuProductId(null);
                    setActionMenuPosition(null);
                    handleEditClick(row);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '8px 10px', border: 'none',
                    background: 'transparent', borderRadius: '6px',
                    fontSize: '0.82rem', fontWeight: 500, color: '#0f2942',
                    cursor: 'pointer', transition: 'background 0.15s ease', textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f7ff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Edit2 size={15} color="#475569" />
                  <span>Edit Product</span>
                </button>

                <div style={{ height: '1px', background: '#f1f5f9', margin: '3px 0' }} />

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuProductId(null);
                    setActionMenuPosition(null);
                    setDeleteConfirmId(row.id);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '8px 10px', border: 'none',
                    background: 'transparent', borderRadius: '6px',
                    fontSize: '0.82rem', fontWeight: 500, color: '#dc2626',
                    cursor: 'pointer', transition: 'background 0.15s ease', textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Trash2 size={15} color="#dc2626" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        );
      }
    }
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Page Header ── */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Clinical Apothecary Products</h1>
          <p>Manage pharmaceutical formulations, active stock levels, pricing, and retail inventory.</p>
        </div>

        <div className="admin-page-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AdminButton
            variant="secondary"
            onClick={() => setIsCategoryModalOpen(true)}
            icon={<Layers size={16} />}
          >
            Manage Categories
          </AdminButton>
          <AdminButton
            variant="primary"
            onClick={handleOpenAddDrawer}
            icon={<Plus size={16} />}
          >
            Add Product Formulation
          </AdminButton>
        </div>
      </div>

      {/* ── Toolbar: Search & Dynamic Filters ── */}
      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search products by title, category, SKU..."
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
              { label: 'All Stock Status', value: 'ALL' },
              { label: 'In Stock', value: 'In Stock' },
              { label: 'Low Stock', value: 'Low Stock' },
              { label: 'Out of Stock', value: 'Out of Stock' }
            ]
          }
        ]}
      />

      {/* ── Products Table ── */}
      <AdminTable
        columns={columns}
        data={filteredProducts}
        loading={loading}
        itemsPerPage={10}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        itemLabel="products"
        emptyTitle="No apothecary products found"
        emptyDescription="Adjust your search criteria or register a new formulation."
        emptyActionLabel="Add Product"
        onEmptyAction={handleOpenAddDrawer}
      />

      {/* ── Add / Edit Right-Side Drawer ── */}
      <AdminDrawer
        isOpen={isAddDrawerOpen || Boolean(editProduct)}
        onClose={() => {
          setIsAddDrawerOpen(false);
          setEditProduct(null);
          setFormError('');
        }}
        title={editProduct ? "Edit Apothecary Product" : "Add Apothecary Product"}
        subtitle={editProduct ? `SKU: ${editProduct.sku}` : "Enter pharmaceutical product formulation and inventory details."}
        width="560px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
            <AdminButton
              variant="secondary"
              disabled={actionLoading}
              onClick={() => {
                setIsAddDrawerOpen(false);
                setEditProduct(null);
                setFormError('');
              }}
            >
              Cancel
            </AdminButton>
            <AdminButton
              type="submit"
              form="apothecary-product-form"
              variant="primary"
              disabled={actionLoading}
              icon={actionLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              onClick={handleSaveProduct}
            >
              {actionLoading ? "Saving..." : editProduct ? "Save Product Changes" : "Save Product Formulation"}
            </AdminButton>
          </div>
        }
      >
        {/* Error Alert */}
        {formError && (
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
            <div style={{ flex: 1, lineHeight: 1.4 }}>{formError}</div>
          </div>
        )}

        <form id="apothecary-product-form" onSubmit={handleSaveProduct} autoComplete="off" noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* 1. Product Image Upload */}
            <div className="admin-form-group">
              <label className="admin-form-label" style={{ display: 'block', marginBottom: '8px' }}>
                Product Image
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '2px solid #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: previewImageUrl ? '#f8fafc' : 'linear-gradient(135deg, #1e5aa8 0%, #16a34a 100%)',
                    color: '#ffffff',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(15,41,66,0.08)'
                  }}
                >
                  {previewImageUrl ? (
                    <img
                      src={previewImageUrl}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <Package size={28} />
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    style={{ display: 'none' }}
                    onChange={handleImageSelect}
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
                      {previewImageUrl ? 'Replace Image' : 'Upload Image'}
                    </button>
                    {previewImageUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
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
                        <X size={14} /> Remove
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Accepts JPG, PNG, WEBP (max 10MB)</span>
                  {imageError && (
                    <div style={{ fontSize: '0.78rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={13} />
                      <span>{imageError}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Product Name */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Product Name *
              </label>
              <input
                type="text"
                required
                className="admin-form-input"
                placeholder="e.g. Cellular Restorative Bio-Ferment Crème"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Packaging / Volume Subtitle */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Packaging / Volume Subtitle
              </label>
              <input
                type="text"
                className="admin-form-input"
                placeholder="30ml | Pharmaceutical Bio-Active Matrix"
                value={formData.subtitle}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              />
            </div>

            {/* 3. Category (with Manage Categories button) */}
            <div className="admin-form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label className="admin-form-label" style={{ margin: 0 }}>
                  Category *
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1e5aa8',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0
                  }}
                >
                  <Layers size={13} /> Manage Categories
                </button>
              </div>

              <select
                className="admin-form-select"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.id || c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Price & Inventory Stock (Side-by-side) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">
                  Price ($ USD) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="admin-form-input"
                    placeholder="125.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    style={{ paddingLeft: '28px' }}
                  />
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 600 }}>
                    $
                  </span>
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  Inventory Stock *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  className="admin-form-input"
                  placeholder="30"
                  value={formData.stock}
                  onChange={(e) => {
                    const val = e.target.value;
                    const num = parseInt(val, 10);
                    setFormData(prev => ({
                      ...prev,
                      stock: val,
                      status: num === 0 ? 'Out of Stock' : (num < 5 ? 'Low Stock' : 'In Stock')
                    }));
                  }}
                />
              </div>
            </div>

            {/* 5. SKU (Auto-generated & read-only) & Stock Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="admin-form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="admin-form-label" style={{ margin: 0 }}>
                    SKU Identifier
                  </label>
                  {!editProduct && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, sku: generateUniqueSku(products) }))}
                      title="Re-generate SKU"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: 0
                      }}
                    >
                      <RefreshCw size={11} /> Regenerate
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  readOnly
                  className="admin-form-input"
                  value={formData.sku}
                  style={{
                    backgroundColor: '#f8fafc',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'default'
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px', display: 'block' }}>
                  {editProduct ? 'SKU is locked for existing record.' : 'Auto-generated unique code.'}
                </span>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  Stock Status *
                </label>
                <select
                  className="admin-form-select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="In Stock">In Stock</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>
            </div>

            {/* 6. Product Description (NO Packaging / Volume Subtitle!) */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Product Description
              </label>
              <textarea
                className="admin-form-textarea"
                rows="4"
                placeholder="Medical-grade topical formulation designed for cellular barrier integrity, replenishing essential intercellular lipids and soothing post-treatment skin."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

          </div>
        </form>
      </AdminDrawer>

      {/* ── View Product Details Drawer ── */}
      <AdminDrawer
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        title="Product Formulation Details"
        subtitle={`SKU: ${selectedProduct?.sku}`}
        width="540px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <AdminButton
              variant="secondary"
              onClick={() => {
                const prod = selectedProduct;
                setSelectedProduct(null);
                handleEditClick(prod);
              }}
              icon={<Edit2 size={14} />}
            >
              Edit Product
            </AdminButton>
            <AdminButton variant="primary" onClick={() => setSelectedProduct(null)}>
              Done
            </AdminButton>
          </div>
        }
      >
        {selectedProduct && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Image Hero Card */}
            <div
              style={{
                width: '100%',
                height: '200px',
                borderRadius: '14px',
                overflow: 'hidden',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              {selectedProduct.image_url || selectedProduct.image ? (
                <img
                  src={selectedProduct.image_url || selectedProduct.image}
                  alt={selectedProduct.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                  <Package size={48} />
                  <span style={{ fontSize: '0.82rem' }}>No Product Image</span>
                </div>
              )}
            </div>

            {/* Price & Status Highlight Card */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Stock Status
                </span>
                <div style={{ marginTop: '4px' }}>
                  <AdminBadge status={selectedProduct.status} />
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Inventory
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f2942', marginTop: '2px' }}>
                  {selectedProduct.stock} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>units</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Retail Price
                </span>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#15803d', marginTop: '2px' }}>
                  ${Number(selectedProduct.price || 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Product Details Section */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span
                  style={{
                    background: '#e0f2fe',
                    color: '#0369a1',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid #bae6fd'
                  }}
                >
                  {selectedProduct.category}
                </span>
                <span style={{ fontSize: '0.76rem', fontFamily: 'monospace', color: '#64748b' }}>
                  SKU: {selectedProduct.sku}
                </span>
              </div>

              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#0f2942', fontWeight: 700, lineHeight: 1.3 }}>
                {selectedProduct.name}
              </h3>

              {selectedProduct.subtitle && (
                <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500, marginBottom: '12px' }}>
                  {selectedProduct.subtitle}
                </div>
              )}

              <div style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.6 }}>
                {selectedProduct.description || 'No detailed clinical description provided for this formulation.'}
              </div>
            </div>

          </div>
        )}
      </AdminDrawer>

      {/* ── Category Management Modal ── */}
      <AdminModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
          setCategoryDeleteTarget(null);
        }}
        title="Manage Product Categories"
        maxWidth="540px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Add Category Form */}
          <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              className="admin-form-input"
              placeholder="New category name (e.g. Lipids & Oils)..."
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
              Add
            </AdminButton>
          </form>

          {/* Category List */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              <span>Category Name</span>
              <span>Actions</span>
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {categories.map((cat) => {
                const count = products.filter(p => p.category === cat.name).length;
                const isEditingThis = editingCategory?.id === cat.id;

                return (
                  <div
                    key={cat.id || cat.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      background: '#ffffff',
                      gap: '10px'
                    }}
                  >
                    {isEditingThis ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <input
                          type="text"
                          className="admin-form-input"
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          autoFocus
                          style={{ padding: '6px 10px', fontSize: '0.84rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCategory(cat.id, cat.name)}
                          disabled={categoryActionLoading}
                          style={{
                            background: '#16a34a',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCategory(null)}
                          style={{
                            background: '#f1f5f9',
                            color: '#64748b',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 600, color: '#0f2942', fontSize: '0.88rem' }}>
                            {cat.name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 7px',
                              borderRadius: '12px',
                              background: '#f1f5f9',
                              color: '#64748b',
                              fontWeight: 500
                            }}
                          >
                            {count} {count === 1 ? 'product' : 'products'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory(cat);
                              setEditingCategoryName(cat.name);
                            }}
                            title="Edit Category Name"
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '5px 7px',
                              color: '#475569',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePromptDeleteCategory(cat)}
                            title="Delete Category"
                            style={{
                              background: '#fee2e2',
                              border: '1px solid #fca5a5',
                              borderRadius: '6px',
                              padding: '5px 7px',
                              color: '#b91c1c',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </AdminModal>

      {/* ── Category Delete Confirmation Dialog ── */}
      <AdminConfirmDialog
        isOpen={Boolean(categoryDeleteTarget)}
        onClose={() => setCategoryDeleteTarget(null)}
        onConfirm={handleConfirmDeleteCategory}
        title="Delete Category"
        message={
          categoryDeleteTarget?.count > 0
            ? `Category "${categoryDeleteTarget?.name}" is currently used by ${categoryDeleteTarget?.count} product(s). Deleting it will reassign these products to another category. Are you sure you want to proceed?`
            : `Are you sure you want to delete category "${categoryDeleteTarget?.name}"?`
        }
        confirmText="Delete Category"
        confirmVariant="danger"
        loading={categoryActionLoading}
      />

      {/* ── Product Delete Confirmation Dialog ── */}
      <AdminConfirmDialog
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteProduct}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete Product"
        confirmVariant="danger"
        loading={actionLoading}
      />
    </div>
  );
};
