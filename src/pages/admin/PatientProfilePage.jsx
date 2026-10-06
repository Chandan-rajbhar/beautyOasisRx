import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ShoppingBag,
  CreditCard,
  FileText,
  Sparkles,
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  Download,
  Eye,
  Edit2,
  UserCheck,
  UserX,
  AlertCircle,
  Copy,
  DollarSign,
  Layers,
  Camera,
  RefreshCw,
  CheckCircle2,
  Clock,
  TrendingUp,
  Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { supabaseDataService } from '../../services/supabaseDataService';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import { AdminEmptyState } from '../../components/admin/ui/AdminEmptyState';
import { generateInvoice, formatInvoiceNumber, formatInvoiceDate } from '../../services/invoiceService';
import { deduplicatePatientPayments } from '../../utils/paymentDeduplication';

export const PatientProfilePage = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const {
    clients: contextClients = [],
    appointments: contextAppointments = [],
    orders: contextOrders = [],
    payments: contextPayments = [],
    updateItem
  } = useAdminData();

  // ─────────────────────────────────────────────
  // 1. COMPONENT STATE
  // ─────────────────────────────────────────────
  const [patient, setPatient] = useState(() => {
    if (!patientId) return null;
    const cleanId = String(patientId).trim().toLowerCase();
    const found = contextClients.find((c) => c.id === patientId || (c.email && c.email.toLowerCase() === cleanId));
    if (found) return found;
    try {
      const cached = localStorage.getItem('cached_dynamic_patients');
      if (cached) {
        const list = JSON.parse(cached);
        const match = list.find((p) => p.id === patientId || (p.email && p.email.toLowerCase() === cleanId));
        if (match) return match;
      }
    } catch (_) {}
    return null;
  });

  const [loading, setLoading] = useState(!patient);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Directly fetched patient records from Supabase
  const [dbAppointments, setDbAppointments] = useState([]);
  const [dbOrders, setDbOrders] = useState([]);
  const [dbPayments, setDbPayments] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  // Detail viewing modals
  const [previewAppointment, setPreviewAppointment] = useState(null);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [previewPayment, setPreviewPayment] = useState(null);

  // Edit Drawer state
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    address: '',
    status: 'Active',
    allergies: '',
    skin_type: '',
    notes: ''
  });

  // Photo upload state
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const photoInputRef = useRef(null);

  // ─────────────────────────────────────────────
  // 2. SUPABASE DATA FETCHING (DIRECT + FALLBACKS)
  // ─────────────────────────────────────────────

  // Fetch patient profile record
  const fetchPatientDetails = useCallback(async (isSilent = false) => {
    if (!patientId) {
      setError('No patient ID was specified.');
      setLoading(false);
      return null;
    }

    try {
      if (!isSilent) setLoading(true);
      setError(null);

      let record = null;

      // 1. Check patients table
      try {
        const res = await supabase
          .from('patients')
          .select('*')
          .eq('id', patientId)
          .maybeSingle();

        if (res.data) record = res.data;
      } catch (_) {}

      // 2. Try supabaseAdmin if RLS policy blocked
      if (!record && supabaseAdmin) {
        try {
          const adminRes = await supabaseAdmin
            .from('patients')
            .select('*')
            .eq('id', patientId)
            .maybeSingle();

          if (adminRes?.data) record = adminRes.data;
        } catch (_) {}
      }

      // 3. Check legacy clients table
      if (!record) {
        try {
          const clientRes = await supabase
            .from('clients')
            .select('*')
            .eq('id', patientId)
            .maybeSingle();

          if (clientRes.data) record = clientRes.data;
        } catch (_) {}
      }

      // 4. Check patients table by user_id
      if (!record) {
        try {
          const userPatientRes = await supabase
            .from('patients')
            .select('*')
            .eq('user_id', patientId)
            .maybeSingle();
          if (userPatientRes.data) record = userPatientRes.data;
        } catch (_) {}
      }

      // 5. Check patients table by email if patientId contains @
      if (!record && typeof patientId === 'string' && patientId.includes('@')) {
        try {
          const emailPatientRes = await supabase
            .from('patients')
            .select('*')
            .ilike('email', patientId.trim())
            .maybeSingle();
          if (emailPatientRes.data) record = emailPatientRes.data;
        } catch (_) {}
      }

      // 6. Check users table
      if (!record) {
        try {
          const userRes = await supabase
            .from('users')
            .select('*')
            .eq('id', patientId)
            .maybeSingle();
          if (userRes.data) record = userRes.data;
        } catch (_) {}
      }

      // 7. Fallback to AdminDataContext
      if (!record) {
        const cleanId = String(patientId).trim().toLowerCase();
        record = contextClients.find((c) => c.id === patientId || (c.email && c.email.toLowerCase() === cleanId));
      }

      if (record) {
        let cachedPhoto = null;
        try {
          if (record.email) {
            cachedPhoto = localStorage.getItem(`patient_photo_${record.email.toLowerCase().trim()}`);
          }
          if (!cachedPhoto && record.id) {
            cachedPhoto = localStorage.getItem(`patient_photo_${record.id}`);
          }
        } catch (_) {}

        const finalPhoto = record.profilePhotoUrl || record.profile_photo_url || record.avatar || cachedPhoto || null;
        const rawStatus = record.status || record.account_status || 'Active';
        const finalStatus = String(rawStatus).toLowerCase() === 'inactive' ? 'Inactive' : 'Active';

        const normalized = {
          ...record,
          id: record.id,
          name: record.name || record.full_name || 'Patient',
          full_name: record.full_name || record.name || 'Patient',
          email: record.email || '',
          phone: record.phone || '',
          dob: record.dob || record.date_of_birth || '',
          date_of_birth: record.date_of_birth || record.dob || '',
          address: record.address || record.residential_address || '',
          residential_address: record.residential_address || record.address || '',
          status: finalStatus,
          account_status: finalStatus,
          role: record.role || 'Patient',
          profilePhotoUrl: finalPhoto,
          profile_photo_url: finalPhoto,
          avatar: finalPhoto,
          allergies: record.allergies || '',
          skin_type: record.skin_type || '',
          notes: record.notes || '',
          total_spent: record.total_spent !== undefined ? Number(record.total_spent) : undefined
        };

        setPatient(normalized);
        return normalized;
      } else {
        setError('Patient record could not be found. It may have been unlinked or deleted from the registry.');
        return null;
      }
    } catch (err) {
      console.error('Error fetching patient profile:', err);
      setError('An error occurred while loading this patient profile.');
      return null;
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [patientId, contextClients]);

  // Fetch all related records directly from Supabase for this patient
  const fetchPatientRelatedRecords = useCallback(async (currentPatient) => {
    if (!patientId) return;

    setRecordsLoading(true);

    const email = (currentPatient?.email || '').toLowerCase().trim();
    const patientName = currentPatient?.name || currentPatient?.full_name || '';

    try {
      // 1. Fetch Appointments from Supabase
      let fetchedAppointments = [];
      try {
        let apptQuery = supabase.from('appointments').select('*');
        if (email) {
          apptQuery = apptQuery.or(
            `patient_id.eq.${patientId},client_id.eq.${patientId},patient_email.eq.${email},client_email.eq.${email}`
          );
        } else {
          apptQuery = apptQuery.or(`patient_id.eq.${patientId},client_id.eq.${patientId}`);
        }

        const { data: apptData, error: apptErr } = await apptQuery.order('appointment_date', { ascending: false });
        if (!apptErr && Array.isArray(apptData)) {
          fetchedAppointments = apptData;
        }
      } catch (e) {
        console.warn('Direct appointments query error:', e);
      }

      // Merge with context appointments fallback
      const contextMatchedAppts = contextAppointments.filter((a) => {
        const aPid = a.patient_id || a.client_id || a.clientId;
        const aEmail = (a.clientEmail || a.patient_email || a.email || '').toLowerCase().trim();
        return (patientId && aPid === patientId) || (email && aEmail && aEmail === email);
      });

      const mergedApptMap = new Map();
      fetchedAppointments.forEach((a) => mergedApptMap.set(a.id, a));
      contextMatchedAppts.forEach((a) => {
        if (!mergedApptMap.has(a.id)) mergedApptMap.set(a.id, a);
      });
      const finalAppointments = Array.from(mergedApptMap.values()).sort((a, b) => {
        const dateA = a.date || a.appointment_date || a.created_at || '';
        const dateB = b.date || b.appointment_date || b.created_at || '';
        return String(dateB).localeCompare(String(dateA));
      });
      setDbAppointments(finalAppointments);

      // 2. Fetch Orders from Supabase
      let fetchedOrders = [];
      try {
        let ordQuery = supabase.from('orders').select('*');
        if (email) {
          ordQuery = ordQuery.or(
            `client_id.eq.${patientId},patient_id.eq.${patientId},client_email.eq.${email}`
          );
        } else {
          ordQuery = ordQuery.or(`client_id.eq.${patientId},patient_id.eq.${patientId}`);
        }

        const { data: ordData, error: ordErr } = await ordQuery.order('created_at', { ascending: false });
        if (!ordErr && Array.isArray(ordData)) {
          fetchedOrders = ordData;
        }
      } catch (e) {
        console.warn('Direct orders query error:', e);
      }

      // Merge with context orders fallback
      const contextMatchedOrders = contextOrders.filter((o) => {
        const oPid = o.clientId || o.client_id || o.patient_id;
        const oEmail = (o.clientEmail || o.client_email || '').toLowerCase().trim();
        return (patientId && oPid === patientId) || (email && oEmail && oEmail === email);
      });

      const mergedOrderMap = new Map();
      fetchedOrders.forEach((o) => mergedOrderMap.set(o.id, o));
      contextMatchedOrders.forEach((o) => {
        if (!mergedOrderMap.has(o.id)) mergedOrderMap.set(o.id, o);
      });
      const finalOrders = Array.from(mergedOrderMap.values()).sort((a, b) => {
        const dateA = a.date || a.created_at || '';
        const dateB = b.date || b.created_at || '';
        return String(dateB).localeCompare(String(dateA));
      });
      setDbOrders(finalOrders);

      // 3. Fetch Payments from Supabase (using all order & patient identifiers)
      let fetchedPayments = [];
      const orderIds = finalOrders.flatMap((o) => [
        o.id,
        o.order_number,
        o.orderNumber,
        o.invoice_number,
        o.invoiceNumber
      ]).filter(Boolean);
      const apptIds = finalAppointments.map((a) => a.id).filter(Boolean);

      try {
        const pFilters = [
          `client_id.eq.${patientId}`,
          `user_id.eq.${patientId}`
        ];
        if (patientName) {
          pFilters.push(`client_name.eq.${patientName}`);
          pFilters.push(`customer_name.eq.${patientName}`);
        }
        if (email) {
          pFilters.push(`customer_email.eq.${email}`);
        }
        if (orderIds.length > 0) {
          orderIds.forEach((oid) => pFilters.push(`order_id.eq.${oid}`));
        }
        if (apptIds.length > 0) {
          apptIds.forEach((aid) => pFilters.push(`appointment_id.eq.${aid}`));
        }

        let payQuery = supabase.from('payments').select('*');
        if (pFilters.length > 0) {
          payQuery = payQuery.or(pFilters.join(','));
        }
        const { data: payData, error: payErr } = await payQuery.order('date', { ascending: false });
        if (!payErr && Array.isArray(payData)) {
          fetchedPayments = payData;
        }
      } catch (e) {
        console.warn('Direct payments query error:', e);
      }

      // Merge with context payments
      const orderIdSet = new Set(orderIds.map((s) => String(s).toLowerCase().trim()));
      const apptIdSet = new Set(apptIds.map((s) => String(s).toLowerCase().trim()));
      const pNameLower = patientName.toLowerCase().trim();

      const contextMatchedPayments = contextPayments.filter((p) => {
        const pPid = p.clientId || p.client_id || p.patient_id || p.user_id || p.userId;
        const pOrderId = p.order_id || p.orderId;
        const pOrderMatch = pOrderId && orderIdSet.has(String(pOrderId).toLowerCase().trim());
        const pApptId = p.appointment_id || p.appointmentId;
        const pApptMatch = pApptId && apptIdSet.has(String(pApptId).toLowerCase().trim());
        const pName = (p.customer_name || p.clientName || p.client_name || '').toLowerCase().trim();
        const pNameMatch = pNameLower && pName && pName === pNameLower;
        return (patientId && pPid === patientId) || pOrderMatch || pApptMatch || pNameMatch;
      });

      const mergedPayMap = new Map();
      fetchedPayments.forEach((p) => mergedPayMap.set(p.id, p));
      contextMatchedPayments.forEach((p) => {
        if (!mergedPayMap.has(p.id)) mergedPayMap.set(p.id, p);
      });

      // 4. DYNAMIC SYNTHESIS: Ensure all paid appointments and paid orders show as payments
      // A. Synthesize from Paid Appointments
      finalAppointments.forEach((apt) => {
        const isPaid = String(apt.paymentStatus || apt.payment_status || '').toLowerCase() === 'paid';
        if (isPaid) {
          const aptIdentifiers = new Set([
            String(apt.id || '').toLowerCase().trim(),
            String(apt.stripe_payment_intent_id || apt.stripePaymentIntentId || '').toLowerCase().trim(),
            String(apt.stripe_checkout_session_id || '').toLowerCase().trim()
          ].filter(Boolean));

          const exists = Array.from(mergedPayMap.values()).some((p) => {
            const pApptId = String(p.appointment_id || p.appointmentId || '').toLowerCase().trim();
            if (pApptId && aptIdentifiers.has(pApptId)) return true;
            const pTxn = String(p.stripe_payment_intent_id || p.stripePaymentIntentId || p.transactionId || p.reference || '').toLowerCase().trim();
            if (pTxn && aptIdentifiers.has(pTxn)) return true;
            const pSession = String(p.stripe_session_id || p.stripeSessionId || '').toLowerCase().trim();
            if (pSession && aptIdentifiers.has(pSession)) return true;
            return false;
          });

          if (!exists) {
            const synthPay = {
              id: `pay-apt-${apt.id}`,
              transactionId: apt.stripe_payment_intent_id || `TXN-APT-${String(apt.id).substring(0, 8).toUpperCase()}`,
              reference: apt.stripe_payment_intent_id || `APT-${String(apt.id).substring(0, 8).toUpperCase()}`,
              amount: Number(apt.price ?? apt.amount ?? 0),
              total_amount: Number(apt.price ?? apt.amount ?? 0),
              currency: 'USD',
              status: 'Paid',
              paymentMethod: apt.stripe_payment_intent_id ? 'Credit Card (Stripe)' : 'Clinic Card / Settlement',
              method: apt.stripe_payment_intent_id ? 'Credit Card (Stripe)' : 'Clinic Card / Settlement',
              date: apt.date || apt.appointment_date || apt.created_at,
              created_at: apt.created_at || apt.date || apt.appointment_date,
              description: `Clinical Treatment: ${apt.serviceName || apt.protocol_title || apt.service_name || 'Aesthetic Protocol'}`,
              appointment_id: apt.id,
              client_id: patientId,
              client_name: patientName,
              type: 'Clinical Appointment'
            };
            mergedPayMap.set(synthPay.id, synthPay);
          }
        }
      });

      // B. Synthesize from Paid Orders
      finalOrders.forEach((ord) => {
        const isPaid = String(ord.paymentStatus || ord.payment_status || '').toLowerCase() === 'paid';
        if (isPaid) {
          const ordIdentifiers = new Set([
            String(ord.id || '').toLowerCase().trim(),
            String(ord.order_number || ord.orderNumber || '').toLowerCase().trim(),
            String(ord.invoice_number || ord.invoiceNumber || '').toLowerCase().trim(),
            String(ord.stripe_payment_intent_id || ord.stripePaymentIntentId || '').toLowerCase().trim(),
            String(ord.stripe_session_id || ord.stripeSessionId || '').toLowerCase().trim()
          ].filter(Boolean));

          const exists = Array.from(mergedPayMap.values()).some((p) => {
            const pOrderId = String(p.order_id || p.orderId || '').toLowerCase().trim();
            if (pOrderId && ordIdentifiers.has(pOrderId)) return true;
            const pTxn = String(p.stripe_payment_intent_id || p.stripePaymentIntentId || p.transactionId || p.reference || '').toLowerCase().trim();
            if (pTxn && ordIdentifiers.has(pTxn)) return true;
            const pSession = String(p.stripe_session_id || p.stripeSessionId || '').toLowerCase().trim();
            if (pSession && ordIdentifiers.has(pSession)) return true;
            return false;
          });

          if (!exists) {
            const synthPay = {
              id: `pay-ord-${ord.id}`,
              transactionId: ord.transactionId || (ord.stripe_payment_intent_id ? ord.stripe_payment_intent_id : `TXN-ORD-${String(ord.id).substring(0, 8).toUpperCase()}`),
              reference: ord.invoiceNumber || ord.order_number || `ORD-${String(ord.id).substring(0, 8).toUpperCase()}`,
              amount: Number(ord.totalAmount ?? ord.total ?? ord.total_amount ?? 0),
              total_amount: Number(ord.totalAmount ?? ord.total ?? ord.total_amount ?? 0),
              currency: ord.currency || 'USD',
              status: 'Paid',
              paymentMethod: ord.paymentMethod || 'Online Apothecary Checkout',
              method: ord.paymentMethod || 'Online Apothecary Checkout',
              date: ord.date || ord.created_at,
              created_at: ord.created_at || ord.date,
              description: `Apothecary Formulation Order #${ord.order_number || ord.id}`,
              order_id: ord.id,
              client_id: patientId,
              client_name: patientName,
              type: 'Apothecary Order'
            };
            mergedPayMap.set(synthPay.id, synthPay);
          }
        }
      });

      // Deduplicate payments using unique transaction ID and canonical entity mapping
      const finalPayments = deduplicatePatientPayments(
        Array.from(mergedPayMap.values()),
        finalOrders,
        finalAppointments
      );
      setDbPayments(finalPayments);
    } catch (err) {
      console.error('Error fetching patient records:', err);
    } finally {
      setRecordsLoading(false);
    }
  }, [patientId, contextAppointments, contextOrders, contextPayments]);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const loadedPatient = await fetchPatientDetails(false);
      if (isMounted && loadedPatient) {
        await fetchPatientRelatedRecords(loadedPatient);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [patientId]);

  // Real-time Supabase Subscription
  useEffect(() => {
    if (!patientId) return;

    const channelName = `realtime_patient_profile_${patientId.substring(0, 8)}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        if (patient) fetchPatientRelatedRecords(patient);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        if (patient) fetchPatientRelatedRecords(patient);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        if (patient) fetchPatientRelatedRecords(patient);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients', filter: `id=eq.${patientId}` }, () => {
        fetchPatientDetails(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `id=eq.${patientId}` }, () => {
        fetchPatientDetails(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, patient, fetchPatientDetails, fetchPatientRelatedRecords]);

  // Synchronize when context updates
  useEffect(() => {
    if (contextClients.length > 0 && patientId) {
      const match = contextClients.find((c) => c.id === patientId);
      if (match && (!patient || match.updated_at !== patient.updated_at)) {
        setPatient((prev) => ({ ...prev, ...match }));
      }
    }
  }, [contextClients, patientId]);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const updatedPatient = await fetchPatientDetails(true);
      if (updatedPatient) {
        await fetchPatientRelatedRecords(updatedPatient);
      }
      toast.success('Patient data synced with Supabase.');
    } catch (_) {
      toast.error('Sync failed. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // ─────────────────────────────────────────────
  // 3. DYNAMIC DATA & METRIC CALCULATIONS
  // ─────────────────────────────────────────────

  const patientAppointments = useMemo(() => dbAppointments, [dbAppointments]);
  const patientOrders = useMemo(() => dbOrders, [dbOrders]);
  const patientPayments = useMemo(() => {
    return deduplicatePatientPayments(dbPayments, patientOrders, patientAppointments);
  }, [dbPayments, patientOrders, patientAppointments]);

  // Invoices (Generated from patient orders)
  const patientInvoices = useMemo(() => {
    return patientOrders.map((ord) => {
      const ordNumber = ord.order_number || ord.orderNumber;
      const matchingPayment = patientPayments.find((p) => {
        if (p.order_id && (p.order_id === ord.id || (ordNumber && p.order_id === ordNumber))) return true;
        if (p.orderId && (p.orderId === ord.id || (ordNumber && p.orderId === ordNumber))) return true;
        if (ord.stripe_payment_intent_id && (p.transactionId === ord.stripe_payment_intent_id || p.reference === ord.stripe_payment_intent_id)) return true;
        return false;
      });
      const invoiceNumber = ord.invoiceNumber || ord.invoice_number || formatInvoiceNumber(ord.id);
      const date = ord.date || ord.created_at;
      const amount = Number(ord.totalAmount ?? ord.total ?? ord.total_amount ?? 0);
      const rawPayStatus = ord.paymentStatus || ord.payment_status || (matchingPayment ? matchingPayment.status : 'Paid');
      const paymentStatus =
        String(rawPayStatus).toLowerCase() === 'paid'
          ? 'Paid'
          : String(rawPayStatus).toLowerCase() === 'pending'
            ? 'Pending'
            : 'Paid';

      return {
        id: invoiceNumber,
        invoiceNumber,
        orderId: ord.id,
        order: ord,
        payment: matchingPayment,
        date: formatInvoiceDate(date),
        rawDate: date,
        amount,
        paymentStatus,
        patientName: patient?.name || patient?.full_name || ord.clientName || ord.client_name || 'Patient'
      };
    });
  }, [patientOrders, patientPayments, patient]);

  // Treatments & Services
  const patientTreatments = useMemo(() => {
    return patientAppointments.map((a) => ({
      id: a.id,
      name: a.serviceName || a.protocol_title || a.service_name || 'Aesthetic Protocol',
      clinician: a.providerName || a.clinician_name || a.provider_name || 'Assigned Specialist',
      date: a.date || a.appointment_date,
      time: a.time || a.appointment_time,
      status: a.status || 'Confirmed',
      amount: Number(a.price ?? a.amount ?? 0),
      notes: a.notes || 'Routine aesthetic protocol application.'
    }));
  }, [patientAppointments]);

  // Total Lifetime Spent Calculation
  const totalLifetimeSpent = useMemo(() => {
    const settledPaymentsSum = patientPayments
      .filter((p) => {
        const s = String(p.status || p.payment_status || '').toLowerCase();
        return s === 'paid' || s === 'completed' || s === 'settled';
      })
      .reduce((sum, p) => sum + Number(p.total_amount ?? p.amount ?? p.totalAmount ?? 0), 0);

    if (settledPaymentsSum > 0) return settledPaymentsSum;

    if (patient?.total_spent !== undefined && Number(patient.total_spent) > 0) {
      return Number(patient.total_spent);
    }

    const orderSum = patientOrders.reduce((sum, o) => sum + Number(o.totalAmount ?? o.total ?? o.total_amount ?? 0), 0);
    const paidApptSum = patientAppointments
      .filter((a) => String(a.paymentStatus || a.payment_status || '').toLowerCase() === 'paid')
      .reduce((sum, a) => sum + Number(a.price ?? a.amount ?? 0), 0);

    return orderSum + paidApptSum;
  }, [patient, patientOrders, patientAppointments, patientPayments]);

  const totalPaymentsAmount = useMemo(() => {
    return patientPayments.reduce((sum, p) => sum + Number(p.total_amount ?? p.amount ?? p.totalAmount ?? 0), 0);
  }, [patientPayments]);

  // Next scheduled appointment
  const nextAppointment = useMemo(() => {
    if (patientAppointments.length === 0) return null;
    const active = patientAppointments.filter((a) => String(a.status).toLowerCase() !== 'cancelled');
    return active[0] || patientAppointments[0];
  }, [patientAppointments]);

  // ─────────────────────────────────────────────
  // 4. ACTION HANDLERS & HELPERS
  // ─────────────────────────────────────────────

  const handleCopyText = (text, label) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    toast.success(`Copied ${label} to clipboard!`);
  };

  const handleToggleStatus = async () => {
    if (!patient) return;
    const currentStatus = String(patient.status || patient.account_status || 'Active').toLowerCase();
    const nextStatus = currentStatus === 'inactive' ? 'Active' : 'Inactive';

    setStatusUpdating(true);
    try {
      setPatient((prev) => ({
        ...prev,
        status: nextStatus,
        account_status: nextStatus
      }));

      const payload = {
        status: nextStatus,
        account_status: nextStatus,
        updated_at: new Date().toISOString()
      };

      try {
        await supabase.from('patients').update(payload).eq('id', patient.id);
      } catch (_) {
        await supabase.from('clients').update({ status: nextStatus }).eq('id', patient.id);
      }

      supabaseDataService.invalidateCache('clients');
      supabaseDataService.invalidateCache('patients');

      toast.success(`Patient status updated to ${nextStatus}.`);
    } catch (err) {
      console.error('Failed to toggle patient status:', err);
      toast.error('Could not update status. Please try again.');
      fetchPatientDetails(true);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleOpenEdit = () => {
    if (!patient) return;
    setEditFormData({
      name: patient.name || patient.full_name || '',
      email: patient.email || '',
      phone: patient.phone || '',
      dob: patient.dob || patient.date_of_birth || '',
      address: patient.address || patient.residential_address || '',
      status: patient.status || patient.account_status || 'Active',
      allergies: patient.allergies || '',
      skin_type: patient.skin_type || '',
      notes: patient.notes || ''
    });
    setEditPhotoFile(null);
    setEditPhotoPreview(patient.profilePhotoUrl || patient.profile_photo_url || patient.avatar || null);
    setIsEditDrawerOpen(true);
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    setEditPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setEditPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!patient) return;

    setIsSubmittingEdit(true);
    try {
      let finalPhotoUrl = editPhotoPreview || patient.profilePhotoUrl;

      if (editPhotoFile) {
        try {
          const ext = editPhotoFile.name.split('.').pop();
          const fileName = `patient_${patient.id}_${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, editPhotoFile, { upsert: true });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName);
            if (urlData?.publicUrl) {
              finalPhotoUrl = urlData.publicUrl;
            }
          }
        } catch (_) {}
      }

      const updatePayload = {
        name: editFormData.name.trim(),
        full_name: editFormData.name.trim(),
        email: editFormData.email.trim(),
        phone: editFormData.phone.trim(),
        dob: editFormData.dob,
        date_of_birth: editFormData.dob,
        address: editFormData.address.trim(),
        residential_address: editFormData.address.trim(),
        status: editFormData.status,
        account_status: editFormData.status,
        allergies: editFormData.allergies.trim(),
        skin_type: editFormData.skin_type.trim(),
        notes: editFormData.notes.trim(),
        profile_photo_url: finalPhotoUrl,
        avatar: finalPhotoUrl,
        updated_at: new Date().toISOString()
      };

      try {
        await supabase.from('patients').update(updatePayload).eq('id', patient.id);
      } catch (_) {
        await supabase.from('clients').update({
          name: updatePayload.name,
          email: updatePayload.email,
          phone: updatePayload.phone,
          address: updatePayload.address,
          status: updatePayload.status
        }).eq('id', patient.id);
      }

      if (updateItem) {
        updateItem('clients', patient.id, updatePayload);
      }

      supabaseDataService.invalidateCache('clients');
      supabaseDataService.invalidateCache('patients');

      setPatient((prev) => ({
        ...prev,
        ...updatePayload,
        profilePhotoUrl: finalPhotoUrl
      }));

      setIsEditDrawerOpen(false);
      toast.success('Patient profile successfully updated!');
    } catch (err) {
      console.error('Failed to update patient profile:', err);
      toast.error('Failed to update patient profile.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDownloadInvoice = (inv) => {
    try {
      generateInvoice(inv.order, patient, inv.payment);
      toast.success(`Preparing Invoice ${inv.invoiceNumber} for download...`);
    } catch (err) {
      console.error('Invoice generation failed:', err);
      toast.error('Failed to generate invoice PDF.');
    }
  };

  // Helper: Format date into calendar block
  const parseDateBadge = (dateStr, timeStr) => {
    if (!dateStr) return { month: 'DATE', day: '--', time: timeStr || '' };
    try {
      const parts = String(dateStr).split(/[\/\-]/);
      if (parts.length === 3) {
        // If MM/DD/YYYY
        if (parts[0].length <= 2 && parts[2].length === 4) {
          const mIdx = parseInt(parts[0], 10) - 1;
          const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
          return {
            month: months[mIdx] || 'DATE',
            day: parts[1].padStart(2, '0'),
            time: timeStr || ''
          };
        }
        // If YYYY-MM-DD
        if (parts[0].length === 4) {
          const mIdx = parseInt(parts[1], 10) - 1;
          const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
          return {
            month: months[mIdx] || 'DATE',
            day: parts[2].substring(0, 2).padStart(2, '0'),
            time: timeStr || ''
          };
        }
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return {
          month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
          day: String(d.getDate()).padStart(2, '0'),
          time: timeStr || ''
        };
      }
    } catch (_) {}
    return { month: 'DATE', day: '01', time: timeStr || '' };
  };

  // Helper: Render distinct payment badge
  const renderPaymentStatusBadge = (status) => {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'paid' || s === 'completed' || s === 'settled') {
      return (
        <span className="patient-pay-badge paid" title="Settled in full">
          <CheckCircle2 size={12} /> Paid
        </span>
      );
    }
    if (s === 'refunded') {
      return (
        <span className="patient-pay-badge refunded" title="Refund processed">
          <AlertCircle size={12} /> Refunded
        </span>
      );
    }
    return (
      <span className="patient-pay-badge pending" title="Payment pending collection">
        <Clock size={12} /> Unpaid
      </span>
    );
  };

  // Helper: Normalize booking status to avoid duplicate labels like "Pending Payment"
  const cleanBookingStatus = (status) => {
    const s = String(status || 'Confirmed').trim();
    if (/pending\s*payment/i.test(s)) {
      return 'Pending';
    }
    return s;
  };

  // ─────────────────────────────────────────────
  // 5. RENDER STATES
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '16px'
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            border: '3.5px solid rgba(30, 90, 168, 0.15)',
            borderTop: '3.5px solid #1e5aa8',
            borderRadius: '50%',
            animation: 'patientProfileSpin 0.75s linear infinite'
          }}
        />
        <style>{`
          @keyframes patientProfileSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <span style={{ fontSize: '0.92rem', color: '#64748b', fontWeight: 500 }}>
          Retrieving complete patient chart from Supabase...
        </span>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px' }}>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '40px 24px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(15, 41, 66, 0.05)'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}
          >
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f2942', margin: '0 0 8px' }}>
            Patient Chart Not Found
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b', maxWidth: '440px', margin: '0 auto 24px', lineHeight: 1.55 }}>
            {error || `No clinical patient record could be found for ID: "${patientId}". It may have been unlinked or removed from the registry.`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <AdminButton variant="secondary" onClick={() => fetchPatientDetails(false)} icon={<RefreshCw size={14} />}>
              Retry Connection
            </AdminButton>
            <AdminButton variant="primary" onClick={() => navigate('/clients')} icon={<ArrowLeft size={14} />}>
              Back to Patients
            </AdminButton>
          </div>
        </div>
      </div>
    );
  }

  const patientPhoto = patient.profilePhotoUrl || patient.profile_photo_url || patient.avatar;
  const isInactive = String(patient.status || patient.account_status || 'Active').toLowerCase() === 'inactive';

  // ─────────────────────────────────────────────
  // 6. MAIN PROFILE PAGE LAYOUT
  // ─────────────────────────────────────────────

  return (
    <div className="patient-profile-wrapper">
      {/* ── Top Bar: Back Button & Actions ── */}
      <div className="patient-profile-top-bar">
        <button
          type="button"
          onClick={() => navigate('/clients')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '0.84rem',
            fontWeight: 600,
            color: '#1e5aa8',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f0f7ff';
            e.currentTarget.style.borderColor = '#93c5fd';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Patients</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Sync with Supabase"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#475569',
              cursor: isRefreshing ? 'wait' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <AdminButton
            variant="secondary"
            onClick={handleToggleStatus}
            disabled={statusUpdating}
            icon={isInactive ? <UserCheck size={15} color="#15803d" /> : <UserX size={15} color="#b45309" />}
          >
            {isInactive ? 'Activate Patient' : 'Deactivate Patient'}
          </AdminButton>

          <AdminButton
            variant="primary"
            onClick={handleOpenEdit}
            icon={<Edit2 size={15} />}
          >
            Edit Profile
          </AdminButton>
        </div>
      </div>

      {/* ── Primary Patient Header Card ── */}
      <div className="patient-profile-header-card">
        <div className="patient-profile-header-content">
          {/* Left: Avatar + Details */}
          <div className="patient-profile-main-info">
            {patientPhoto ? (
              <img
                src={patientPhoto}
                alt={patient.name}
                style={{
                  width: '74px',
                  height: '74px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2.5px solid #cbd5e1',
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
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #12797e 0%, #0f5257 100%)',
                color: '#ffffff',
                display: patientPhoto ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.9rem',
                fontWeight: 700,
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(18, 121, 126, 0.25)'
              }}
            >
              {(patient.name || patient.full_name || 'P').charAt(0).toUpperCase()}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f2942' }}>
                  {patient.name || patient.full_name}
                </h1>
                <AdminBadge status={patient.status || patient.account_status || 'Active'} />
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #bae6fd'
                  }}
                >
                  Role: {patient.role || 'Patient'}
                </span>
              </div>

              {/* UUID with copy button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '6px',
                  fontSize: '0.78rem',
                  color: '#64748b'
                }}
              >
                <span>ID:</span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    background: '#f1f5f9',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    color: '#334155'
                  }}
                >
                  {patient.id}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(patient.id, 'Patient ID')}
                  title="Copy Patient ID"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1e5aa8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '2px'
                  }}
                >
                  <Copy size={13} />
                </button>
              </div>

              {/* Contact Meta */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginTop: '10px',
                  fontSize: '0.84rem',
                  color: '#475569',
                  flexWrap: 'wrap'
                }}
              >
                {patient.email && (
                  <span
                    onClick={() => handleCopyText(patient.email, 'Email')}
                    title="Click to copy email"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    <Mail size={14} color="#1e5aa8" /> {patient.email}
                  </span>
                )}
                {patient.phone && (
                  <span
                    onClick={() => handleCopyText(patient.phone, 'Phone')}
                    title="Click to copy phone"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    <Phone size={14} color="#16a34a" /> {patient.phone}
                  </span>
                )}
                {(patient.address || patient.residential_address) && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <MapPin size={14} color="#ca8a04" /> {patient.address || patient.residential_address}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Quick Stats Pill Cards */}
          <div className="patient-profile-pills-grid">
            <div className="patient-profile-pill-card">
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                TOTAL SPENT
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803d', marginTop: '3px' }}>
                ${totalLifetimeSpent.toFixed(2)}
              </div>
            </div>

            <div className="patient-profile-pill-card">
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                APPOINTMENTS
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e5aa8', marginTop: '3px' }}>
                {patientAppointments.length}
              </div>
            </div>

            <div className="patient-profile-pill-card">
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                ORDERS
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0284c7', marginTop: '3px' }}>
                {patientOrders.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section Navigation Tabs ── */}
      <div className="patient-profile-tabs-nav">
        {[
          { id: 'overview', label: 'Overview', icon: <Layers size={15} /> },
          { id: 'appointments', label: `Appointments (${patientAppointments.length})`, icon: <Calendar size={15} /> },
          { id: 'orders', label: `Orders (${patientOrders.length})`, icon: <ShoppingBag size={15} /> },
          { id: 'payments', label: `Payments (${patientPayments.length})`, icon: <CreditCard size={15} /> },
          { id: 'invoices', label: `Invoices (${patientInvoices.length})`, icon: <FileText size={15} /> },
          { id: 'treatments', label: `Treatments & Services (${patientTreatments.length})`, icon: <Sparkles size={15} /> }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`patient-profile-tab-btn ${isActive ? 'active' : ''}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT ── */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top 3 Metric Summary Cards */}
          <div className="patient-overview-kpi-grid">
            {/* Lifetime Spend Card */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(15, 41, 66, 0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Lifetime Spend</span>
                <DollarSign size={20} color="#15803d" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#15803d', marginTop: '6px' }}>
                ${totalLifetimeSpent.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
                Settled across appointments & orders
              </div>
            </div>

            {/* Total Appointments Card */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(15, 41, 66, 0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Total Appointments</span>
                <Calendar size={20} color="#1e5aa8" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0f2942', marginTop: '6px' }}>
                {patientAppointments.length}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
                {patientAppointments.filter((a) => String(a.status).toLowerCase() !== 'cancelled').length} active / completed
              </div>
            </div>

            {/* Apothecary Orders Card */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(15, 41, 66, 0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Apothecary Orders</span>
                <ShoppingBag size={20} color="#0284c7" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0f2942', marginTop: '6px' }}>
                {patientOrders.length}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
                {patientInvoices.length} invoices generated
              </div>
            </div>
          </div>

          {/* Lower Grid: Confidential Details & Next Scheduled Procedure */}
          <div className="patient-overview-details-grid">
            {/* Confidential Details Card */}
            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '22px', boxShadow: '0 2px 10px rgba(15, 41, 66, 0.03)' }}>
              <h3 style={{ margin: '0 0 18px', fontSize: '0.98rem', fontWeight: 700, color: '#0f2942', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={17} color="#1e5aa8" /> Confidential Patient Details
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', fontSize: '0.84rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', marginBottom: '2px' }}>Email Address</span>
                  <span style={{ fontWeight: 600, color: '#0f2942', wordBreak: 'break-all' }}>{patient.email || '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', marginBottom: '2px' }}>Phone</span>
                  <span style={{ color: '#0f2942' }}>{patient.phone || 'Not provided'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', marginBottom: '2px' }}>Date of Birth</span>
                  <span style={{ color: '#0f2942' }}>{patient.dob || patient.date_of_birth || 'Not provided'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', marginBottom: '2px' }}>Assigned Role</span>
                  <span style={{ fontWeight: 600, color: '#0369a1' }}>{patient.role || 'Patient'}</span>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', marginBottom: '2px' }}>Residential Address</span>
                  <span style={{ color: '#0f2942' }}>{patient.address || patient.residential_address || 'Not specified'}</span>
                </div>
                {patient.skin_type && (
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', marginBottom: '2px' }}>Skin Classification</span>
                    <span style={{ color: '#0f2942', fontWeight: 600 }}>{patient.skin_type}</span>
                  </div>
                )}
                {patient.allergies && (
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', marginBottom: '2px' }}>Known Allergies</span>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>{patient.allergies}</span>
                  </div>
                )}
                {patient.notes && (
                  <div style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>Clinical Chart Notes</span>
                    <span style={{ color: '#334155', fontSize: '0.82rem' }}>{patient.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Next Scheduled Procedure Card */}
            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '22px', boxShadow: '0 2px 10px rgba(15, 41, 66, 0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f2942', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={17} color="#16a34a" /> Next Scheduled Procedure
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('appointments')}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.8rem',
                    color: '#1e5aa8',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                >
                  View all ({patientAppointments.length})
                </button>
              </div>

              {nextAppointment ? (
                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f2942', fontSize: '0.94rem' }}>
                        {nextAppointment.serviceName || nextAppointment.protocol_title || 'Clinical Treatment'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
                        Specialist: <strong>{nextAppointment.providerName || nextAppointment.clinician_name || 'Assigned Clinician'}</strong>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '3px' }}>
                        {nextAppointment.date || nextAppointment.appointment_date} at {nextAppointment.time || nextAppointment.appointment_time}
                      </div>
                    </div>
                    <AdminBadge status={cleanBookingStatus(nextAppointment.status)} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#15803d' }}>
                      ${Number(nextAppointment.price ?? nextAppointment.amount ?? 0).toFixed(2)} USD
                    </span>
                    <AdminButton variant="secondary" onClick={() => setPreviewAppointment(nextAppointment)} icon={<Eye size={13} />}>
                      View Details
                    </AdminButton>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8', fontSize: '0.86rem' }}>
                  No upcoming appointments on file for this patient.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. APPOINTMENTS TAB (ENHANCED MODERN CLINICAL LAYOUT) */}
      {activeTab === 'appointments' && (
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 2px 10px rgba(15, 41, 66, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f2942' }}>
                Patient Appointment History ({patientAppointments.length})
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                All consultations, clinical treatments, and aesthetic protocols booked for this patient.
              </p>
            </div>
          </div>

          {recordsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTop: '3px solid #1e5aa8', borderRadius: '50%', margin: '0 auto 12px', animation: 'patientProfileSpin 0.75s linear infinite' }} />
              <span>Loading appointment records...</span>
            </div>
          ) : patientAppointments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {patientAppointments.map((apt) => {
                const dateMeta = parseDateBadge(apt.date || apt.appointment_date, apt.time || apt.appointment_time);
                const aptFee = Number(apt.price ?? apt.amount ?? 0);
                const bookingStatus = cleanBookingStatus(apt.status);
                const paymentStatus = apt.paymentStatus || apt.payment_status || 'Pending';

                return (
                  <div key={apt.id} className="patient-appt-card">
                    {/* Left: Calendar Date Badge */}
                    <div className="patient-date-badge">
                      <span className="patient-date-badge-month">{dateMeta.month}</span>
                      <span className="patient-date-badge-day">{dateMeta.day}</span>
                      <span className="patient-date-badge-time">{dateMeta.time || 'Scheduled'}</span>
                    </div>

                    {/* Center: Procedure Details */}
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#0f2942', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{apt.serviceName || apt.protocol_title || apt.service_name || 'Clinical Treatment'}</span>
                        <AdminBadge status={bookingStatus} />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#475569', marginTop: '4px' }}>
                        <User size={13} color="#1e5aa8" />
                        <span>Clinician: <strong>{apt.providerName || apt.clinician_name || apt.provider_name || 'Dr. Sarah Mitchell, MD'}</strong></span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.76rem', color: '#64748b', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span>{apt.date || apt.appointment_date} {apt.time || apt.appointment_time ? `at ${apt.time || apt.appointment_time}` : ''}</span>
                        {apt.notes && <span>• <em>{apt.notes}</em></span>}
                      </div>
                    </div>

                    {/* Right: Price, Payment Status & Action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: '#0f2942', fontSize: '1.15rem' }}>
                          ${aptFee.toFixed(2)}
                        </div>
                        <div style={{ marginTop: '4px' }}>
                          {renderPaymentStatusBadge(paymentStatus)}
                        </div>
                      </div>

                      <AdminButton
                        variant="secondary"
                        onClick={() => setPreviewAppointment(apt)}
                        icon={<Eye size={13} />}
                      >
                        Details
                      </AdminButton>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <AdminEmptyState
              icon={<Calendar size={36} color="#94a3b8" />}
              title="No Appointments Found"
              description="This patient has not booked any clinical appointments or aesthetic treatments yet."
            />
          )}
        </div>
      )}

      {/* 3. ORDERS TAB */}
      {activeTab === 'orders' && (
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 2px 10px rgba(15, 41, 66, 0.03)' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f2942' }}>
              Apothecary Orders & Formulations ({patientOrders.length})
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Purchased skincare products, clinical formulations, and shipments.
            </p>
          </div>

          {recordsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTop: '3px solid #1e5aa8', borderRadius: '50%', margin: '0 auto 12px', animation: 'patientProfileSpin 0.75s linear infinite' }} />
              <span>Loading order records...</span>
            </div>
          ) : patientOrders.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {patientOrders.map((ord) => {
                const invoice = patientInvoices.find((inv) => inv.orderId === ord.id);
                const orderTotal = Number(ord.totalAmount ?? ord.total ?? ord.total_amount ?? 0);
                return (
                  <div key={ord.id} className="patient-card-item">
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e5aa8', fontSize: '0.9rem' }}>
                          #{ord.id}
                        </span>
                        <AdminBadge status={ord.orderStatus || ord.order_status || ord.status || 'Completed'} />
                        {renderPaymentStatusBadge(ord.paymentStatus || ord.payment_status || 'Paid')}
                      </div>
                      <div style={{ fontSize: '0.84rem', color: '#334155', marginTop: '6px' }}>
                        {Array.isArray(ord.items) && ord.items.length > 0
                          ? ord.items.map((i) => `${i.qty || i.quantity || 1}x ${i.name || 'Formulation'}`).join(', ')
                          : '1x Bespoke Formulation'}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '3px' }}>
                        Placed on {ord.date || ord.created_at?.split('T')[0] || 'Recent'} • {Array.isArray(ord.items) ? ord.items.length : 1} item(s)
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#15803d', textAlign: 'right' }}>
                        ${orderTotal.toFixed(2)}
                      </div>

                      <AdminButton
                        variant="secondary"
                        onClick={() => setPreviewOrder(ord)}
                        icon={<Eye size={13} />}
                      >
                        View Order
                      </AdminButton>

                      {invoice && (
                        <AdminButton
                          variant="secondary"
                          onClick={() => handleDownloadInvoice(invoice)}
                          icon={<Download size={13} />}
                        >
                          Invoice
                        </AdminButton>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <AdminEmptyState
              icon={<ShoppingBag size={36} color="#94a3b8" />}
              title="No Apothecary Orders"
              description="No clinical product purchases or shipments recorded for this patient."
            />
          )}
        </div>
      )}

      {/* 4. PAYMENTS TAB (FULLY DYNAMIC WITH SUPABASE) */}
      {activeTab === 'payments' && (
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 2px 10px rgba(15, 41, 66, 0.03)' }}>
          {/* Header & KPI Summary Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f2942' }}>
                Payment Transactions & Settlements ({patientPayments.length})
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                All settled authorizations, clinic collections, and order checkout receipts.
              </p>
            </div>

            {/* Quick Summary Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={16} color="#15803d" />
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Total Settled</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#15803d' }}>
                    ${totalLifetimeSpent.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {recordsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTop: '3px solid #1e5aa8', borderRadius: '50%', margin: '0 auto 12px', animation: 'patientProfileSpin 0.75s linear infinite' }} />
              <span>Retrieving payment history from Supabase...</span>
            </div>
          ) : patientPayments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {patientPayments.map((p) => {
                const payAmount = Number(p.total_amount ?? p.amount ?? 0);
                return (
                  <div key={p.id} className="patient-payment-card">
                    {/* Left: Payment Method Icon */}
                    <div className="patient-payment-icon">
                      <CreditCard size={22} />
                    </div>

                    {/* Middle: Details */}
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e5aa8', fontSize: '0.88rem' }}>
                          {p.transactionId || p.reference || p.id}
                        </span>
                        {renderPaymentStatusBadge(p.status || 'Paid')}
                        {p.type && (
                          <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>
                            {p.type}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f2942', marginTop: '4px' }}>
                        {p.description || `Payment Settlement for #${patient.name}`}
                      </div>

                      <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                        Settled on {p.date || p.created_at} • Method: <strong>{p.paymentMethod || p.method || 'Credit Card'}</strong>
                      </div>
                    </div>

                    {/* Right: Amount & Receipt Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>
                          ${payAmount.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                          {p.currency ? p.currency.toUpperCase() : 'USD'}
                        </div>
                      </div>

                      <AdminButton
                        variant="secondary"
                        onClick={() => setPreviewPayment(p)}
                        icon={<Receipt size={13} />}
                      >
                        Receipt
                      </AdminButton>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <AdminEmptyState
              icon={<CreditCard size={36} color="#94a3b8" />}
              title="No Payment Records Found"
              description="No transaction receipts or payment settlements recorded for this patient yet."
            />
          )}
        </div>
      )}

      {/* 5. INVOICES TAB */}
      {activeTab === 'invoices' && (
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 2px 10px rgba(15, 41, 66, 0.03)' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f2942' }}>
              Patient Invoices ({patientInvoices.length})
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Official BeautyOasisRx patient invoices generated dynamically from orders.
            </p>
          </div>

          {recordsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTop: '3px solid #1e5aa8', borderRadius: '50%', margin: '0 auto 12px', animation: 'patientProfileSpin 0.75s linear infinite' }} />
              <span>Generating invoice records...</span>
            </div>
          ) : patientInvoices.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {patientInvoices.map((inv) => (
                <div key={inv.invoiceNumber} className="patient-card-item">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e5aa8', fontSize: '0.94rem' }}>
                        {inv.invoiceNumber}
                      </span>
                      {renderPaymentStatusBadge(inv.paymentStatus)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>
                      Order Ref: <span style={{ fontFamily: 'monospace' }}>#{inv.orderId}</span> • Date: {inv.date}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                      Issued to: <strong>{inv.patientName}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#15803d', textAlign: 'right' }}>
                      ${inv.amount.toFixed(2)}
                    </div>
                    <AdminButton
                      variant="primary"
                      onClick={() => handleDownloadInvoice(inv)}
                      icon={<Download size={14} />}
                    >
                      Download Invoice
                    </AdminButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState
              icon={<FileText size={36} color="#94a3b8" />}
              title="No Invoices Available"
              description="Invoices are generated automatically from patient orders. No orders have been placed yet."
            />
          )}
        </div>
      )}

      {/* 6. TREATMENT & SERVICES TAB */}
      {activeTab === 'treatments' && (
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 2px 10px rgba(15, 41, 66, 0.03)' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f2942' }}>
              Clinical Treatments & Aesthetic Services ({patientTreatments.length})
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Historical and scheduled aesthetic protocols received by this patient.
            </p>
          </div>

          {recordsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTop: '3px solid #1e5aa8', borderRadius: '50%', margin: '0 auto 12px', animation: 'patientProfileSpin 0.75s linear infinite' }} />
              <span>Loading treatment history...</span>
            </div>
          ) : patientTreatments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {patientTreatments.map((t, idx) => (
                <div key={idx} className="patient-card-item">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.94rem', color: '#0f2942' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
                      Specialist: <strong>{t.clinician}</strong> • {t.date} {t.time ? `at ${t.time}` : ''}
                    </div>
                    {t.notes && (
                      <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px', fontStyle: 'italic' }}>
                        "{t.notes}"
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.95rem' }}>
                      ${t.amount.toFixed(2)}
                    </div>
                    <AdminBadge status={cleanBookingStatus(t.status)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState
              icon={<Sparkles size={36} color="#94a3b8" />}
              title="No Treatments on File"
              description="This patient has not undertaken any clinical procedures or aesthetic treatments yet."
            />
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────── */}
      {/* EDIT PATIENT PROFILE DRAWER */}
      {/* ───────────────────────────────────────────── */}
      <AdminDrawer
        isOpen={isEditDrawerOpen}
        onClose={() => setIsEditDrawerOpen(false)}
        title="Edit Patient Information"
        subtitle={`Update clinical chart & registry details for #${patient.id}`}
        width="560px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <AdminButton variant="secondary" onClick={() => setIsEditDrawerOpen(false)} disabled={isSubmittingEdit}>
              Cancel
            </AdminButton>
            <AdminButton variant="primary" onClick={handleSaveEdit} disabled={isSubmittingEdit}>
              {isSubmittingEdit ? 'Saving Changes...' : 'Save Patient Profile'}
            </AdminButton>
          </div>
        }
      >
        <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Photo Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            {editPhotoPreview ? (
              <img
                src={editPhotoPreview}
                alt="Profile Preview"
                style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #cbd5e1' }}
              />
            ) : (
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={24} color="#64748b" />
              </div>
            )}
            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#1e5aa8',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Camera size={14} /> Change Photo
              </button>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                Max 5MB JPG, PNG or WebP.
              </div>
            </div>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Full Name *</label>
            <input
              type="text"
              className="admin-form-input"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              required
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Email Address *</label>
            <input
              type="email"
              className="admin-form-input"
              value={editFormData.email}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              required
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Phone Number</label>
            <input
              type="tel"
              className="admin-form-input"
              value={editFormData.phone}
              onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Date of Birth</label>
            <input
              type="date"
              className="admin-form-input"
              value={editFormData.dob}
              onChange={(e) => setEditFormData({ ...editFormData, dob: e.target.value })}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Residential Address</label>
            <input
              type="text"
              className="admin-form-input"
              value={editFormData.address}
              onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Account Status</label>
            <select
              className="admin-form-select"
              value={editFormData.status}
              onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Skin Type / Fitzpatrick Classification</label>
            <input
              type="text"
              className="admin-form-input"
              placeholder="e.g. Fitzpatrick Type III, sensitive"
              value={editFormData.skin_type}
              onChange={(e) => setEditFormData({ ...editFormData, skin_type: e.target.value })}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Known Allergies</label>
            <input
              type="text"
              className="admin-form-input"
              placeholder="e.g. Lidocaine, Latex, Retinol"
              value={editFormData.allergies}
              onChange={(e) => setEditFormData({ ...editFormData, allergies: e.target.value })}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Clinical Chart Notes</label>
            <textarea
              className="admin-form-textarea"
              rows={3}
              placeholder="Enter patient medical notes or aesthetic goals..."
              value={editFormData.notes}
              onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
            />
          </div>
        </form>
      </AdminDrawer>

      {/* ───────────────────────────────────────────── */}
      {/* PREVIEW APPOINTMENT MODAL */}
      {/* ───────────────────────────────────────────── */}
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
                  <AdminBadge status={cleanBookingStatus(previewAppointment.status)} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Payment Status
                </span>
                <div style={{ marginTop: '2px' }}>
                  {renderPaymentStatusBadge(previewAppointment.paymentStatus || previewAppointment.payment_status)}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Procedure / Service</span>
                <span style={{ fontWeight: 600 }}>{previewAppointment.serviceName || previewAppointment.protocol_title || 'Clinical Treatment'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Attending Clinician</span>
                <span>{previewAppointment.providerName || previewAppointment.clinician_name || 'Dr. Sarah Mitchell, MD'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Date</span>
                <span>{previewAppointment.date || previewAppointment.appointment_date}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Time</span>
                <span>{previewAppointment.time || previewAppointment.appointment_time || 'Scheduled'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Fee</span>
                <span style={{ color: '#15803d', fontWeight: 700 }}>${Number(previewAppointment.price ?? previewAppointment.amount ?? 0).toFixed(2)} USD</span>
              </div>
            </div>

            {previewAppointment.notes && (
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Notes
                </span>
                {previewAppointment.notes}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <AdminButton variant="primary" onClick={() => setPreviewAppointment(null)}>
                Close
              </AdminButton>
            </div>
          </div>
        </AdminModal>
      )}

      {/* ───────────────────────────────────────────── */}
      {/* PREVIEW ORDER MODAL */}
      {/* ───────────────────────────────────────────── */}
      {previewOrder && (
        <AdminModal
          isOpen={Boolean(previewOrder)}
          onClose={() => setPreviewOrder(null)}
          title={`Apothecary Order #${previewOrder.id}`}
          maxWidth="520px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Order Status
                </span>
                <div style={{ marginTop: '2px' }}>
                  <AdminBadge status={previewOrder.orderStatus || previewOrder.order_status || 'Completed'} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Payment Status
                </span>
                <div style={{ marginTop: '2px' }}>
                  {renderPaymentStatusBadge(previewOrder.paymentStatus || previewOrder.payment_status || 'Paid')}
                </div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '14px' }}>
              <span style={{ color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                Purchased Items
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.isArray(previewOrder.items) && previewOrder.items.length > 0 ? (
                  previewOrder.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                      <div>
                        <strong>{item.qty || item.quantity || 1}x</strong> {item.name || 'Formulation'}
                      </div>
                      <div style={{ fontWeight: 600, color: '#0f2942' }}>
                        ${(Number(item.qty || item.quantity || 1) * Number(item.price || item.unitPrice || 0)).toFixed(2)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.84rem' }}>1x Formulation</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px', fontWeight: 700 }}>
                  <span>Total Amount</span>
                  <span style={{ color: '#15803d' }}>
                    ${Number(previewOrder.totalAmount ?? previewOrder.total ?? previewOrder.total_amount ?? 0).toFixed(2)} USD
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <AdminButton
                variant="secondary"
                onClick={() => {
                  generateInvoice(previewOrder, patient);
                }}
                icon={<Download size={14} />}
              >
                Download Invoice
              </AdminButton>
              <AdminButton variant="primary" onClick={() => setPreviewOrder(null)}>
                Close
              </AdminButton>
            </div>
          </div>
        </AdminModal>
      )}

      {/* ───────────────────────────────────────────── */}
      {/* PREVIEW PAYMENT MODAL */}
      {/* ───────────────────────────────────────────── */}
      {previewPayment && (
        <AdminModal
          isOpen={Boolean(previewPayment)}
          onClose={() => setPreviewPayment(null)}
          title="Payment Settlement Receipt"
          maxWidth="480px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                Amount Settled
              </span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                ${Number(previewPayment.total_amount ?? previewPayment.amount ?? 0).toFixed(2)} {previewPayment.currency ? previewPayment.currency.toUpperCase() : 'USD'}
              </div>
              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
                {renderPaymentStatusBadge(previewPayment.status || 'Paid')}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Transaction Ref</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{previewPayment.transactionId || previewPayment.reference || previewPayment.id}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Payment Method</span>
                <span>{previewPayment.paymentMethod || previewPayment.method || 'Credit Card'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Date</span>
                <span>{previewPayment.date || previewPayment.created_at}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Category / Source</span>
                <span>{previewPayment.type || 'Clinical Settlement'}</span>
              </div>
              {previewPayment.description && (
                <div style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>Description</span>
                  <span style={{ color: '#0f2942', fontWeight: 500 }}>{previewPayment.description}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <AdminButton variant="primary" onClick={() => setPreviewPayment(null)}>
                Close Receipt
              </AdminButton>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
};

export default PatientProfilePage;
