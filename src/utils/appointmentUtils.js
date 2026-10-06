/**
 * Shared Appointment Utilities
 * Single source of truth for appointment date parsing and upcoming/recent filters.
 * Consumed by Appointments module, Admin Dashboard, and AdminDataContext.
 */

/**
 * Robust date parser for appointments across Supabase formats and schema variations.
 * Supports:
 * - Date instances
 * - ISO strings (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)
 * - Slash formats (MM/DD/YYYY, DD/MM/YYYY, with or without time)
 * - Standard string dates
 *
 * @param {Object|string|Date} aptOrDate - Appointment object or date value
 * @returns {Date|null}
 */
export function getAppointmentDateObj(aptOrDate) {
  if (!aptOrDate) return null;

  let raw = aptOrDate;
  if (typeof aptOrDate === 'object' && !(aptOrDate instanceof Date)) {
    raw = aptOrDate.appointment_date || aptOrDate.date || aptOrDate.created_at;
  }

  if (!raw) return null;

  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw;
  }

  const str = String(raw).trim();

  // Handle ISO date YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day);
  }

  // Handle MM/DD/YYYY or DD/MM/YYYY (with optional time)
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);
    const month = (p1 > 12 ? p2 : p1) - 1;
    const day = p1 > 12 ? p1 : p2;
    return new Date(year, month, day);
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

/**
 * Checks if an appointment is upcoming according to the single unified business rule:
 * - Not cancelled
 * - Not completed
 * - Appointment date >= start of today (local time)
 * - Active statuses with unparseable date default to upcoming
 *
 * @param {Object} apt - Appointment record
 * @returns {boolean}
 */
export function isAppointmentUpcoming(apt) {
  if (!apt) return false;

  const status = String(apt.status || '').toLowerCase().trim();
  if (status === 'cancelled' || status === 'completed') {
    return false;
  }

  const aptDate = getAppointmentDateObj(apt);
  if (!aptDate) {
    // If no parseable date, active statuses are upcoming
    return true;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const checkDate = new Date(aptDate);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate >= todayStart;
}

/**
 * Checks if an appointment is recent / past (completed or scheduled before today).
 *
 * @param {Object} apt - Appointment record
 * @returns {boolean}
 */
export function isAppointmentRecent(apt) {
  if (!apt) return false;

  const status = String(apt.status || '').toLowerCase().trim();
  if (status === 'completed') return true;

  const aptDate = getAppointmentDateObj(apt);
  if (!aptDate) return false;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const checkDate = new Date(aptDate);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate < todayStart;
}

/**
 * Checks if an appointment is scheduled for today.
 *
 * @param {Object} apt - Appointment record
 * @returns {boolean}
 */
export function isAppointmentToday(apt) {
  if (!apt) return false;

  const localToday = new Date().toLocaleDateString('en-CA');
  const utcToday = new Date().toISOString().split('T')[0];
  const raw = String(apt.appointment_date || apt.date || '').trim();

  if (raw === localToday || raw === utcToday || raw.startsWith(localToday) || raw.startsWith(utcToday)) {
    return true;
  }

  const aptDate = getAppointmentDateObj(apt);
  if (!aptDate) return false;

  const today = new Date();
  return (
    aptDate.getFullYear() === today.getFullYear() &&
    aptDate.getMonth() === today.getMonth() &&
    aptDate.getDate() === today.getDate()
  );
}

/**
 * Checks if an appointment is within the current week (+/- 7 days).
 *
 * @param {Object} apt - Appointment record
 * @returns {boolean}
 */
export function isAppointmentThisWeek(apt) {
  if (!apt) return false;
  const aptDate = getAppointmentDateObj(apt);
  if (!aptDate) return false;
  const now = new Date();
  const diffDays = (aptDate - now) / (1000 * 60 * 60 * 24);
  return diffDays >= -7 && diffDays <= 7;
}

/**
 * Checks if an appointment is within the current month.
 *
 * @param {Object} apt - Appointment record
 * @returns {boolean}
 */
export function isAppointmentThisMonth(apt) {
  if (!apt) return false;
  const aptDate = getAppointmentDateObj(apt);
  if (!aptDate) return false;
  const now = new Date();
  return aptDate.getFullYear() === now.getFullYear() && aptDate.getMonth() === now.getMonth();
}

/**
 * Filter an array of appointments to only those that are upcoming.
 *
 * @param {Array} appointments
 * @returns {Array}
 */
export function getUpcomingAppointments(appointments) {
  if (!Array.isArray(appointments)) return [];
  return appointments.filter(isAppointmentUpcoming);
}

/**
 * Get count of upcoming appointments.
 *
 * @param {Array} appointments
 * @returns {number}
 */
export function getUpcomingAppointmentsCount(appointments) {
  return getUpcomingAppointments(appointments).length;
}
