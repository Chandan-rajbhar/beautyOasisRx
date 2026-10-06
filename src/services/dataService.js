import { treatmentsData } from '../data/treatmentsData';
import { productsData } from '../data/productsData';
import { testimonialsData } from '../data/testimonialsData';

const STORAGE_KEY_PREFIX = 'beautyoasis_admin_';

// Initial Mock Providers (Empty: strictly dynamic clinicians from Supabase)
const initialProviders = [];

// Initial Mock Clients / Patients (Empty: strictly dynamic patients from Supabase)
const initialClients = [];

// Initial Mock Appointments
const initialAppointments = [
  {
    id: "apt-101",
    clientId: "cli-1",
    clientName: "Lady Charlotte Montagu",
    clientEmail: "charlotte.montagu@luxurymail.com",
    clientPhone: "(214) 842-1983",
    serviceId: "rf-microneedling",
    serviceName: "Dermal Volumising & RF Needling",
    providerId: "prov-1",
    providerName: "Dr. Alistair Vance, MD",
    date: "2026-09-25",
    time: "10:00 AM",
    duration: "75 Mins",
    price: 360,
    type: "In-Clinic Protocol",
    status: "Confirmed",
    paymentStatus: "Paid",
    room: "Suite 1 - Gold Treatment Room",
    notes: "Fourth follow-up session. Client reported great collagen firmness.",
    createdDate: "2026-09-20"
  },
  {
    id: "apt-102",
    clientId: "cli-2",
    clientName: "Dr. Sarah Jenkins",
    clientEmail: "s.jenkins@dallashealth.org",
    clientPhone: "(214) 719-2044",
    serviceId: "hydrafacial-deluxe",
    serviceName: "Hydrafacial Deluxe Pro",
    providerId: "prov-3",
    providerName: "Elena Rostova, LE",
    date: "2026-09-25",
    time: "11:30 AM",
    duration: "60 Mins",
    price: 185,
    type: "Inclusive Sensory Suite",
    status: "Pending",
    paymentStatus: "Pending",
    room: "Sensory Suite A",
    notes: "Sensory-friendly lighting and silent acoustics requested.",
    createdDate: "2026-09-24"
  },
  {
    id: "apt-103",
    clientId: "cli-3",
    clientName: "Marcus Vance",
    clientEmail: "marcus.vance@techapex.io",
    clientPhone: "(972) 340-9182",
    serviceId: "laser-genesis",
    serviceName: "Laser Genesis & Clarifying Tone",
    providerId: "prov-4",
    providerName: "Marcus Thorne, CLT",
    date: "2026-09-25",
    time: "02:00 PM",
    duration: "45 Mins",
    price: 240,
    type: "Laser Suite",
    status: "Confirmed",
    paymentStatus: "Paid",
    room: "Suite 3 - Laser Center",
    notes: "Session 4 of 4 for facial vascular calibration.",
    createdDate: "2026-09-18"
  },
  {
    id: "apt-104",
    clientId: "cli-5",
    clientName: "Evelyn Reed",
    clientEmail: "evelyn.reed@txholdings.com",
    clientPhone: "(972) 802-5531",
    serviceId: "polynucleotides-boosters",
    serviceName: "Polynucleotide Biostimulation",
    providerId: "prov-1",
    providerName: "Dr. Alistair Vance, MD",
    date: "2026-09-25",
    time: "03:30 PM",
    duration: "45 Mins",
    price: 450,
    type: "Medical Injectable",
    status: "Confirmed",
    paymentStatus: "Paid",
    room: "Suite 1 - Gold Treatment Room",
    notes: "Under-eye hollow biostimulator booster.",
    createdDate: "2026-09-21"
  },
  {
    id: "apt-105",
    clientId: "cli-4",
    clientName: "Camille Dupont",
    clientEmail: "camille.dupont@artisanparis.com",
    clientPhone: "(214) 630-4491",
    serviceId: "hydrafacial-deluxe",
    serviceName: "Hydrafacial Deluxe Pro",
    providerId: "prov-2",
    providerName: "Sarah Lin, NP-C",
    date: "2026-09-26",
    time: "10:30 AM",
    duration: "60 Mins",
    price: 185,
    type: "In-Clinic Protocol",
    status: "Confirmed",
    paymentStatus: "Paid",
    room: "Suite 2 - Aesthetic Lounge",
    notes: "Standard protocol with antioxidant boost.",
    createdDate: "2026-09-22"
  },
  {
    id: "apt-106",
    clientId: "cli-6",
    clientName: "Julian Rivera",
    clientEmail: "j.rivera@solardynamics.net",
    clientPhone: "(214) 991-3810",
    serviceId: "rf-microneedling",
    serviceName: "Dermal Volumising & RF Needling",
    providerId: "prov-1",
    providerName: "Dr. Alistair Vance, MD",
    date: "2026-09-27",
    time: "01:00 PM",
    duration: "75 Mins",
    price: 360,
    type: "Clinical Consultation & Treatment",
    status: "Pending",
    paymentStatus: "Pending",
    room: "Suite 1 - Gold Treatment Room",
    notes: "First time receiving RF microneedling.",
    createdDate: "2026-09-24"
  },
  {
    id: "apt-107",
    clientId: "cli-1",
    clientName: "Lady Charlotte Montagu",
    clientEmail: "charlotte.montagu@luxurymail.com",
    clientPhone: "(214) 842-1983",
    serviceId: "polynucleotides-boosters",
    serviceName: "Polynucleotide Biostimulation",
    providerId: "prov-2",
    providerName: "Sarah Lin, NP-C",
    date: "2026-09-18",
    time: "11:00 AM",
    duration: "45 Mins",
    price: 450,
    type: "Medical Injectable",
    status: "Completed",
    paymentStatus: "Paid",
    room: "Suite 2",
    notes: "Procedure completed smoothly without bruising.",
    createdDate: "2026-09-10"
  },
  {
    id: "apt-108",
    clientId: "cli-3",
    clientName: "Marcus Vance",
    clientEmail: "marcus.vance@techapex.io",
    clientPhone: "(972) 340-9182",
    serviceId: "hydrafacial-deluxe",
    serviceName: "Hydrafacial Deluxe Pro",
    providerId: "prov-3",
    providerName: "Elena Rostova, LE",
    date: "2026-09-12",
    time: "03:00 PM",
    duration: "60 Mins",
    price: 185,
    type: "In-Clinic Protocol",
    status: "Completed",
    paymentStatus: "Paid",
    room: "Suite 3",
    notes: "Completed with LED phototherapy booster.",
    createdDate: "2026-09-05"
  },
  {
    id: "apt-109",
    clientId: "cli-2",
    clientName: "Dr. Sarah Jenkins",
    clientEmail: "s.jenkins@dallashealth.org",
    clientPhone: "(214) 719-2044",
    serviceId: "rf-microneedling",
    serviceName: "Dermal Volumising & RF Needling",
    providerId: "prov-1",
    providerName: "Dr. Alistair Vance, MD",
    date: "2026-09-08",
    time: "02:30 PM",
    duration: "75 Mins",
    price: 360,
    type: "In-Clinic Protocol",
    status: "Cancelled",
    paymentStatus: "Refunded",
    room: "Suite 1",
    notes: "Client rescheduled due to emergency hospital shift.",
    createdDate: "2026-09-01"
  }
];

// Initial Mock Orders
const initialOrders = [
  {
    id: "ORD-9401",
    clientId: "cli-1",
    clientName: "Lady Charlotte Montagu",
    clientEmail: "charlotte.montagu@luxurymail.com",
    items: [
      { id: "prod-creme-bio-ferment", name: "Cellular Restorative Bio-Ferment Crème", qty: 2, price: 145 },
      { id: "prod-hyaluronic-gold-serum", name: "Aeterna Hyaluronic Gold Radiance Serum", qty: 1, price: 135 }
    ],
    totalAmount: 425,
    paymentStatus: "Paid",
    orderStatus: "Completed",
    shippingAddress: "742 Watters Creek Dr, Allen, TX 75013",
    date: "2026-09-24",
    trackingNumber: "FEDEX-8829104",
    paymentMethod: "Apple Pay"
  },
  {
    id: "ORD-9402",
    clientId: "cli-4",
    clientName: "Camille Dupont",
    clientEmail: "camille.dupont@artisanparis.com",
    items: [
      { id: "prod-bha-clarifying-tonic", name: "Clarifying BHA Triple Acid Botanical Tonic", qty: 1, price: 72 },
      { id: "prod-hyaluronic-gold-serum", name: "Aeterna Hyaluronic Gold Radiance Serum", qty: 1, price: 135 }
    ],
    totalAmount: 207,
    paymentStatus: "Paid",
    orderStatus: "Processing",
    shippingAddress: "410 Main St, McKinney, TX 75069",
    date: "2026-09-25",
    trackingNumber: "USPS-9400109",
    paymentMethod: "Credit Card (Visa ending 4291)"
  },
  {
    id: "ORD-9403",
    clientId: "cli-3",
    clientName: "Marcus Vance",
    clientEmail: "marcus.vance@techapex.io",
    items: [
      { id: "prod-creme-bio-ferment", name: "Cellular Restorative Bio-Ferment Crème", qty: 1, price: 145 }
    ],
    totalAmount: 145,
    paymentStatus: "Paid",
    orderStatus: "Completed",
    shippingAddress: "880 McDermott Pkwy, Allen, TX 75013",
    date: "2026-09-22",
    trackingNumber: "UPS-1Z99201",
    paymentMethod: "Credit Card (Mastercard ending 8011)"
  },
  {
    id: "ORD-9404",
    clientId: "cli-6",
    clientName: "Julian Rivera",
    clientEmail: "j.rivera@solardynamics.net",
    items: [
      { id: "prod-bha-clarifying-tonic", name: "Clarifying BHA Triple Acid Botanical Tonic", qty: 2, price: 72 }
    ],
    totalAmount: 144,
    paymentStatus: "Pending",
    orderStatus: "Pending",
    shippingAddress: "501 Heritage Dr, Allen, TX 75002",
    date: "2026-09-25",
    trackingNumber: null,
    paymentMethod: "HSA / FSA Card"
  }
];

// Initial Mock Payments
const initialPayments = [
  {
    id: "PAY-801",
    transactionId: "TXN-991823-AO",
    clientId: "cli-1",
    clientName: "Lady Charlotte Montagu",
    type: "Treatment Appointment",
    referenceId: "apt-101",
    amount: 360,
    paymentMethod: "Apple Pay",
    status: "Paid",
    date: "2026-09-25 09:45 AM"
  },
  {
    id: "PAY-802",
    transactionId: "TXN-991824-BO",
    clientId: "cli-4",
    clientName: "Camille Dupont",
    type: "Apothecary Order",
    referenceId: "ORD-9402",
    amount: 207,
    paymentMethod: "Visa •••• 4291",
    status: "Paid",
    date: "2026-09-25 08:30 AM"
  },
  {
    id: "PAY-803",
    transactionId: "TXN-991819-CO",
    clientId: "cli-5",
    clientName: "Evelyn Reed",
    type: "Treatment Appointment",
    referenceId: "apt-104",
    amount: 450,
    paymentMethod: "Amex •••• 1004",
    status: "Paid",
    date: "2026-09-24 04:15 PM"
  },
  {
    id: "PAY-804",
    transactionId: "TXN-991810-DO",
    clientId: "cli-1",
    clientName: "Lady Charlotte Montagu",
    type: "Apothecary Order",
    referenceId: "ORD-9401",
    amount: 425,
    paymentMethod: "Apple Pay",
    status: "Paid",
    date: "2026-09-24 11:20 AM"
  },
  {
    id: "PAY-805",
    transactionId: "TXN-991790-EO",
    clientId: "cli-2",
    clientName: "Dr. Sarah Jenkins",
    type: "Refunded Treatment",
    referenceId: "apt-109",
    amount: 360,
    paymentMethod: "Visa •••• 9812",
    status: "Refunded",
    date: "2026-09-08 03:00 PM"
  },
  {
    id: "PAY-806",
    transactionId: "TXN-991830-FO",
    clientId: "cli-6",
    clientName: "Julian Rivera",
    type: "Apothecary Order",
    referenceId: "ORD-9404",
    amount: 144,
    paymentMethod: "HSA / FSA",
    status: "Pending",
    date: "2026-09-25 10:10 AM"
  }
];

// Initial Inquiries / Leads from public website (Dynamic via Supabase)
const initialInquiries = [];

// Initial Notifications (strictly dynamic from Supabase)
const initialNotifications = [];

// Initial Admin Users
const initialUsers = [
  {
    id: "usr-1",
    name: "Dr. Alistair Vance",
    email: "admin@beautyoasisrx.com",
    role: "Super Admin",
    status: "Active",
    phone: "(214) 555-0192",
    createdDate: "2025-01-01",
    lastLogin: "2026-09-25 09:30 AM",
    avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80"
  },
  {
    id: "usr-2",
    name: "Brianna Miller",
    email: "manager@beautyoasisrx.com",
    role: "Admin",
    status: "Active",
    phone: "(214) 555-0180",
    createdDate: "2025-03-15",
    lastLogin: "2026-09-25 08:45 AM",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80"
  },
  {
    id: "usr-3",
    name: "Elena Rostova",
    email: "staff@beautyoasisrx.com",
    role: "Staff",
    status: "Active",
    phone: "(214) 555-0198",
    createdDate: "2025-06-20",
    lastLogin: "2026-09-24 05:15 PM",
    avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80"
  }
];

// Initial Website Content
const initialWebsiteContent = {
  homepage: {
    heroTitle: "Clinical Aesthetics. Bespoke Wellness.",
    heroTagline: "Doctor-Led Medical Spa & Sensory-Inclusive Suites in Allen, Texas",
    heroDescription: "Experience restorative medical aesthetics where cutting-edge epigenetic science meets sensory tranquil luxury. Custom protocols designed for natural elegance and cellular renewal.",
    ctaPrimaryText: "Book Bespoke Consultation",
    ctaSecondaryText: "Explore Protocols",
    featuredBadge: "VOTED #1 CLINICAL AESTHETICS IN ALLEN, TX"
  },
  about: {
    title: "Bespoke Clinical Excellence Founded on Science",
    subtitle: "A Higher Paradigm in Medical Skincare & Sensory Wellness",
    description: "BeautyOasisRx was founded with a singular vision: to liberate medical aesthetics from generic, rushed protocols. Every face is an individual anatomy; every skin cellular matrix tells a distinct story.",
    stats: [
      { label: "Verified Patients", value: "18,000+" },
      { label: "Five-Star Rating", value: "4.98 / 5.0" },
      { label: "Medical Specialists", value: "12 Clinicians" }
    ]
  },
  contact: {
    clinicName: "BeautyOasisRx — Clinical Aesthetics & Bespoke Wellness",
    address: "975 Watters Creek Blvd, Suite 240, Allen, TX 75013",
    phone: "(214) 555-0190",
    email: "concierge@beautyoasisrx.com",
    hours: "Monday – Friday: 9am – 7pm | Saturday: 9am – 5pm | Sunday: Closed",
    instagram: "@beautyoasisrx",
    facebook: "facebook.com/beautyoasisrx"
  },
  testimonials: testimonialsData.map(t => ({ ...t, active: true }))
};

// Initial Business Settings
const initialSettings = {
  clinicName: "BeautyOasisRx — Clinical Aesthetics & Bespoke Wellness",
  location: "Allen, Texas",
  timezone: "Central Time (US & Canada) - CT",
  currency: "USD ($)",
  taxRate: 8.25,
  depositRequired: true,
  depositAmount: 50,
  cancellationWindowHours: 24,
  autoConfirmAppointments: false,
  emailNotificationsEnabled: true,
  smsNotificationsEnabled: true,
  allowOnlineReschedule: true,
  firebaseConfig: {
    apiKey: "",
    authDomain: "",
    projectId: "beautyoasisrx-clinical",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  }
};

// Transform treatmentsData to have proper active flags & IDs for admin editing
const initialServices = treatmentsData.map((t, idx) => ({
  ...t,
  id: t.id || `srv-${idx + 1}`,
  status: "Active",
  displayOrder: idx + 1,
  numericPrice: parseInt(t.price.replace(/[^0-9]/g, ''), 10) || 150
}));

// Transform productsData
const initialProducts = productsData.map((p, idx) => ({
  ...p,
  id: p.id || `prod-${idx + 1}`,
  sku: `BO-${1000 + idx}`,
  stock: 24 - idx * 3 > 0 ? 24 - idx * 3 : 15,
  status: "In Stock"
}));

// Initialize LocalStorage Data Store
class AdminDataService {
  constructor() {
    this.listeners = new Map();
    this.initStore();
  }

  initStore() {
    if (!localStorage.getItem(`${STORAGE_KEY_PREFIX}services`)) {
      this.setLocal('services', initialServices);
    }
    if (!localStorage.getItem(`${STORAGE_KEY_PREFIX}products`)) {
      this.setLocal('products', initialProducts);
    }
    if (!localStorage.getItem(`${STORAGE_KEY_PREFIX}clients`)) {
      this.setLocal('clients', initialClients);
    }
    if (!localStorage.getItem(`${STORAGE_KEY_PREFIX}appointments`)) {
      this.setLocal('appointments', initialAppointments);
    }
    if (!localStorage.getItem(`${STORAGE_KEY_PREFIX}orders`)) {
      this.setLocal('orders', initialOrders);
    }
    if (!localStorage.getItem(`${STORAGE_KEY_PREFIX}payments`)) {
      this.setLocal('payments', initialPayments);
    }
    if (!localStorage.getItem(`${STORAGE_KEY_PREFIX}providers`)) {
      this.setLocal('providers', initialProviders);
    }
    if (!localStorage.getItem(`${STORAGE_KEY_PREFIX}inquiries`)) {
      this.setLocal('inquiries', initialInquiries);
    }
    if (!localStorage.getItem(`${STORAGE_KEY_PREFIX}notifications`)) {
      this.setLocal('notifications', initialNotifications);
    }
    if (!localStorage.getItem(`${STORAGE_KEY_PREFIX}users`)) {
      this.setLocal('users', initialUsers);
    }
    if (!localStorage.getItem(`${STORAGE_KEY_PREFIX}website_content`)) {
      this.setLocal('website_content', initialWebsiteContent);
    }
    if (!localStorage.getItem(`${STORAGE_KEY_PREFIX}settings`)) {
      this.setLocal('settings', initialSettings);
    }
  }

  getLocal(key, fallback = []) {
    try {
      const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
      return data ? JSON.parse(data) : fallback;
    } catch (err) {
      console.error(`Error reading ${key} from storage:`, err);
      return fallback;
    }
  }

  setLocal(key, value) {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${key}`, JSON.stringify(value));
      this.notify(key, value);
    } catch (err) {
      console.error(`Error writing ${key} to storage:`, err);
    }
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  notify(key, data) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(cb => cb(data));
    }
  }

  // Generic CRUD
  getAll(collection) {
    return this.getLocal(collection, []);
  }

  getById(collection, id) {
    const list = this.getAll(collection);
    return list.find(item => String(item.id) === String(id)) || null;
  }

  create(collection, data) {
    const list = this.getAll(collection);
    const newItem = {
      ...data,
      id: data.id || `${collection.slice(0, 3)}-${Date.now()}`,
      createdDate: new Date().toISOString().split('T')[0]
    };
    const updated = [newItem, ...list];
    this.setLocal(collection, updated);

    // Auto-create notification for relevant actions
    if (collection === 'appointments') {
      this.createNotification({
        title: "New Appointment Created",
        message: `${newItem.clientName} booked ${newItem.serviceName || 'treatment'} on ${newItem.date}.`,
        type: "appointment",
        link: "/appointments"
      });
    } else if (collection === 'clients') {
      this.createNotification({
        title: "New Client Added",
        message: `${newItem.name} registered into clinical records.`,
        type: "client",
        link: "/clients"
      });
    } else if (collection === 'orders') {
      this.createNotification({
        title: "New Order Created",
        message: `Order #${newItem.id} for ${newItem.clientName} ($${newItem.totalAmount}).`,
        type: "order",
        link: "/orders"
      });
    }

    return newItem;
  }

  update(collection, id, updates) {
    const list = this.getAll(collection);
    const index = list.findIndex(item => String(item.id) === String(id));
    if (index === -1) return null;
    const updatedItem = { ...list[index], ...updates, updatedDate: new Date().toISOString().split('T')[0] };
    list[index] = updatedItem;
    this.setLocal(collection, [...list]);
    return updatedItem;
  }

  delete(collection, id) {
    const list = this.getAll(collection);
    const updated = list.filter(item => String(item.id) !== String(id));
    this.setLocal(collection, updated);
    return true;
  }

  // Notifications Helper
  createNotification(notif) {
    const list = this.getAll('notifications');
    const newNotif = {
      id: `notif-${Date.now()}`,
      read: false,
      timestamp: "Just now",
      ...notif
    };
    this.setLocal('notifications', [newNotif, ...list]);
    return newNotif;
  }

  markNotificationRead(id) {
    const list = this.getAll('notifications');
    const updated = list.map(n => n.id === id ? { ...n, read: true } : n);
    this.setLocal('notifications', updated);
  }

  markAllNotificationsRead() {
    const list = this.getAll('notifications');
    const updated = list.map(n => ({ ...n, read: true }));
    this.setLocal('notifications', updated);
  }

  // Reset to Factory Default Data
  resetAllData() {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}services`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}products`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}clients`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}appointments`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}orders`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}payments`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}providers`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}inquiries`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}notifications`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}users`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}website_content`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}settings`);
    this.initStore();
  }
}

export const dataService = new AdminDataService();
