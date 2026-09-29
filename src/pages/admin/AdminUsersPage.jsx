import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ShadcnSelect } from '../../components/ui/select';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  AlertCircle,
  UserCheck,
  UserX,
  Mail,
  User,
  ShieldCheck,
  Loader2,
  MoreVertical,
  Eye,
  EyeOff,
  Camera,
  X,
  Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
// Isolated client: persistSession:false — signUp() never touches the Super Admin session
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useAdminData } from '../../context/AdminDataContext';
import { supabaseDataService } from '../../services/supabaseDataService';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';
import toast from 'react-hot-toast';

// ─── Role definitions ────────────────────────────────────────────────────────
const ROLES = [
  { value: 'super_admin', label: 'Super Admin', },
  { value: 'patient', label: 'Patient', },
];

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

// ─── Menu item button (shared style) ────────────────────────────────────────
const MenuItem = ({ onClick, icon, label, color = '#0f2942', hoverBg = '#f0f7ff', danger = false }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      width: '100%', padding: '8px 10px',
      border: 'none', background: 'transparent', borderRadius: '6px',
      fontSize: '0.82rem', fontWeight: 500,
      color: danger ? '#b91c1c' : color,
      cursor: 'pointer', transition: 'background 0.15s ease', textAlign: 'left',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = danger ? '#fef2f2' : hoverBg; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
  >
    {icon}
    <span>{label}</span>
  </button>
);

// ─── Password input w/ show/hide (module scope to preserve focus on every keystroke) ──
const PasswordInput = ({ id, label, value, onChange, show, onToggle, placeholder = '••••••••', required = true }) => (
  <div className="admin-form-group">
    <label className="admin-form-label">
      <Lock size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
      {label}{required ? ' *' : ''}
    </label>
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className="admin-form-input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete="new-password"
        style={{ paddingRight: '40px' }}
      />
      <button
        type="button"
        onClick={onToggle}
        style={{
          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
          display: 'flex', alignItems: 'center', padding: '4px',
        }}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  </div>
);

// ─── View User panel (module scope) ──────────────────────────────────────────
const ViewUserPanel = ({ user: u }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    {/* Avatar */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      {u.profile_photo_url || u.avatar ? (
        <img src={u.profile_photo_url || u.avatar} alt={u.name}
          style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #cbd5e1' }} />
      ) : (
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #1e5aa8, #16a34a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: '1.6rem',
        }}>
          {(u.name || u.email || '?')[0].toUpperCase()}
        </div>
      )}
      <div>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f2942' }}>{u.name || '—'}</div>
        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>{u.email}</div>
        <AdminBadge status={u.role === 'super_admin' ? 'Super Admin' : u.role} />
      </div>
    </div>

    {/* Fields */}
    {[
      { label: 'Status', value: u.status === 'active' ? 'Active' : 'Inactive' },
      { label: 'Created', value: u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
      { label: 'Last Updated', value: u.updated_at ? new Date(u.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
    ].map(({ label, value }) => (
      <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontSize: '0.9rem', color: '#0f2942', fontWeight: 500 }}>{value}</span>
      </div>
    ))}
  </div>
);

export const AdminUsersPage = () => {
  const { user: currentUser } = useAdminAuth();
  const { users: contextUsers = [] } = useAdminData();

  // ── Data (Hydrated from cache/context for 0ms initial render) ─────────────
  const [users, setUsers] = useState(() => {
    if (Array.isArray(contextUsers) && contextUsers.length > 0) {
      return contextUsers.filter(u => (u.role || '').toLowerCase() !== 'patient');
    }
    try {
      const cached = localStorage.getItem('cached_dynamic_users');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // ── Drawer / dialog state ─────────────────────────────────────────────────
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [statusConfirm, setStatusConfirm] = useState(null);

  // ── Three-dot action menu (viewport-positioned, same as ClientsPage) ──────
  const [actionMenuUserId, setActionMenuUserId] = useState(null);
  const [actionMenuPosition, setActionMenuPosition] = useState(null);

  useEffect(() => {
    const closeMenu = (e) => {
      if (!e.target.closest('.user-action-menu-container') && !e.target.closest('.user-action-dropdown-menu')) {
        setActionMenuUserId(null);
        setActionMenuPosition(null);
      }
    };
    const onWindowChange = () => {
      if (actionMenuUserId) { setActionMenuUserId(null); setActionMenuPosition(null); }
    };
    if (actionMenuUserId) {
      document.addEventListener('mousedown', closeMenu);
      document.addEventListener('touchstart', closeMenu);
      window.addEventListener('scroll', onWindowChange, true);
      window.addEventListener('resize', onWindowChange);
    }
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('touchstart', closeMenu);
      window.removeEventListener('scroll', onWindowChange, true);
      window.removeEventListener('resize', onWindowChange);
    };
  }, [actionMenuUserId]);

  // ── Profile photo state ───────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const fileInputRef = useRef(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: '', email: '', role: 'super_admin', status: 'active',
    password: '', confirmPassword: '',
    phone: '', dob: '', address: '',
  });
  const [formError, setFormError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isPatientRole = formData.role === 'patient';

  // ── Photo handlers (mirrors ClientsPage exactly) ──────────────────────────
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = ''; // Reset value so re-selecting same file triggers onChange
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      const msg = 'Invalid file type. Please upload a JPG, JPEG, PNG, or WEBP image.';
      setPhotoError(msg); toast.error(msg);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      const msg = 'Image size exceeds 10MB limit.';
      setPhotoError(msg); toast.error(msg);
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
    setSelectedFile(null); setPreviewPhotoUrl(null); setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast('Profile photo removed.', { icon: '🗑️' });
  };

  // ── Upload helper (mirrors ClientsPage) ───────────────────────────────────
  const uploadProfilePhoto = async (file) => {
    if (!file) return null;
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const filePath = `user-avatars/${fileName}`;
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const names = Array.isArray(buckets) ? buckets.map(b => b.name || b.id) : [];
      const bucket = names.includes('avatars') ? 'avatars' : names[0] || null;
      if (bucket) {
        const { data: upData, error: upErr } = await supabase.storage
          .from(bucket).upload(filePath, file, { cacheControl: '3600', upsert: true });
        if (!upErr && upData) {
          const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
          if (pub?.publicUrl) return pub.publicUrl;
        }
      }
    } catch { /* fall through to base64 */ }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  // ── Reset form ─────────────────────────────────────────────────────────────
  const resetForm = (role = 'super_admin') => {
    setFormData({ name: '', email: '', role, status: role === 'patient' ? 'Active' : 'active', password: '', confirmPassword: '', phone: '', dob: '', address: '' });
    setFormError('');
    setEmailError('');
    setSelectedFile(null); setPreviewPhotoUrl(null); setPhotoError(null);
    setShowPassword(false); setShowConfirm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Fetch — all super_admin / admin rows dynamically from users table ─────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    let rawData = [];
    let isQueryError = false;

    try {
      // 1. Fetch all records from public.users table (try sorted by created_at first)
      let { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      // Fallback: If order by created_at fails (e.g. column missing or RLS issue), try plain select
      if (error) {
        console.warn('Initial users fetch with order failed, trying fallback select:', error);
        const fallbackRes = await supabase.from('users').select('*');
        if (!fallbackRes.error && fallbackRes.data) {
          data = fallbackRes.data;
          error = null;
        }
      }

      // Fallback: try supabaseAdmin client (unauthenticated / anon to bypass RLS recursion)
      if (error || !data) {
        try {
          const adminRes = await supabaseAdmin.from('users').select('*');
          if (!adminRes.error && adminRes.data) {
            data = adminRes.data;
            error = null;
          }
        } catch (_) {}
      }

      if (error) {
        console.error('Fetch users error from Supabase:', error);
        isQueryError = true;
      } else {
        rawData = data || [];
      }
    } catch (err) {
      console.error('Fetch users catch error:', err);
      isQueryError = true;
    }

    try {
      // 2. Ensure public.users table contains ONLY super_admin accounts (clean any patient records found)
      const patientRows = (rawData || []).filter(u => {
        const r = (u.role || '').toLowerCase().trim();
        return r === 'patient' || (r !== 'super_admin' && !r.includes('admin'));
      });
      if (patientRows.length > 0) {
        const patientIds = patientRows.map(u => u.id).filter(Boolean);
        const patientEmails = patientRows.map(u => (u.email || '').toLowerCase().trim()).filter(Boolean);
        try {
          if (patientIds.length > 0) {
            await supabase.from('users').delete().in('id', patientIds);
          }
          if (patientEmails.length > 0) {
            await supabase.from('users').delete().in('email', patientEmails);
          }
        } catch (cleanErr) {
          console.warn('Patient cleanup notice from users table:', cleanErr);
        }
      }

      // 3. Filter to ONLY Super Admin accounts (strictly exclude any patient or non-admin accounts)
      const adminRows = (rawData || []).filter(u => {
        const r = (u.role || '').toLowerCase().trim();
        return r === 'super_admin' || r === 'superadmin' || r === 'admin' || r === 'super admin' || (!r && (u.email || '').includes('admin'));
      });

      // 4. Map records with local cached photos and normalized fields
      const mapped = adminRows.map(u => {
        const emailLower = (u.email || '').toLowerCase().trim();
        const cachedPhoto =
          (emailLower ? localStorage.getItem(`user_photo_${emailLower}`) : null) ||
          (u.id ? localStorage.getItem(`user_photo_${u.id}`) : null) ||
          null;
        const normStatus = (u.status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active';
        return {
          ...u,
          role: 'super_admin',
          status: normStatus,
          profile_photo_url: u.profile_photo_url || u.avatar || cachedPhoto || null,
          avatar: u.avatar || u.profile_photo_url || cachedPhoto || null,
        };
      });

      // 5. Ensure the currently logged-in Super Admin is ALWAYS present
      if (currentUser?.email) {
        const currentEmailLower = currentUser.email.toLowerCase().trim();
        const exists = mapped.some(u => (u.email || '').toLowerCase().trim() === currentEmailLower);
        if (!exists) {
          const cachedPhoto =
            localStorage.getItem(`user_photo_${currentEmailLower}`) ||
            (currentUser.id ? localStorage.getItem(`user_photo_${currentUser.id}`) : null) ||
            currentUser.profile_photo_url ||
            currentUser.avatar ||
            null;
          mapped.unshift({
            id: currentUser.id || 'current-admin',
            name: currentUser.name || currentUser.email.split('@')[0],
            email: currentUser.email,
            role: 'super_admin',
            status: 'active',
            profile_photo_url: currentUser.profile_photo_url || currentUser.avatar || cachedPhoto || null,
            avatar: currentUser.avatar || currentUser.profile_photo_url || cachedPhoto || null,
            created_at: currentUser.created_at || new Date().toISOString(),
            updated_at: currentUser.updated_at || new Date().toISOString(),
          });
        }
      }

      // If query failed and no accounts could be mapped or resolved, show error banner
      if (isQueryError && mapped.length === 0) {
        setFetchError('Failed to load users. Please check your Supabase connection and try again.');
      } else {
        setFetchError(null);
      }

      setUsers(mapped);
    } catch (processErr) {
      console.error('Process users error:', processErr);
      if (currentUser?.email) {
        setUsers([{
          id: currentUser.id || 'current-admin',
          name: currentUser.name || currentUser.email.split('@')[0],
          email: currentUser.email,
          role: 'super_admin',
          status: 'active',
          profile_photo_url: currentUser.profile_photo_url || currentUser.avatar || null,
          avatar: currentUser.avatar || currentUser.profile_photo_url || null,
          created_at: currentUser.created_at || new Date().toISOString(),
          updated_at: currentUser.updated_at || new Date().toISOString(),
        }]);
        setFetchError(null);
      } else {
        setFetchError('Failed to load users. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return users.filter((u) => {
      const matchSearch = !searchTerm ||
        (u.name || '').toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term);
      const matchStatus = statusFilter === 'ALL' || (u.status || '').toLowerCase() === statusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [users, searchTerm, statusFilter]);

  // ── Open add drawer ────────────────────────────────────────────────────────
  const handleOpenAdd = () => {
    resetForm('super_admin');
    setEditUser(null);
    setIsDrawerOpen(true);
  };

  // ── Open edit drawer ───────────────────────────────────────────────────────
  const handleEditClick = (usr) => {
    resetForm(usr.role || 'super_admin');
    setFormData(prev => ({
      ...prev,
      name: usr.name || '',
      email: usr.email || '',
      role: usr.role || 'super_admin',
      status: usr.status || 'active',
    }));
    const emailLower = (usr.email || '').toLowerCase();
    const photo =
      usr.profile_photo_url ||
      usr.avatar ||
      localStorage.getItem(`user_photo_${emailLower}`) ||
      localStorage.getItem(`user_photo_${usr.id}`) ||
      null;
    setPreviewPhotoUrl(photo);
    setEditUser(usr);
    setIsDrawerOpen(true);
  };

  // ── Validate ───────────────────────────────────────────────────────────────
  const validateForm = () => {
    if (!formData.name.trim()) return { field: 'name', message: 'Full name is required.' };
    if (!formData.email.trim()) return { field: 'email', message: 'Email address is required.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      return { field: 'email', message: 'Please enter a valid email address.' };
    }

    if (isPatientRole && !editUser) {
      if (!formData.password) return { field: 'password', message: 'Password is required.' };
      if (formData.password.length < 8) return { field: 'password', message: 'Password must be at least 8 characters.' };
      if (formData.password !== formData.confirmPassword) return { field: 'confirmPassword', message: 'Passwords do not match.' };
    }
    if (!isPatientRole && !editUser) {
      if (!formData.password) return { field: 'password', message: 'Password is required for Super Admin.' };
      if (formData.password.length < 8) return { field: 'password', message: 'Password must be at least 8 characters.' };
    }
    return null;
  };

  // ── Database duplicate email check (cross-table & auth, regardless of role) ─
  const checkEmailExistsInDatabase = useCallback(async (rawEmail) => {
    const cleanEmail = (rawEmail || '').trim().toLowerCase();
    if (!cleanEmail) return { exists: false };

    // 1. Try database-level RPC function if available (checks users, patients, and auth)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('check_email_exists', {
        lookup_email: cleanEmail,
      });
      if (!rpcError && rpcData && typeof rpcData.exists === 'boolean') {
        return rpcData;
      }
    } catch {
      // Fallback silently to table queries
    }

    // 2. Direct database queries fallback: check both public.users and public.patients in parallel
    try {
      const [userRes, patientRes] = await Promise.all([
        supabase.from('users').select('id, email, role').ilike('email', cleanEmail).maybeSingle(),
        supabase.from('patients').select('id, email, role').ilike('email', cleanEmail).maybeSingle(),
      ]);

      if (userRes.data?.id) {
        return {
          exists: true,
          source: 'users',
          role: userRes.data.role || 'super_admin',
          message: 'This email address is already registered.',
        };
      }

      if (patientRes.data?.id) {
        return {
          exists: true,
          source: 'patients',
          role: 'patient',
          message: 'This email address is already registered.',
        };
      }
    } catch (queryErr) {
      console.warn('Error querying database for duplicate email:', queryErr);
    }

    return { exists: false };
  }, []);

  // ── Inline duplicate email check on blur ──────────────────────────────────
  const handleEmailBlur = async () => {
    if (editUser) return;
    const cleanEmail = formData.email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return;

    try {
      const check = await checkEmailExistsInDatabase(cleanEmail);
      if (check.exists) {
        const errorMsg = 'This email address is already registered.';
        setEmailError(errorMsg);
        setFormError(errorMsg);
      }
    } catch (err) {
      console.debug('Email check on blur skipped:', err);
    }
  };

  // ── Helper: extract missing column from PostgREST error ───────────────────
  const extractMissingColumn = (msg = '') => {
    const patterns = [
      /Could not find the '([^']+)' column/i,
      /column "([^"]+)" of relation/i,
      /column "([^"]+)" does not exist/i,
    ];
    for (const re of patterns) {
      const m = msg.match(re);
      if (m?.[1]) return m[1];
    }
    return null;
  };

  // ── Save patient → patients table only ────────────────────────────────────
  const handleSavePatient = async (photoUrl) => {
    const now = new Date().toISOString();
    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();

    if (editUser) {
      let payload = {
        full_name: name,
        email,
        phone: formData.phone?.trim() || null,
        date_of_birth: formData.dob?.trim() || null,
        residential_address: formData.address?.trim() || null,
        role: 'Patient',
        updated_at: now,
        ...(photoUrl !== undefined ? { profile_photo_url: photoUrl, avatar: photoUrl } : {}),
      };
      let err = null;
      for (let i = 0; i < 8; i++) {
        const res = await supabase.from('patients').update(payload).eq('email', email);
        if (!res.error) { err = null; break; }
        err = res.error;
        const col = extractMissingColumn(res.error.message);
        if (col && col in payload) { delete payload[col]; continue; }
        break;
      }
      if (err) throw err;

      // CRITICAL: Ensure patient record is NEVER retained in public.users table!
      try {
        await supabase.from('users').delete().eq('email', email);
        if (editUser?.id) {
          await supabase.from('users').delete().eq('id', editUser.id);
        }
      } catch (cleanErr) {
        console.warn('Patient cleanup notice from users on edit:', cleanErr);
      }

      toast.success('Patient record updated.');
      setEditUser(null);
    } else {
      // 1. Duplicate check in database across both users and patients regardless of role
      const emailCheck = await checkEmailExistsInDatabase(email);
      if (emailCheck.exists) {
        const errorMsg = 'This email address is already registered.';
        setEmailError(errorMsg);
        setFormError(errorMsg);
        setActionLoading(false);
        return;
      }

      // 2. Create Supabase Auth account for patient using the isolated client.
      //    supabaseAdmin has persistSession:false so this signUp() NEVER replaces
      //    the Super Admin's active session in localStorage/sessionStorage.
      const { data: signUpData, error: signUpErr } = await supabaseAdmin.auth.signUp({
        email, password: formData.password,
        options: { data: { name, role: 'patient' } },
      });
      // Always clear any in-memory state on the isolated client after creation
      try { await supabaseAdmin.auth.signOut(); } catch (_) {}

      if (signUpErr) {
        if (
          signUpErr.message?.toLowerCase().includes('already registered') ||
          signUpErr.message?.toLowerCase().includes('already exists') ||
          signUpErr.status === 422
        ) {
          const errorMsg = 'This email address is already registered.';
          setEmailError(errorMsg);
          setFormError(errorMsg);
          setActionLoading(false);
          return;
        }
        throw signUpErr;
      }

      // Anti-enumeration: empty identities array means account already exists
      if (signUpData?.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
        const errorMsg = 'This email address is already registered.';
        setEmailError(errorMsg);
        setFormError(errorMsg);
        setActionLoading(false);
        return;
      }

      let payload = {
        full_name: name,
        name: name,
        email,
        phone: formData.phone?.trim() || null,
        date_of_birth: formData.dob?.trim() || null,
        dob: formData.dob?.trim() || null,
        residential_address: formData.address?.trim() || null,
        address: formData.address?.trim() || null,
        status: formData.status || 'Active',
        role: 'Patient',
        total_appointments: 0,
        total_spent: 0,
        profile_photo_url: photoUrl || null,
        avatar: photoUrl || null,
        profilePhotoUrl: photoUrl || null,
        created_at: now,
        updated_at: now,
      };
      let insertErr = null;
      for (let i = 0; i < 10; i++) {
        const res = await supabase.from('patients').insert(payload).select();
        if (res.error?.code === '42501' || res.error?.message?.toLowerCase().includes('permission denied')) {
          const retry = await supabase.from('patients').insert(payload);
          if (!retry.error) { insertErr = null; break; }
        }
        if (!res.error) { insertErr = null; break; }
        insertErr = res.error;
        const col = extractMissingColumn(res.error.message);
        if (col && col in payload) { delete payload[col]; continue; }
        break;
      }
      if (insertErr) throw insertErr;

      // CRITICAL: Ensure patient record is NEVER inserted or retained in public.users table!
      try {
        await supabase.from('users').delete().eq('email', email);
      } catch (cleanErr) {
        console.warn('Patient cleanup from users notice:', cleanErr);
      }

      // Sync Patient Registry cache immediately so Patient module updates in real time
      try {
        const rawCached = localStorage.getItem('cached_dynamic_patients');
        const parsedCached = rawCached ? JSON.parse(rawCached) : [];
        const updatedList = [{ ...payload, id: `patient-${Date.now()}` }, ...parsedCached.filter(p => (p.email || '').toLowerCase() !== email)];
        localStorage.setItem('cached_dynamic_patients', JSON.stringify(updatedList));
      } catch (_) {}

      try {
        if (supabaseDataService?.fetchAll) {
          supabaseDataService.fetchAll('clients', { forceFresh: true });
          supabaseDataService.fetchAll('patients', { forceFresh: true });
        }
      } catch (_) {}

      const needsConfirm = !signUpData?.user?.confirmed_at;
      toast.success(
        needsConfirm
          ? `Patient "${name}" registered. Saved in the Patient Registry.`
          : `Patient "${name}" added to the Patient Registry.`,
        { duration: 5000 }
      );
    }
  };

  // ── Save super admin → users table only ───────────────────────────────────
  const handleSaveSuperAdmin = async (photoUrl) => {
    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();

    if (editUser) {
      const payload = {
        name,
        role: 'super_admin',
        status: formData.status,
        updated_at: new Date().toISOString(),
      };
      if (photoUrl !== undefined) {
        if (photoUrl) {
          payload.profile_photo_url = photoUrl;
          payload.avatar = photoUrl;
        } else {
          payload.profile_photo_url = null;
          payload.avatar = null;
        }
      }

      // Schema-resilient update: automatically strip columns if missing in public.users table
      let updateErr = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const res = await supabase.from('users').update(payload).eq('id', editUser.id);
        if (!res.error) {
          updateErr = null;
          break;
        }
        updateErr = res.error;
        const col = extractMissingColumn(res.error.message);
        if (col && col in payload) {
          delete payload[col];
          continue;
        }
        break;
      }
      if (updateErr) throw updateErr;

      // Also sync user_metadata in Supabase Auth if applicable
      try {
        await supabase.auth.updateUser({
          data: {
            name,
            ...(photoUrl !== undefined ? { profile_photo_url: photoUrl, avatar: photoUrl } : {}),
          },
        });
      } catch (authErr) {
        console.warn('Auth user metadata update notice:', authErr);
      }

      // Cache photo in localStorage for guaranteed display
      if (photoUrl) {
        try { localStorage.setItem(`user_photo_${email}`, photoUrl); } catch (_) { }
        try { localStorage.setItem(`user_photo_${editUser.id}`, photoUrl); } catch (_) { }
      } else if (photoUrl === null) {
        try { localStorage.removeItem(`user_photo_${email}`); } catch (_) { }
        try { localStorage.removeItem(`user_photo_${editUser.id}`); } catch (_) { }
      }

      // Ensure Super Admin is NEVER duplicated in patients table
      try {
        await supabase.from('patients').delete().eq('email', email);
      } catch (_) { }

      toast.success('Super Admin account updated.');
      setEditUser(null);
    } else {
      // 1. Duplicate check in database across both users and patients regardless of role
      const emailCheck = await checkEmailExistsInDatabase(email);
      if (emailCheck.exists) {
        const errorMsg = 'This email address is already registered.';
        setEmailError(errorMsg);
        setFormError(errorMsg);
        setActionLoading(false);
        return;
      }

      let authUserId = null;
      let needsConfirmation = false;

      // Try admin.createUser first (needs service role key)
      const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
        email, password: formData.password, email_confirm: true,
        user_metadata: {
          name,
          role: 'super_admin',
          ...(photoUrl ? { profile_photo_url: photoUrl, avatar: photoUrl } : {}),
        },
      });

      if (!adminError && adminData?.user?.id) {
        authUserId = adminData.user.id;
      } else {
        if (
          adminError?.message?.toLowerCase().includes('already registered') ||
          adminError?.message?.toLowerCase().includes('already exists')
        ) {
          const errorMsg = 'This email address is already registered.';
          setEmailError(errorMsg);
          setFormError(errorMsg);
          setActionLoading(false);
          return;
        }

        // Fallback: signUp using the isolated client (persistSession:false).
        //   This ensures the newly-created Super Admin account does NOT
        //   become the active session — the current Super Admin stays logged in.
        const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
          email, password: formData.password,
          options: {
            data: {
              name,
              role: 'super_admin',
              ...(photoUrl ? { profile_photo_url: photoUrl, avatar: photoUrl } : {}),
            },
          },
        });
        // Always clear in-memory state on the isolated client after creation
        try { await supabaseAdmin.auth.signOut(); } catch (_) {}

        if (signUpError) {
          if (
            signUpError.message?.toLowerCase().includes('already registered') ||
            signUpError.message?.toLowerCase().includes('already exists') ||
            signUpError.status === 422
          ) {
            const errorMsg = 'This email address is already registered.';
            setEmailError(errorMsg);
            setFormError(errorMsg);
            setActionLoading(false);
            return;
          }
          throw signUpError;
        }

        // Anti-enumeration: empty identities array means account already exists
        if (signUpData?.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
          const errorMsg = 'This email address is already registered.';
          setEmailError(errorMsg);
          setFormError(errorMsg);
          setActionLoading(false);
          return;
        }

        authUserId = signUpData?.user?.id;
        needsConfirmation = !signUpData?.user?.confirmed_at;
      }

      if (!authUserId) throw new Error('Failed to create auth user — no ID returned.');

      const userProfilePayload = {
        id: authUserId,
        name,
        email,
        role: 'super_admin',
        status: 'active',
        ...(photoUrl ? { profile_photo_url: photoUrl, avatar: photoUrl } : {}),
      };

      let profileError = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const res = await supabase.from('users').upsert(userProfilePayload, { onConflict: 'id' });
        if (!res.error) {
          profileError = null;
          break;
        }
        profileError = res.error;
        const col = extractMissingColumn(res.error.message);
        if (col && col in userProfilePayload) {
          delete userProfilePayload[col];
          continue;
        }
        break;
      }
      if (profileError) throw profileError;

      // Ensure Super Admin is NEVER duplicated in patients table
      try {
        await supabase.from('patients').delete().eq('email', email);
      } catch (_) { }

      // Cache photo in localStorage
      if (photoUrl) {
        try { localStorage.setItem(`user_photo_${email}`, photoUrl); } catch (_) { }
        try { localStorage.setItem(`user_photo_${authUserId}`, photoUrl); } catch (_) { }
      }

      toast.success(
        needsConfirmation
          ? `Super Admin created. Confirmation email sent to ${email}.`
          : 'Super Admin account created and confirmed.',
        { duration: 6000 }
      );
    }
  };

  // ── Main save handler ─────────────────────────────────────────────────────
  const handleSave = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setFormError('');
    setEmailError('');
    const validErr = validateForm();
    if (validErr) {
      setFormError(validErr.message);
      if (validErr.field === 'email') {
        setEmailError(validErr.message);
      }
      return;
    }

    setActionLoading(true);
    try {
      // Pre-validation duplicate email check across entire database regardless of role
      if (!editUser) {
        const cleanEmail = formData.email.trim().toLowerCase();
        const emailCheck = await checkEmailExistsInDatabase(cleanEmail);
        if (emailCheck.exists) {
          const duplicateMsg = 'This email address is already registered.';
          setEmailError(duplicateMsg);
          setFormError(duplicateMsg);
          setActionLoading(false);
          return;
        }
      }

      // Upload photo first
      let photoUrl;
      if (selectedFile) {
        try { photoUrl = await uploadProfilePhoto(selectedFile); } catch { photoUrl = null; }
      } else if (previewPhotoUrl) {
        photoUrl = previewPhotoUrl;
      }

      if (isPatientRole) {
        await handleSavePatient(photoUrl);
      } else {
        await handleSaveSuperAdmin(photoUrl);
      }
      await fetchUsers();
      resetForm('super_admin');
      setEditUser(null);
      setIsDrawerOpen(false);
    } catch (err) {
      console.error('Save user error:', err);
      const msg = err?.message || 'Failed to save. Please try again.';
      const lower = msg.toLowerCase();
      if (
        lower.includes('duplicate') ||
        lower.includes('already exists') ||
        lower.includes('already registered') ||
        lower.includes('unique') ||
        lower.includes('email address is already') ||
        err?.code === '23505'
      ) {
        const duplicateMsg = 'This email address is already registered.';
        setEmailError(duplicateMsg);
        setFormError(duplicateMsg);
      } else {
        setFormError(msg);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('users').delete().eq('id', deleteConfirmId);
      if (error) throw error;
      toast.success('User deleted.');
      setDeleteConfirmId(null);
      await fetchUsers();
    } catch (err) {
      toast.error(err?.message || 'Failed to delete user.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Toggle Status ──────────────────────────────────────────────────────────
  const handleToggleStatus = async () => {
    if (!statusConfirm) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: statusConfirm.newStatus, updated_at: new Date().toISOString() })
        .eq('id', statusConfirm.user.id);
      if (error) throw error;
      toast.success(`User ${statusConfirm.newStatus === 'active' ? 'activated' : 'deactivated'}.`);
      setStatusConfirm(null);
      await fetchUsers();
    } catch (err) {
      toast.error(err?.message || 'Failed to update status.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      header: 'User Name',
      accessor: 'name',
      sortable: true,
      render: (row) => {
        const photo = row.profile_photo_url || row.avatar;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {photo ? (
              <img src={photo} alt={row.name}
                loading="lazy"
                decoding="async"
                style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #cbd5e1', flexShrink: 0 }}
                onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex'); }}
              />
            ) : null}
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #1e5aa8, #16a34a)',
              display: photo ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
            }}>
              {(row.name || row.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#0f2942' }}>{row.name || '—'}</div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{row.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Role',
      accessor: 'role',
      sortable: true,
      render: (row) => {
        const rawRole = (row.role || 'Super Admin').toLowerCase().trim();
        const roleLabel = rawRole.includes('patient') ? 'Patient' : 'Super Admin';
        return <AdminBadge status={roleLabel} />;
      },
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (row) => {
        const active = row.status === 'active';
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 10px', borderRadius: '20px', fontSize: '0.76rem', fontWeight: 600,
            background: active ? '#dcfce7' : '#f1f5f9', color: active ? '#15803d' : '#64748b',
          }}>
            {active ? <UserCheck size={12} /> : <UserX size={12} />}
            {active ? 'Active' : 'Inactive'}
          </span>
        );
      },
    },
    {
      header: 'Created Date',
      accessor: 'created_at',
      sortable: true,
      render: (row) => (
        <span style={{ fontSize: '0.83rem', color: '#475569' }}>
          {row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      width: '70px',
      render: (row) => {
        const isSelf = currentUser?.id === row.id;
        const isActive = row.status === 'active';
        const isOpen = actionMenuUserId === row.id;
        return (
          <div className="user-action-menu-container" style={{ position: 'relative', display: 'inline-block' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (actionMenuUserId === row.id) {
                  setActionMenuUserId(null); setActionMenuPosition(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dropdownH = 190;
                  const openUp = window.innerHeight - rect.bottom < dropdownH && rect.top > dropdownH;
                  setActionMenuPosition({
                    top: openUp ? rect.top - dropdownH - 6 : rect.bottom + 6,
                    right: Math.max(16, window.innerWidth - rect.right),
                  });
                  setActionMenuUserId(row.id);
                }
              }}
              title="Actions"
              aria-label="Actions menu"
              style={{
                background: isOpen ? '#e2e8f0' : '#f8fafc',
                border: `1px solid ${isOpen ? '#94a3b8' : '#cbd5e1'}`,
                borderRadius: '6px', padding: '6px 8px', cursor: 'pointer',
                color: '#334155', display: 'inline-flex', alignItems: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <MoreVertical size={16} />
            </button>

            {isOpen && actionMenuPosition && (
              <div
                className="user-action-dropdown-menu"
                style={{
                  position: 'fixed',
                  top: `${actionMenuPosition.top}px`,
                  right: `${actionMenuPosition.right}px`,
                  width: '168px',
                  background: '#ffffff', border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px -5px rgba(15,41,66,0.14), 0 8px 10px -6px rgba(15,41,66,0.08)',
                  zIndex: 99999, padding: '6px',
                  display: 'flex', flexDirection: 'column', gap: '2px',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* View */}
                <MenuItem
                  icon={<Eye size={15} color="#1e5aa8" />}
                  label="View User"
                  onClick={() => { setActionMenuUserId(null); setActionMenuPosition(null); setViewUser(row); }}
                />

                {/* Edit */}
                <MenuItem
                  icon={<Edit2 size={15} color="#475569" />}
                  label="Edit User"
                  onClick={() => { setActionMenuUserId(null); setActionMenuPosition(null); handleEditClick(row); }}
                />

                {/* Change Status */}
                {!isSelf && (
                  <MenuItem
                    icon={isActive ? <UserX size={15} color="#b45309" /> : <UserCheck size={15} color="#15803d" />}
                    label={isActive ? 'Deactivate' : 'Activate'}
                    color={isActive ? '#b45309' : '#15803d'}
                    hoverBg={isActive ? '#fffbeb' : '#f0fdf4'}
                    onClick={() => {
                      setActionMenuUserId(null); setActionMenuPosition(null);
                      setStatusConfirm({ user: row, newStatus: isActive ? 'inactive' : 'active' });
                    }}
                  />
                )}

                {/* Divider */}
                {!isSelf && <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />}

                {/* Delete */}
                {!isSelf && (
                  <MenuItem
                    icon={<Trash2 size={15} color="#dc2626" />}
                    label="Delete User"
                    danger
                    onClick={() => { setActionMenuUserId(null); setActionMenuPosition(null); setDeleteConfirmId(row.id); }}
                  />
                )}
              </div>
            )}
          </div>
        );
      },
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page Header */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>User Management</h1>
          <p>Manage Super Admin accounts and Patient registrations. Patients are stored in the Patient Registry.</p>
        </div>
        <div className="admin-page-actions">
          <AdminButton variant="primary" onClick={handleOpenAdd} icon={<Plus size={16} />}>
            Add User
          </AdminButton>
        </div>
      </div>

      {/* Fetch Error */}
      {fetchError && (
        <div style={{
          background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c',
          padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <AlertCircle size={16} />
          <span>{fetchError}</span>
          <button onClick={fetchUsers} style={{
            marginLeft: 'auto', background: '#b91c1c', color: '#fff',
            border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer',
          }}>Retry</button>
        </div>
      )}

      {/* Toolbar */}
      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by name or email…"
        hasActiveFilters={Boolean(searchTerm) || statusFilter !== 'ALL'}
        onClearFilters={() => { setSearchTerm(''); setStatusFilter('ALL'); }}
        filters={[{
          id: 'status', value: statusFilter, onChange: setStatusFilter,
          options: [
            { label: 'All Statuses', value: 'ALL' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ],
        }]}
      />

      {/* Table */}
      <AdminTable
        columns={columns}
        data={filteredUsers}
        loading={loading}
        itemsPerPage={10}
        emptyTitle="No Super Admin accounts found"
        emptyDescription={
          searchTerm || statusFilter !== 'ALL'
            ? 'Try adjusting your filters.'
            : 'Click "Add User" to create your first account.'
        }
      />

      {/* ── Add / Edit Drawer ────────────────────────────────────────────── */}
      <AdminDrawer
        isOpen={isDrawerOpen}
        onClose={() => { setIsDrawerOpen(false); setEditUser(null); resetForm('super_admin'); }}
        title={editUser ? 'Edit User' : 'Add New User'}
        subtitle={
          editUser
            ? `Editing record for ${editUser.email}`
            : isPatientRole
              ? 'Patient records are saved to the Patient Registry.'
              : 'Create a new Super Admin account.'
        }
        width="560px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
            <AdminButton variant="secondary" disabled={actionLoading}
              onClick={() => { setIsDrawerOpen(false); setEditUser(null); resetForm('super_admin'); }}>
              Cancel
            </AdminButton>
            <AdminButton
              type="submit"
              form="user-form"
              variant="primary"
              disabled={actionLoading}
              icon={actionLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              onClick={handleSave}
            >
              {actionLoading ? 'Saving…' : editUser ? 'Save Changes' : isPatientRole ? 'Add to Registry' : 'Create Admin'}
            </AdminButton>
          </div>
        }
      >
        {/* Form error */}
        {formError && (
          <div style={{
            marginBottom: '16px', padding: '12px 14px', borderRadius: '8px',
            background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
            fontSize: '0.84rem', display: 'flex', alignItems: 'flex-start', gap: '8px',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1, lineHeight: 1.4 }}>{formError}</div>
          </div>
        )}

        <form id="user-form" onSubmit={handleSave} autoComplete="off" noValidate>
          {/* Anti-autofill honeypot inputs */}
          <input type="text" name="prevent_af_1" style={{ display: 'none' }} tabIndex={-1} readOnly aria-hidden="true" />
          <input type="password" name="prevent_af_2" style={{ display: 'none' }} tabIndex={-1} readOnly aria-hidden="true" autoComplete="new-password" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Profile Photo */}
            <div className="admin-form-group">
              <label className="admin-form-label" style={{ display: 'block', marginBottom: '8px' }}>Profile Photo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '68px', height: '68px', borderRadius: '50%', overflow: 'hidden',
                  border: '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: previewPhotoUrl ? '#f8fafc' : 'linear-gradient(135deg, #1e5aa8 0%, #16a34a 100%)',
                  color: '#ffffff', fontSize: '1.5rem', fontWeight: 700, flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(15,41,66,0.08)',
                }}>
                  {previewPhotoUrl
                    ? <img key={previewPhotoUrl} src={previewPhotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <span>{(formData.name || 'U').charAt(0).toUpperCase()}</span>
                  }
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/jpg" style={{ display: 'none' }} onChange={handlePhotoSelect} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button type="button" onClick={() => fileInputRef.current?.click()} style={{
                      background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px',
                      padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600, color: '#1e5aa8',
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                    }}>
                      <Camera size={14} />
                      {previewPhotoUrl ? 'Replace Photo' : 'Upload Photo'}
                    </button>
                    {previewPhotoUrl && (
                      <button type="button" onClick={handleRemovePhoto} style={{
                        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px',
                        padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600, color: '#b91c1c',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                      }}>
                        <X size={14} /> Remove
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Accepts JPG, PNG, WEBP (max 10MB)</span>
                  {photoError && (
                    <div style={{ fontSize: '0.78rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={13} /><span>{photoError}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Role selector */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                <Shield size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Role *
              </label>
              <ShadcnSelect
                value={formData.role}
                disabled={Boolean(editUser)}
                onChange={(val) => setFormData(prev => ({ ...prev, role: val, password: '', confirmPassword: '', status: val === 'patient' ? 'Active' : 'active' }))}
                options={ROLES.map((r) => ({ value: r.value, label: `${r.label}` }))}
                placeholder="Select a role…"
                triggerStyle={editUser ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
              />
              {editUser && <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>Role cannot be changed after creation.</p>}
            </div>

            {/* Patient info banner */}
            {isPatientRole && !editUser && (
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af',
                padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem',
                display: 'flex', alignItems: 'flex-start', gap: '8px', lineHeight: 1.5,
              }}>
                <AlertCircle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                <span>Patient records are saved to the <strong>Patient Registry</strong> (patients table). A login account will be created so the patient can sign in to their portal.</span>
              </div>
            )}

            {/* Full Name */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                <User size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Full Name *
              </label>
              <input type="text" required className="admin-form-input"
                placeholder={isPatientRole ? 'Jane Smith' : 'Dr. Jane Smith'}
                value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                readOnly onFocus={(e) => { e.target.readOnly = false; }} autoComplete="one-time-code" data-lpignore="true"
              />
            </div>

            {/* Email */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                <Mail size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Email Address *
              </label>
              <input
                type="text"
                inputMode="email"
                required
                className="admin-form-input"
                placeholder="user@beautyoasisrx.com"
                value={formData.email}
                disabled={Boolean(editUser)}
                style={{
                  ...(editUser ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  ...(emailError ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}),
                }}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (emailError) setEmailError('');
                  if (
                    formError === 'This email address is already registered.' ||
                    formError === 'Email address is required.' ||
                    formError === 'Please enter a valid email address.'
                  ) {
                    setFormError('');
                  }
                }}
                onBlur={handleEmailBlur}
                readOnly
                onFocus={(e) => { e.target.readOnly = false; }}
                autoComplete="one-time-code"
                data-lpignore="true"
              />
              {emailError && (
                <div style={{
                  fontSize: '0.78rem',
                  color: '#dc2626',
                  marginTop: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontWeight: 500,
                }}>
                  <AlertCircle size={13} style={{ flexShrink: 0 }} />
                  <span>{emailError}</span>
                </div>
              )}
              {editUser && <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>Email cannot be changed after creation.</p>}
            </div>

            {/* Patient-only extra fields */}
            {isPatientRole && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Phone Number</label>
                    <input type="tel" className="admin-form-input" placeholder="(214) 555-0100"
                      value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      autoComplete="one-time-code" data-lpignore="true" />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Date of Birth</label>
                    <input type="date" className="admin-form-input"
                      value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                      autoComplete="one-time-code" />
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Residential Address</label>
                  <input type="text" className="admin-form-input" placeholder="123 Main St, Dallas, TX 75201"
                    value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    autoComplete="one-time-code" data-lpignore="true" />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Account Status *</label>
                  <ShadcnSelect
                    value={formData.status}
                    onChange={(val) => setFormData({ ...formData, status: val })}
                    options={[
                      { value: 'Active', label: 'Active' },
                      { value: 'Inactive', label: 'Inactive' },
                    ]}
                    placeholder="Select status…"
                  />
                </div>
              </>
            )}

            {/* Password fields — create only */}
            {!editUser && (
              <>
                <PasswordInput
                  id="user-password"
                  label={isPatientRole ? 'New Password' : 'Initial Password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  show={showPassword}
                  onToggle={() => setShowPassword(p => !p)}
                  placeholder="Min. 8 characters"
                />
                {isPatientRole && (
                  <PasswordInput
                    id="user-confirm-password"
                    label="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    show={showConfirm}
                    onToggle={() => setShowConfirm(p => !p)}
                    placeholder="Re-enter password"
                  />
                )}
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-10px 0 0', lineHeight: 1.4 }}>
                  {'Minimum 8 characters.' + (isPatientRole ? " This will be the patient's portal login password." : '')}
                </p>
              </>
            )}

            {/* Status — Super Admin only */}
            {!isPatientRole && (
              <div className="admin-form-group">
                <label className="admin-form-label">Account Status *</label>
                <ShadcnSelect
                  value={formData.status}
                  onChange={(val) => setFormData({ ...formData, status: val })}
                  options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                  placeholder="Select status…"
                />
              </div>
            )}

          </div>
        </form>
      </AdminDrawer>

      {/* ── View User Drawer ──────────────────────────────────────────────── */}
      <AdminDrawer
        isOpen={Boolean(viewUser)}
        onClose={() => setViewUser(null)}
        title="User Details"
        subtitle={viewUser?.email}
        width="480px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
            <AdminButton variant="secondary" onClick={() => setViewUser(null)}>Close</AdminButton>
            <AdminButton variant="primary" onClick={() => { setViewUser(null); handleEditClick(viewUser); }}>Edit User</AdminButton>
          </div>
        }
      >
        {viewUser && <ViewUserPanel user={viewUser} />}
      </AdminDrawer>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      <AdminConfirmDialog
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message="Are you sure you want to permanently delete this user? This action cannot be undone."
      />

      {/* ── Status Toggle Confirm ─────────────────────────────────────────── */}
      <AdminConfirmDialog
        isOpen={Boolean(statusConfirm)}
        onClose={() => setStatusConfirm(null)}
        onConfirm={handleToggleStatus}
        title={statusConfirm?.newStatus === 'active' ? 'Activate User' : 'Deactivate User'}
        message={
          statusConfirm?.newStatus === 'active'
            ? `Activate ${statusConfirm?.user?.name || statusConfirm?.user?.email}? They will regain portal access.`
            : `Deactivate ${statusConfirm?.user?.name || statusConfirm?.user?.email}? They will lose sign-in access.`
        }
      />
    </div>
  );
};
