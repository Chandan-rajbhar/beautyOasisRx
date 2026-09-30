import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Plus,
  Eye,
  Edit2,
  Trash2,
  XCircle,
  Clock,
  User,
  Sparkles,
  DollarSign,
  MoreVertical,
  CreditCard,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';
import { StripePaymentModal } from '../../components/admin/appointments/StripePaymentModal';
import { ShadcnSelect } from '../../components/ui/select';
import { supabase } from '../../lib/supabaseClient';

// ─────────────────────────────────────────────────────────────
// TIME & DURATION HELPERS
// ─────────────────────────────────────────────────────────────
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3] ? match[3].toUpperCase() : null;

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  const paddedMins = mins < 10 ? `0${mins}` : `${mins}`;
  const paddedHours = hours12 < 10 ? `0${hours12}` : `${hours12}`;
  return `${paddedHours}:${paddedMins} ${meridiem}`;
}

function parseDurationMinutes(duration) {
  if (typeof duration === 'number') return duration;
  if (!duration) return 60;
  const match = String(duration).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 60;
}

// Standard clinic time slots fallback
const DEFAULT_TIME_SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM',
  '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'
];

export const AppointmentsPage = () => {
  const {
    appointments = [],
    clients = [],
    services = [],
    providers = [],
    createItem,
    updateItem,
    deleteItem,
    isLoading
  } = useAdminData();

  const [searchParams, setSearchParams] = useSearchParams();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [viewTab, setViewTab] = useState('ALL'); // 'ALL' | 'UPCOMING' | 'RECENT'

  // Modals & Drawers state
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(searchParams.get('action') === 'new');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [editAppointment, setEditAppointment] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [payNowAppointment, setPayNowAppointment] = useState(null);
  const [formError, setFormError] = useState(null);

  // Actions Dropdown Menu state & viewport positioning
  const [actionMenuApptId, setActionMenuApptId] = useState(null);
  const [actionMenuPosition, setActionMenuPosition] = useState(null);
  const [statusSubmenuId, setStatusSubmenuId] = useState(null);

  // Dynamic Supabase data states
  const [patientsList, setPatientsList] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_dynamic_patients') || localStorage.getItem('bo_cache_clients');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return clients || [];
  });

  const [cliniciansList, setCliniciansList] = useState(() => {
    try {
      const cached = localStorage.getItem('bo_clinicians_cache') || localStorage.getItem('bo_cache_clinicians');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return providers || [];
  });

  const [protocolsList, setProtocolsList] = useState(() => {
    try {
      const cached = localStorage.getItem('bo_treatment_protocols_cache') || localStorage.getItem('bo_cache_services');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return services || [];
  });

  // Dedicated direct Supabase fetcher for Select Patient, Assigned Clinician, and Protocols
  const fetchSupabaseDropdownData = useCallback(async () => {
    // 1. Fetch Patients from Supabase public.patients
    try {
      const { data: pData, error: pErr } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });
      if (!pErr && Array.isArray(pData) && pData.length > 0) {
        setPatientsList(pData);
        try { localStorage.setItem('cached_dynamic_patients', JSON.stringify(pData)); } catch (_) {}
      } else {
        const { data: cData } = await supabase.from('clients').select('*');
        if (Array.isArray(cData) && cData.length > 0) {
          setPatientsList(cData);
        }
      }
    } catch (err) {
      console.warn('Could not fetch patients from Supabase:', err);
    }

    // 2. Fetch Clinicians from Supabase public.clinicians
    try {
      const { data: cData, error: cErr } = await supabase
        .from('clinicians')
        .select('*')
        .order('created_at', { ascending: false });
      if (!cErr && Array.isArray(cData) && cData.length > 0) {
        setCliniciansList(cData);
        try { localStorage.setItem('bo_clinicians_cache', JSON.stringify(cData)); } catch (_) {}
      } else {
        const { data: prData } = await supabase.from('providers').select('*');
        if (Array.isArray(prData) && prData.length > 0) {
          setCliniciansList(prData);
        }
      }
    } catch (err) {
      console.warn('Could not fetch clinicians from Supabase:', err);
    }

    // 3. Fetch Treatment Protocols from Supabase public.treatment_protocols
    try {
      const { data: tpData, error: tpErr } = await supabase
        .from('treatment_protocols')
        .select('*')
        .order('created_at', { ascending: false });
      if (!tpErr && Array.isArray(tpData) && tpData.length > 0) {
        setProtocolsList(tpData);
        try { localStorage.setItem('bo_treatment_protocols_cache', JSON.stringify(tpData)); } catch (_) {}
      } else {
        const { data: srvData } = await supabase.from('services').select('*');
        if (Array.isArray(srvData) && srvData.length > 0) {
          setProtocolsList(srvData);
        }
      }
    } catch (err) {
      console.warn('Could not fetch treatment protocols from Supabase:', err);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchSupabaseDropdownData();
  }, [fetchSupabaseDropdownData]);

  // Synchronize when context updates
  useEffect(() => {
    if (Array.isArray(clients) && clients.length > 0 && patientsList.length === 0) {
      setPatientsList(clients);
    }
  }, [clients]);

  useEffect(() => {
    if (Array.isArray(providers) && providers.length > 0 && cliniciansList.length === 0) {
      setCliniciansList(providers);
    }
  }, [providers]);

  useEffect(() => {
    if (Array.isArray(services) && services.length > 0 && protocolsList.length === 0) {
      setProtocolsList(services);
    }
  }, [services]);


  // Form state for Add/Edit Appointment
  const [formData, setFormData] = useState({
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    serviceId: '',
    serviceName: '',
    providerId: '',
    providerName: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM',
    duration: '60 Mins',
    price: 185,
    type: 'In-Clinic Protocol',
    status: 'Confirmed',
    paymentStatus: 'Pending',
    room: 'Suite 1 - Gold Treatment Room',
    notes: ''
  });

  // Client Selection auto-fill
  const handleClientSelect = (clientId) => {
    const c = patientsList.find(cl => String(cl.id) === String(clientId)) || clients.find(cl => String(cl.id) === String(clientId));
    if (c) {
      setFormData(prev => ({
        ...prev,
        clientId: String(c.id),
        clientName: c.full_name || c.name || '',
        clientEmail: c.email || '',
        clientPhone: c.phone || ''
      }));
    } else {
      setFormData(prev => ({ ...prev, clientId }));
    }
  };

  // Treatment Protocol / Service Selection auto-fill
  const handleServiceSelect = (serviceId) => {
    const s = protocolsList.find(srv => String(srv.id) === String(serviceId)) || services.find(srv => String(srv.id) === String(serviceId));
    if (s) {
      const priceVal = Number(s.price ?? s.numericPrice ?? 0);
      setFormData(prev => ({
        ...prev,
        serviceId: String(s.id),
        serviceName: s.protocol_title || s.title || s.name || '',
        duration: s.duration || '60 Mins',
        price: priceVal
      }));
    } else {
      setFormData(prev => ({ ...prev, serviceId }));
    }
  };

  // Assigned Clinician / Provider Selection auto-fill
  const handleProviderSelect = (provId) => {
    const p = cliniciansList.find(pr => String(pr.id) === String(provId)) || providers.find(pr => String(pr.id) === String(provId));
    if (p) {
      setFormData(prev => ({
        ...prev,
        providerId: String(p.id),
        providerName: p.clinician_name || p.name || ''
      }));
    } else {
      setFormData(prev => ({ ...prev, providerId: provId }));
    }
  };

  const handleOpenAddDrawer = () => {
    setEditAppointment(null);
    setFormError(null);
    const firstPatient = patientsList[0] || clients[0] || {};
    const firstProtocol = protocolsList[0] || services[0] || {};
    const firstClinician = cliniciansList[0] || providers[0] || {};

    const priceVal = Number(firstProtocol.price ?? firstProtocol.numericPrice ?? 185);

    setFormData({
      clientId: firstPatient.id ? String(firstPatient.id) : '',
      clientName: firstPatient.full_name || firstPatient.name || '',
      clientEmail: firstPatient.email || '',
      clientPhone: firstPatient.phone || '',
      serviceId: firstProtocol.id ? String(firstProtocol.id) : '',
      serviceName: firstProtocol.protocol_title || firstProtocol.title || firstProtocol.name || '',
      providerId: firstClinician.id ? String(firstClinician.id) : '',
      providerName: firstClinician.clinician_name || firstClinician.name || '',
      date: new Date().toISOString().split('T')[0],
      time: '10:00 AM',
      duration: firstProtocol.duration || '60 Mins',
      price: priceVal,
      type: 'In-Clinic Protocol',
      status: 'Confirmed',
      paymentStatus: 'Pending',
      room: 'Suite 1 - Gold Treatment Room',
      notes: ''
    });
    setIsAddDrawerOpen(true);
  };

  const handleEditClick = (appt) => {
    setEditAppointment(appt);
    setFormError(null);
    setFormData({
      clientId: appt.client_id || appt.clientId || appt.patient_id || '',
      clientName: appt.client_name || appt.clientName || appt.patient_name || '',
      clientEmail: appt.client_email || appt.clientEmail || appt.patient_email || '',
      clientPhone: appt.client_phone || appt.clientPhone || appt.patient_phone || '',
      serviceId: appt.treatment_protocol_id || appt.service_id || appt.serviceId || '',
      serviceName: appt.protocol_title || appt.service_name || appt.serviceName || '',
      providerId: appt.clinician_id || appt.provider_id || appt.providerId || '',
      providerName: appt.clinician_name || appt.provider_name || appt.providerName || '',
      date: appt.appointment_date || appt.date || new Date().toISOString().split('T')[0],
      time: appt.appointment_time || appt.time || '10:00 AM',
      duration: appt.duration || '60 Mins',
      price: appt.price ?? appt.amount ?? 0,
      type: appt.type || 'In-Clinic Protocol',
      status: appt.status || 'Confirmed',
      paymentStatus: appt.payment_status || appt.paymentStatus || 'Pending',
      room: appt.room || 'Suite 1 - Gold Treatment Room',
      notes: appt.notes || ''
    });
    setIsAddDrawerOpen(true);
  };

  // Pre-computed options for Shadcn Dropdowns
  const patientOptions = useMemo(() => {
    return patientsList.map(c => ({
      value: String(c.id),
      label: `${c.full_name || c.name || 'Patient'}${c.phone || c.email ? ` (${c.phone || c.email})` : ''}`
    }));
  }, [patientsList]);

  const serviceOptions = useMemo(() => {
    return protocolsList.map(s => {
      const title = s.protocol_title || s.title || s.name || 'Treatment Protocol';
      const dur = s.duration || '60 Mins';
      const price = Number(s.price ?? s.numericPrice ?? 0);
      return {
        value: String(s.id),
        label: `${title} (${dur} - $${price})`
      };
    });
  }, [protocolsList]);

  const clinicianOptions = useMemo(() => {
    return cliniciansList.map(p => ({
      value: String(p.id),
      label: `${p.clinician_name || p.name || 'Clinician'}${p.clinical_title || p.role || p.specialization ? ` (${p.clinical_title || p.role || p.specialization})` : ''}`
    }));
  }, [cliniciansList]);

  // ─────────────────────────────────────────────────────────────
  // DYNAMIC TIME SLOTS CALCULATION & CONFLICT DETECTION
  // ─────────────────────────────────────────────────────────────
  const availableTimeSlots = useMemo(() => {
    if (!formData.providerId || !formData.date) {
      return DEFAULT_TIME_SLOTS.map(t => ({ time: t, isBooked: false }));
    }

    const clinician = cliniciansList.find(p => String(p.id) === String(formData.providerId)) || providers.find(p => String(p.id) === String(formData.providerId));
    let startMin = 540;  // 09:00 AM
    let endMin = 1080;   // 06:00 PM

    // Check clinician availability schedule if defined
    if (clinician && clinician.availability_schedule && typeof clinician.availability_schedule === 'object') {
      const dayName = new Date(formData.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
      const dayHours = clinician.availability_schedule[dayName];
      if (dayHours && typeof dayHours === 'string') {
        if (dayHours.toLowerCase() === 'off') {
          return [{ time: 'Clinician is off on this date', isBooked: true, isOff: true }];
        }
        const timeRangeMatch = dayHours.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
        if (timeRangeMatch) {
          const sMin = timeToMinutes(timeRangeMatch[1]);
          const eMin = timeToMinutes(timeRangeMatch[2]);
          if (eMin > sMin) {
            startMin = sMin;
            endMin = eMin;
          }
        }
      }
    }

    const durationMins = parseDurationMinutes(formData.duration);

    // Get existing appointments for this clinician on this date (excluding cancelled & currently editing appt)
    const existingBookings = appointments.filter(apt => {
      if (editAppointment && apt.id === editAppointment.id) return false;
      if (apt.status === 'Cancelled') return false;
      const aptProvId = apt.clinician_id || apt.provider_id || apt.providerId;
      const aptDate = apt.appointment_date || apt.date;
      return String(aptProvId) === String(formData.providerId) && aptDate === formData.date;
    }).map(apt => {
      const s = timeToMinutes(apt.appointment_time || apt.time);
      const d = parseDurationMinutes(apt.duration);
      return { start: s, end: s + d };
    });

    const slots = [];
    for (let m = startMin; m + durationMins <= endMin; m += 30) {
      const slotStart = m;
      const slotEnd = m + durationMins;
      const isConflict = existingBookings.some(b => slotStart < b.end && slotEnd > b.start);
      slots.push({
        time: minutesToTime(slotStart),
        isBooked: isConflict
      });
    }

    return slots.length > 0 ? slots : DEFAULT_TIME_SLOTS.map(t => ({ time: t, isBooked: false }));
  }, [formData.providerId, formData.date, formData.duration, cliniciansList, providers, appointments, editAppointment]);

  const timeOptions = useMemo(() => {
    return availableTimeSlots.map((slot) => ({
      value: slot.time,
      label: slot.isBooked ? `${slot.time} (Already Booked)` : slot.time,
      disabled: slot.isBooked
    }));
  }, [availableTimeSlots]);

  // ─────────────────────────────────────────────────────────────
  // SAVE APPOINTMENT (CREATE / UPDATE) WITH CONFLICT VALIDATION
  // ─────────────────────────────────────────────────────────────
  const handleSaveAppointment = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.clientId) {
      setFormError('Please select a registered patient.');
      return;
    }
    if (!formData.serviceId) {
      setFormError('Please select a clinical treatment protocol.');
      return;
    }
    if (!formData.providerId) {
      setFormError('Please assign a clinician for this appointment.');
      return;
    }
    if (!formData.date || !formData.time) {
      setFormError('Please select both appointment date and time.');
      return;
    }

    // Step 1: Validate conflict with clinician's schedule & other bookings
    const selectedStartMin = timeToMinutes(formData.time);
    const selectedDurationMin = parseDurationMinutes(formData.duration);
    const selectedEndMin = selectedStartMin + selectedDurationMin;

    const conflict = appointments.find(apt => {
      if (editAppointment && apt.id === editAppointment.id) return false;
      if (apt.status === 'Cancelled') return false;
      const aptProvId = apt.clinician_id || apt.provider_id || apt.providerId;
      const aptDate = apt.appointment_date || apt.date;
      if (String(aptProvId) !== String(formData.providerId) || aptDate !== formData.date) return false;

      const aptStart = timeToMinutes(apt.appointment_time || apt.time);
      const aptDur = parseDurationMinutes(apt.duration);
      const aptEnd = aptStart + aptDur;

      return selectedStartMin < aptEnd && selectedEndMin > aptStart;
    });

    if (conflict) {
      const errMsg = 'This clinician is already booked for the selected time.';
      setFormError(errMsg);
      toast.error(errMsg);
      return;
    }

    // Prepare complete payload with both snake_case and camelCase for resilient Supabase storage
    const appointmentPayload = {
      patient_id: formData.clientId,
      client_id: formData.clientId,
      clientId: formData.clientId,
      patient_name: formData.clientName,
      client_name: formData.clientName,
      clientName: formData.clientName,
      patient_email: formData.clientEmail,
      client_email: formData.clientEmail,
      clientEmail: formData.clientEmail,
      patient_phone: formData.clientPhone,
      client_phone: formData.clientPhone,
      clientPhone: formData.clientPhone,
      treatment_protocol_id: formData.serviceId,
      service_id: formData.serviceId,
      serviceId: formData.serviceId,
      protocol_title: formData.serviceName,
      service_name: formData.serviceName,
      serviceName: formData.serviceName,
      clinician_id: formData.providerId,
      provider_id: formData.providerId,
      providerId: formData.providerId,
      clinician_name: formData.providerName,
      provider_name: formData.providerName,
      providerName: formData.providerName,
      appointment_date: formData.date,
      date: formData.date,
      appointment_time: formData.time,
      time: formData.time,
      duration: formData.duration,
      amount: formData.price,
      price: formData.price,
      notes: formData.notes || '',
      // Initial status and payment status are strictly system-driven
      status: editAppointment ? editAppointment.status : 'Confirmed',
      payment_status: editAppointment ? (editAppointment.payment_status || editAppointment.paymentStatus || 'Pending') : 'Pending',
      paymentStatus: editAppointment ? (editAppointment.payment_status || editAppointment.paymentStatus || 'Pending') : 'Pending'
    };

    try {
      if (editAppointment) {
        await updateItem('appointments', editAppointment.id, appointmentPayload);
        toast.success('Appointment protocol updated successfully.');
        setEditAppointment(null);
      } else {
        await createItem('appointments', appointmentPayload);
        toast.success('New clinical appointment scheduled successfully.');
        setIsAddDrawerOpen(false);
        searchParams.delete('action');
        setSearchParams(searchParams);
      }
    } catch (saveErr) {
      console.error('Failed to save appointment:', saveErr);
      const msg = saveErr.message || 'Failed to save appointment. Please check connection.';
      setFormError(msg);
      toast.error(msg);
    }
  };

  // Delete appointment handler
  const handleDelete = async () => {
    if (deleteConfirmId) {
      try {
        await deleteItem('appointments', deleteConfirmId);
        toast.success('Appointment record deleted.');
        setDeleteConfirmId(null);
      } catch (delErr) {
        console.error('Delete appointment error:', delErr);
        toast.error('Failed to delete appointment.');
      }
    }
  };

  // Change Status handler
  const handleUpdateStatus = async (apptId, newStatus) => {
    try {
      await updateItem('appointments', apptId, { status: newStatus });
      toast.success(`Appointment status updated to ${newStatus}.`);
      setActionMenuApptId(null);
      setStatusSubmenuId(null);
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error('Could not update appointment status.');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // FILTERING & DATE LOGIC
  // ─────────────────────────────────────────────────────────────
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        (apt.clientName && apt.clientName.toLowerCase().includes(searchLower)) ||
        (apt.patient_name && apt.patient_name.toLowerCase().includes(searchLower)) ||
        (apt.serviceName && apt.serviceName.toLowerCase().includes(searchLower)) ||
        (apt.protocol_title && apt.protocol_title.toLowerCase().includes(searchLower)) ||
        (apt.providerName && apt.providerName.toLowerCase().includes(searchLower)) ||
        (apt.clinician_name && apt.clinician_name.toLowerCase().includes(searchLower)) ||
        (apt.id && apt.id.toLowerCase().includes(searchLower));

      const aptStatus = apt.status || 'Confirmed';
      const matchStatus = statusFilter === 'ALL' || aptStatus === statusFilter;

      const aptServiceName = apt.serviceName || apt.protocol_title;
      const matchService = serviceFilter === 'ALL' || aptServiceName === serviceFilter;

      const aptProvName = apt.providerName || apt.clinician_name;
      const matchProvider = providerFilter === 'ALL' || aptProvName === providerFilter;

      const aptPayment = apt.paymentStatus || apt.payment_status || 'Pending';
      const matchPayment = paymentFilter === 'ALL' || aptPayment === paymentFilter;

      // Date Filtering
      const aptDateStr = apt.date || apt.appointment_date || '';
      let matchDate = true;
      if (dateFilter === 'TODAY') {
        matchDate = aptDateStr === todayStr;
      } else if (dateFilter === 'THIS_WEEK') {
        if (!aptDateStr) matchDate = false;
        else {
          const aptDate = new Date(aptDateStr);
          const diffDays = (aptDate - now) / (1000 * 60 * 60 * 24);
          matchDate = diffDays >= -7 && diffDays <= 7;
        }
      } else if (dateFilter === 'THIS_MONTH') {
        if (!aptDateStr) matchDate = false;
        else {
          const [y, m] = aptDateStr.split('-');
          matchDate = Number(y) === now.getFullYear() && Number(m) === (now.getMonth() + 1);
        }
      } else if (dateFilter === 'UPCOMING') {
        matchDate = aptDateStr >= todayStr && aptStatus !== 'Completed' && aptStatus !== 'Cancelled';
      } else if (dateFilter === 'RECENT') {
        matchDate = aptDateStr < todayStr || aptStatus === 'Completed';
      }

      // Tab Filtering
      let matchTab = true;
      if (viewTab === 'UPCOMING') {
        matchTab = aptDateStr >= todayStr && aptStatus !== 'Completed' && aptStatus !== 'Cancelled';
      } else if (viewTab === 'RECENT') {
        matchTab = aptDateStr < todayStr || aptStatus === 'Completed';
      }

      return matchSearch && matchStatus && matchService && matchProvider && matchPayment && matchDate && matchTab;
    }).sort((a, b) => {
      // Sorting based on active tab
      const dateA = a.date || a.appointment_date || '';
      const dateB = b.date || b.appointment_date || '';
      if (viewTab === 'UPCOMING') {
        // Nearest upcoming first
        return dateA.localeCompare(dateB) || (a.time || '').localeCompare(b.time || '');
      }
      // Latest / newest first
      return dateB.localeCompare(dateA) || (b.time || '').localeCompare(a.time || '');
    });
  }, [
    appointments,
    searchTerm,
    statusFilter,
    serviceFilter,
    providerFilter,
    paymentFilter,
    dateFilter,
    viewTab,
    todayStr,
    now
  ]);

  const upcomingCount = useMemo(() => {
    return appointments.filter(a => {
      const d = a.date || a.appointment_date || '';
      const st = a.status || 'Confirmed';
      return d >= todayStr && st !== 'Completed' && st !== 'Cancelled';
    }).length;
  }, [appointments, todayStr]);

  const recentCount = useMemo(() => {
    return appointments.filter(a => {
      const d = a.date || a.appointment_date || '';
      const st = a.status || 'Confirmed';
      return d < todayStr || st === 'Completed';
    }).length;
  }, [appointments, todayStr]);

  const hasActiveFilters =
    Boolean(searchTerm) ||
    statusFilter !== 'ALL' ||
    serviceFilter !== 'ALL' ||
    providerFilter !== 'ALL' ||
    paymentFilter !== 'ALL' ||
    dateFilter !== 'ALL' ||
    viewTab !== 'ALL';

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setServiceFilter('ALL');
    setProviderFilter('ALL');
    setPaymentFilter('ALL');
    setDateFilter('ALL');
    setViewTab('ALL');
  };

  // ─────────────────────────────────────────────────────────────
  // TABLE COLUMNS CONFIGURATION
  // ─────────────────────────────────────────────────────────────
  const columns = [
    {
      header: 'Patient / Client',
      accessor: 'clientName',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f2942' }}>
            {row.clientName || row.patient_name}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {row.clientPhone || row.patient_phone || row.clientEmail || row.patient_email}
          </div>
        </div>
      )
    },
    {
      header: 'Service Protocol',
      accessor: 'serviceName',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 500, color: '#0f2942' }}>
            {row.serviceName || row.protocol_title}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#1e5aa8', display: 'flex', gap: '8px' }}>
            <span>{row.duration || '60 Mins'}</span>
            <span>•</span>
            <span style={{ fontWeight: 600, color: '#15803d' }}>
              ${row.price ?? row.amount ?? 0}
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'Provider',
      accessor: 'providerName',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontSize: '0.86rem', color: '#334155', fontWeight: 500 }}>
            {row.providerName || row.clinician_name}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Clinical Specialist
          </div>
        </div>
      )
    },
    {
      header: 'Date & Time',
      accessor: 'date',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f2942' }}>
            {row.date || row.appointment_date}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
            {row.time || row.appointment_time}
          </div>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (row) => <AdminBadge status={row.status || 'Confirmed'} />
    },
    {
      header: 'Payment',
      accessor: 'paymentStatus',
      sortable: true,
      render: (row) => <AdminBadge status={row.paymentStatus || row.payment_status || 'Pending'} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (row) => {
        const isMenuOpen = actionMenuApptId === row.id;
        const isPaid = (row.paymentStatus || row.payment_status) === 'Paid';
        const isCancelled = row.status === 'Cancelled';

        return (
          <div className="appointment-action-menu-container" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <button
              type="button"
              title="Appointment Actions"
              onClick={(e) => {
                e.stopPropagation();
                if (isMenuOpen) {
                  setActionMenuApptId(null);
                  setActionMenuPosition(null);
                  setStatusSubmenuId(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setActionMenuPosition({
                    top: rect.bottom + 4,
                    right: window.innerWidth - rect.right
                  });
                  setActionMenuApptId(row.id);
                  setStatusSubmenuId(null);
                }
              }}
              style={{
                background: isMenuOpen ? '#e2e8f0' : '#f8fafc',
                border: '1px solid #cbd5e1',
                padding: '6px',
                borderRadius: '6px',
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

            {/* Fixed Viewport Dropdown Menu */}
            {isMenuOpen && actionMenuPosition && (
              <div
                className="appointment-action-dropdown-menu"
                style={{
                  position: 'fixed',
                  top: `${actionMenuPosition.top}px`,
                  right: `${actionMenuPosition.right}px`,
                  width: '180px',
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
                {/* 1. View Appointment */}
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuApptId(null);
                    setActionMenuPosition(null);
                    setSelectedAppointment(row);
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
                  <span>View Details</span>
                </button>

                {/* 2. Edit Appointment */}
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuApptId(null);
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
                  <span>Edit</span>
                </button>

                {/* 3. Stripe Pay Now (only if not paid & not cancelled) */}
                {!isPaid && !isCancelled && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionMenuApptId(null);
                      setActionMenuPosition(null);
                      setPayNowAppointment(row);
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
                      fontWeight: 600,
                      color: '#15803d',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <CreditCard size={15} color="#16a34a" />
                    <span>Pay Now (Stripe)</span>
                  </button>
                )}

                {/* 4. Change Status Submenu Toggle */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setStatusSubmenuId(statusSubmenuId === row.id ? null : row.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '8px 10px',
                      border: 'none',
                      background: statusSubmenuId === row.id ? '#f1f5f9' : 'transparent',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      color: '#0f2942',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={(e) => { if (statusSubmenuId !== row.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <RotateCcw size={15} color="#64748b" />
                      <span>Change Status</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>›</span>
                  </button>

                  {/* Status Options */}
                  {statusSubmenuId === row.id && (
                    <div
                      style={{
                        padding: '4px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        marginTop: '2px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      {['Confirmed', 'Completed', 'Scheduled', 'Cancelled', 'No Show', 'Rescheduled'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleUpdateStatus(row.id, st)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            border: 'none',
                            background: row.status === st ? '#e0f2fe' : 'transparent',
                            color: row.status === st ? '#0369a1' : '#334155',
                            borderRadius: '4px',
                            fontSize: '0.78rem',
                            fontWeight: row.status === st ? 600 : 400,
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                          onMouseEnter={(e) => { if (row.status !== st) e.currentTarget.style.background = '#e2e8f0'; }}
                          onMouseLeave={(e) => { if (row.status !== st) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span>{st}</span>
                          {row.status === st && <Check size={12} color="#0369a1" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />

                {/* 5. Delete Appointment */}
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuApptId(null);
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
                    color: '#b91c1c',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Trash2 size={15} color="#b91c1c" />
                  <span>Delete</span>
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
      {/* Page Header */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Appointment Management</h1>
          <p>Schedule, monitor, and manage clinical consultations and treatment protocols.</p>
        </div>

        <div className="admin-page-actions">
          <AdminButton
            variant="primary"
            onClick={handleOpenAddDrawer}
            icon={<Plus size={16} />}
          >
            New Appointment
          </AdminButton>
        </div>
      </div>

      {/* Quick View Tab Pills (Upcoming / Recent / All) */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '12px'
        }}
      >
        <button
          type="button"
          onClick={() => { setViewTab('ALL'); setDateFilter('ALL'); }}
          style={{
            padding: '7px 16px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            background: viewTab === 'ALL' ? '#0f2942' : '#f1f5f9',
            color: viewTab === 'ALL' ? '#ffffff' : '#64748b'
          }}
        >
          All Appointments ({appointments.length})
        </button>

        <button
          type="button"
          onClick={() => { setViewTab('UPCOMING'); setDateFilter('ALL'); }}
          style={{
            padding: '7px 16px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: viewTab === 'UPCOMING' ? '#1e5aa8' : '#f1f5f9',
            color: viewTab === 'UPCOMING' ? '#ffffff' : '#64748b'
          }}
        >
          <Calendar size={14} />
          Upcoming Appointments ({upcomingCount})
        </button>

        <button
          type="button"
          onClick={() => { setViewTab('RECENT'); setDateFilter('ALL'); }}
          style={{
            padding: '7px 16px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: viewTab === 'RECENT' ? '#15803d' : '#f1f5f9',
            color: viewTab === 'RECENT' ? '#ffffff' : '#64748b'
          }}
        >
          <Clock size={14} />
          Recent Appointments ({recentCount})
        </button>
      </div>

      {/* Toolbar / Filters */}
      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by patient, service, provider..."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        filters={[
          {
            id: 'date',
            value: dateFilter,
            onChange: setDateFilter,
            options: [
              { label: 'All Dates', value: 'ALL' },
              { label: 'Upcoming', value: 'UPCOMING' },
              { label: 'Recent / Past', value: 'RECENT' },
              { label: 'Today', value: 'TODAY' },
              { label: 'This Week', value: 'THIS_WEEK' },
              { label: 'This Month', value: 'THIS_MONTH' }
            ]
          },
          {
            id: 'status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Confirmed', value: 'Confirmed' },
              { label: 'Scheduled', value: 'Scheduled' },
              { label: 'Completed', value: 'Completed' },
              { label: 'Pending', value: 'Pending' },
              { label: 'Cancelled', value: 'Cancelled' },
              { label: 'No Show', value: 'No Show' },
              { label: 'Rescheduled', value: 'Rescheduled' }
            ]
          },
          {
            id: 'payment',
            value: paymentFilter,
            onChange: setPaymentFilter,
            options: [
              { label: 'All Payments', value: 'ALL' },
              { label: 'Paid', value: 'Paid' },
              { label: 'Pending', value: 'Pending' },
              { label: 'Refunded', value: 'Refunded' }
            ]
          },
          {
            id: 'provider',
            value: providerFilter,
            onChange: setProviderFilter,
            options: [
              { label: 'All Clinicians', value: 'ALL' },
              ...cliniciansList.map(p => ({
                label: p.clinician_name || p.name,
                value: p.clinician_name || p.name
              }))
            ]
          }
        ]}
      />

      {/* Main Table */}
      <AdminTable
        columns={columns}
        data={filteredAppointments}
        loading={isLoading}
        itemsPerPage={10}
        emptyTitle="No appointments match your filters"
        emptyDescription="Try adjusting your search criteria, dates, or booking a new clinical appointment."
        emptyActionLabel="Schedule Appointment"
        onEmptyAction={handleOpenAddDrawer}
      />

      {/* ── 1. Right-Side Drawer for New & Edit Appointment ── */}
      <AdminDrawer
        isOpen={isAddDrawerOpen || Boolean(editAppointment)}
        onClose={() => {
          setIsAddDrawerOpen(false);
          setEditAppointment(null);
          setFormError(null);
        }}
        title={editAppointment ? "Edit Appointment Protocol" : "Schedule New Appointment"}
        subtitle={
          editAppointment
            ? `Editing booking #${editAppointment.id}`
            : "Reserve a clinical treatment room and assign physician."
        }
        width="560px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
            <AdminButton
              variant="secondary"
              onClick={() => {
                setIsAddDrawerOpen(false);
                setEditAppointment(null);
                setFormError(null);
              }}
            >
              Cancel
            </AdminButton>
            <AdminButton
              type="submit"
              form="appointment-drawer-form"
              variant="primary"
            >
              {editAppointment ? "Update Appointment" : "Confirm & Save Appointment"}
            </AdminButton>
          </div>
        }
      >
        {/* Form Validation Error Banner */}
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
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{formError}</span>
          </div>
        )}

        <form id="appointment-drawer-form" onSubmit={handleSaveAppointment}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 1. Patient / Client Selection */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Select Patient / Client <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <ShadcnSelect
                value={formData.clientId}
                onChange={(val) => handleClientSelect(val)}
                options={patientOptions}
                placeholder="-- Choose Existing Patient --"
              />
            </div>

            {/* 2. Clinical Treatment / Service Selection */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Clinical Treatment / Service <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <ShadcnSelect
                value={formData.serviceId}
                onChange={(val) => handleServiceSelect(val)}
                options={serviceOptions}
                placeholder="-- Choose Treatment Protocol --"
              />
            </div>

            {/* 3. Assigned Clinician Selection */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Assigned Clinician <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <ShadcnSelect
                value={formData.providerId}
                onChange={(val) => handleProviderSelect(val)}
                options={clinicianOptions}
                placeholder="-- Select Physician / Clinician --"
              />
            </div>

            {/* 4 & 5. Date & Time Selection (Grid 2) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">
                  Appointment Date <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="date"
                  className="admin-form-input"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  Appointment Time <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <ShadcnSelect
                  value={formData.time}
                  onChange={(val) => setFormData(prev => ({ ...prev, time: val }))}
                  options={timeOptions}
                  placeholder="Select Appointment Time"
                />
              </div>
            </div>


            {/* 6. Sensory & Medical Notes */}
            <div className="admin-form-group">
              <label className="admin-form-label">Sensory & Medical Notes</label>
              <textarea
                className="admin-form-textarea"
                rows="3"
                placeholder="Sensory adjustments, lighting preferences, skin allergies, or customized booster requirements..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
        </form>
      </AdminDrawer>

      {/* ── 2. View Appointment Drawer ── */}
      <AdminDrawer
        isOpen={Boolean(selectedAppointment)}
        onClose={() => setSelectedAppointment(null)}
        title="Appointment Summary"
        subtitle={`Reference #${selectedAppointment?.id}`}
        width="560px"
        footer={
          <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end' }}>
            {selectedAppointment &&
              (selectedAppointment.paymentStatus || selectedAppointment.payment_status) !== 'Paid' &&
              selectedAppointment.status !== 'Cancelled' && (
                <AdminButton
                  variant="primary"
                  onClick={() => {
                    const target = selectedAppointment;
                    setSelectedAppointment(null);
                    setPayNowAppointment(target);
                  }}
                  icon={<CreditCard size={14} />}
                >
                  Pay Now (${selectedAppointment.price ?? selectedAppointment.amount ?? 0})
                </AdminButton>
              )}
            <AdminButton
              variant="secondary"
              onClick={() => {
                const target = selectedAppointment;
                setSelectedAppointment(null);
                handleEditClick(target);
              }}
              icon={<Edit2 size={14} />}
            >
              Edit Details
            </AdminButton>
            <AdminButton variant="secondary" onClick={() => setSelectedAppointment(null)}>
              Done
            </AdminButton>
          </div>
        }
      >
        {selectedAppointment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Appointment Status
                </span>
                <div style={{ marginTop: '4px' }}>
                  <AdminBadge status={selectedAppointment.status || 'Confirmed'} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Payment Status
                </span>
                <div style={{ marginTop: '4px' }}>
                  <AdminBadge status={selectedAppointment.paymentStatus || selectedAppointment.payment_status || 'Pending'} />
                </div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#0f2942', fontWeight: 700 }}>
                Patient Details
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Name</span>
                  <span style={{ fontWeight: 600 }}>{selectedAppointment.clientName || selectedAppointment.patient_name}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Contact Phone</span>
                  <span>{selectedAppointment.clientPhone || selectedAppointment.patient_phone || 'Not provided'}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Email Address</span>
                  <span>{selectedAppointment.clientEmail || selectedAppointment.patient_email || 'Not provided'}</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#0f2942', fontWeight: 700 }}>
                Protocol Details
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Service</span>
                  <span style={{ fontWeight: 600, color: '#1e5aa8' }}>
                    {selectedAppointment.serviceName || selectedAppointment.protocol_title}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Amount</span>
                  <span style={{ fontWeight: 700, color: '#15803d' }}>
                    ${selectedAppointment.price ?? selectedAppointment.amount ?? 0}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Clinician</span>
                  <span>{selectedAppointment.providerName || selectedAppointment.clinician_name}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Duration</span>
                  <span>{selectedAppointment.duration || '60 Mins'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Scheduled Date</span>
                  <span style={{ fontWeight: 600 }}>{selectedAppointment.date || selectedAppointment.appointment_date}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Scheduled Time</span>
                  <span>{selectedAppointment.time || selectedAppointment.appointment_time}</span>
                </div>
                {selectedAppointment.stripe_payment_intent_id && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Stripe Transaction ID</span>
                    <span style={{ fontFamily: 'monospace', color: '#15803d', fontWeight: 600 }}>
                      {selectedAppointment.stripe_payment_intent_id}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.84rem', color: '#0f2942', fontWeight: 700 }}>
                Clinical & Sensory Notes
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                {selectedAppointment.notes || 'No special clinical notes entered.'}
              </p>
            </div>
          </div>
        )}
      </AdminDrawer>

      {/* ── 3. Stripe Payment Gateway Modal ── */}
      <StripePaymentModal
        isOpen={Boolean(payNowAppointment)}
        onClose={() => setPayNowAppointment(null)}
        appointment={payNowAppointment}
        onPaymentSuccess={(updated) => {
          // Local update will also be synchronized via AdminDataContext and Supabase
        }}
      />

      {/* ── 4. Delete Confirmation Dialog ── */}
      <AdminConfirmDialog
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Appointment"
        message="Are you sure you want to delete this appointment?"
      />
    </div>
  );
};

export default AppointmentsPage;
