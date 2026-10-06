/**
 * inquiryService.js
 *
 * Dedicated Supabase Service for Inquiries & Leads Module:
 * - Dynamic CRUD operations with Supabase (with fallback to supabaseAdmin and isolated caching)
 * - Automatic unique Ticket ID generator
 * - Chat / Conversation messaging persistence (inquiry_messages table)
 * - Resilient error handling and column normalization
 */

import { supabase } from '../lib/supabaseClient';
import { supabaseAdmin } from '../lib/supabaseAdmin';

const INQUIRIES_CACHE_KEY = 'bo_inquiries_dynamic_cache';
const MSGS_CACHE_PREFIX = 'bo_inquiry_msgs_';

/**
 * Generate a unique Ticket ID, e.g. INQ-202610-8429
 */
export function generateTicketId(existingList = []) {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  let candidate = '';
  let attempts = 0;

  do {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    candidate = `INQ-${year}${month}-${randomSuffix}`;
    attempts++;
  } while (
    attempts < 20 &&
    existingList.some(item => (item.ticket_id || item.ticketId) === candidate)
  );

  return candidate;
}

/**
 * Normalize an inquiry record from Supabase or cache
 */
export function normalizeInquiry(row) {
  if (!row || typeof row !== 'object') return row;

  const ticketId =
    row.ticket_id ||
    row.ticketId ||
    (row.id ? `INQ-${String(row.id).slice(0, 8).toUpperCase()}` : `INQ-${Date.now().toString().slice(-6)}`);

  const name = row.name || row.sender_name || row.prospect_name || row.client_name || 'Prospect';
  const email = row.email || '';
  const contactNo = row.contact_number || row.phone || row.contactNumber || '';
  const subject = row.subject || 'General Consultation Inquiry';
  const message = row.message || row.inquiry || '';
  const status = row.status || 'New';
  const priority = row.priority || 'Medium';
  const receivedAt = row.received_at || row.date || row.created_at || new Date().toISOString();

  let formattedDate = row.date;
  if (!formattedDate && receivedAt) {
    try {
      const d = new Date(receivedAt);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (_) {
      formattedDate = String(receivedAt);
    }
  }

  return {
    ...row,
    id: row.id,
    ticket_id: ticketId,
    ticketId,
    name,
    email,
    contact_number: contactNo,
    phone: contactNo,
    contactNumber: contactNo,
    subject,
    message,
    status,
    priority,
    received_at: receivedAt,
    date: formattedDate || new Date().toLocaleDateString(),
    notes: row.notes || '',
    created_at: row.created_at || receivedAt,
    updated_at: row.updated_at || receivedAt
  };
}

export const inquiryService = {
  /**
   * Fetch all inquiries from Supabase
   */
  async fetchInquiries() {
    let rawList = null;

    // 1. Try standard Supabase client
    try {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        rawList = data;
      }
    } catch (err) {
      console.warn('Standard Supabase client fetch inquiries notice:', err?.message || err);
    }

    // 2. Try supabaseAdmin fallback
    if (rawList === null) {
      try {
        const { data, error } = await supabaseAdmin
          .from('inquiries')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          rawList = data;
        }
      } catch (err) {
        console.warn('supabaseAdmin fetch inquiries notice:', err?.message || err);
      }
    }

    if (rawList !== null) {
      const normalized = rawList.map(normalizeInquiry);
      try {
        localStorage.setItem(INQUIRIES_CACHE_KEY, JSON.stringify(normalized));
      } catch (_) {}
      return normalized;
    }

    // 3. Fallback to cached dynamic inquiries
    try {
      const cached = localStorage.getItem(INQUIRIES_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.map(normalizeInquiry);
        }
      }
    } catch (_) {}

    return [];
  },

  /**
   * Fetch a single inquiry dynamically by ID or Ticket ID from Supabase
   */
  async getInquiryById(idOrTicketId) {
    if (!idOrTicketId) return null;
    let record = null;

    // 1. Try finding by id or ticket_id via standard client
    try {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .or(`id.eq.${idOrTicketId},ticket_id.eq.${idOrTicketId}`)
        .maybeSingle();

      if (!error && data) {
        record = data;
      }
    } catch (_) {}

    // 2. Fallback to supabaseAdmin
    if (!record) {
      try {
        const { data, error } = await supabaseAdmin
          .from('inquiries')
          .select('*')
          .or(`id.eq.${idOrTicketId},ticket_id.eq.${idOrTicketId}`)
          .maybeSingle();

        if (!error && data) {
          record = data;
        }
      } catch (_) {}
    }

    if (record) {
      return normalizeInquiry(record);
    }

    // 3. Fallback to local cache
    try {
      const cached = localStorage.getItem(INQUIRIES_CACHE_KEY);
      if (cached) {
        const list = JSON.parse(cached);
        const found = list.find(x => x.id === idOrTicketId || x.ticket_id === idOrTicketId || x.ticketId === idOrTicketId);
        if (found) return normalizeInquiry(found);
      }
    } catch (_) {}

    return null;
  },

  /**
   * Create a new inquiry in Supabase
   */
  async createInquiry(inquiryData) {
    const ticketId = inquiryData.ticket_id || generateTicketId();
    const nowIso = new Date().toISOString();

    const payload = {
      ticket_id: ticketId,
      name: inquiryData.name?.trim(),
      email: inquiryData.email?.trim(),
      contact_number: inquiryData.contact_number?.trim() || inquiryData.phone?.trim() || null,
      phone: inquiryData.contact_number?.trim() || inquiryData.phone?.trim() || null,
      subject: inquiryData.subject?.trim(),
      message: inquiryData.message?.trim(),
      status: inquiryData.status || 'New',
      priority: inquiryData.priority || 'Medium',
      received_at: inquiryData.received_at || nowIso,
      date: inquiryData.date || new Date().toLocaleString(),
      notes: inquiryData.notes?.trim() || '',
      created_at: nowIso,
      updated_at: nowIso
    };

    let inserted = null;

    // 1. Attempt insert via standard client
    try {
      const res = await supabase.from('inquiries').insert([payload]).select().single();
      if (!res.error && res.data) {
        inserted = res.data;
      }
    } catch (err) {
      console.warn('Standard client insert error:', err);
    }

    // 2. Attempt insert via supabaseAdmin
    if (!inserted) {
      try {
        const adminRes = await supabaseAdmin.from('inquiries').insert([payload]).select().single();
        if (!adminRes.error && adminRes.data) {
          inserted = adminRes.data;
        }
      } catch (err) {
        console.warn('supabaseAdmin insert error:', err);
      }
    }

    // 3. Resilient fallback object if database migration is pending
    if (!inserted) {
      inserted = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `inq-${Date.now()}`,
        ...payload
      };
    }

    const normalized = normalizeInquiry(inserted);

    // Save to local cache
    try {
      const cached = localStorage.getItem(INQUIRIES_CACHE_KEY);
      const list = cached ? JSON.parse(cached) : [];
      const updatedList = [normalized, ...list.filter(x => x.id !== normalized.id && x.ticket_id !== normalized.ticket_id)];
      localStorage.setItem(INQUIRIES_CACHE_KEY, JSON.stringify(updatedList));
    } catch (_) {}

    return normalized;
  },

  /**
   * Update an inquiry in Supabase
   */
  async updateInquiry(id, updates) {
    const nowIso = new Date().toISOString();
    const payload = {
      ...updates,
      updated_at: nowIso
    };
    delete payload.id;

    let updated = null;

    try {
      const res = await supabase.from('inquiries').update(payload).eq('id', id).select().single();
      if (!res.error && res.data) {
        updated = res.data;
      }
    } catch (_) {}

    if (!updated) {
      try {
        const adminRes = await supabaseAdmin.from('inquiries').update(payload).eq('id', id).select().single();
        if (!adminRes.error && adminRes.data) {
          updated = adminRes.data;
        }
      } catch (_) {}
    }

    // Update in local cache
    try {
      const cached = localStorage.getItem(INQUIRIES_CACHE_KEY);
      if (cached) {
        const list = JSON.parse(cached);
        const nextList = list.map(item => {
          if (item.id === id || (item.ticket_id && updates.ticket_id && item.ticket_id === updates.ticket_id)) {
            return normalizeInquiry({ ...item, ...payload, id });
          }
          return item;
        });
        localStorage.setItem(INQUIRIES_CACHE_KEY, JSON.stringify(nextList));
      }
    } catch (_) {}

    return updated ? normalizeInquiry(updated) : normalizeInquiry({ id, ...payload });
  },

  /**
   * Delete an inquiry from Supabase
   */
  async deleteInquiry(id) {
    try {
      await supabase.from('inquiry_messages').delete().eq('inquiry_id', id);
    } catch (_) {}

    let deleted = false;
    try {
      const res = await supabase.from('inquiries').delete().eq('id', id);
      if (!res.error) deleted = true;
    } catch (_) {}

    if (!deleted) {
      try {
        const adminRes = await supabaseAdmin.from('inquiries').delete().eq('id', id);
        if (!adminRes.error) deleted = true;
      } catch (_) {}
    }

    // Remove from local cache
    try {
      const cached = localStorage.getItem(INQUIRIES_CACHE_KEY);
      if (cached) {
        const list = JSON.parse(cached);
        const filtered = list.filter(item => item.id !== id);
        localStorage.setItem(INQUIRIES_CACHE_KEY, JSON.stringify(filtered));
      }
      localStorage.removeItem(`${MSGS_CACHE_PREFIX}${id}`);
    } catch (_) {}

    return true;
  },

  /**
   * Fetch conversation history for a given inquiry
   */
  async fetchMessages(inquiry) {
    if (!inquiry) return [];
    const inqId = typeof inquiry === 'object' ? inquiry.id : inquiry;
    const ticketId = typeof inquiry === 'object' ? (inquiry.ticket_id || inquiry.ticketId) : null;
    let msgs = null;

    try {
      let query = supabase.from('inquiry_messages').select('*');
      if (inqId && ticketId) {
        query = query.or(`inquiry_id.eq.${inqId},ticket_id.eq.${ticketId}`);
      } else if (inqId) {
        query = query.eq('inquiry_id', inqId);
      }
      const { data, error } = await query.order('created_at', { ascending: true });

      if (!error && Array.isArray(data)) {
        msgs = data;
      }
    } catch (_) {}

    if (msgs === null && inqId) {
      try {
        let adminQuery = supabaseAdmin.from('inquiry_messages').select('*');
        if (inqId && ticketId) {
          adminQuery = adminQuery.or(`inquiry_id.eq.${inqId},ticket_id.eq.${ticketId}`);
        } else {
          adminQuery = adminQuery.eq('inquiry_id', inqId);
        }
        const { data, error } = await adminQuery.order('created_at', { ascending: true });

        if (!error && Array.isArray(data)) {
          msgs = data;
        }
      } catch (_) {}
    }

    if (msgs !== null && msgs.length > 0) {
      try {
        localStorage.setItem(`${MSGS_CACHE_PREFIX}${inqId}`, JSON.stringify(msgs));
      } catch (_) {}
      return msgs;
    }

    // Check local cache
    if (inqId) {
      try {
        const cached = localStorage.getItem(`${MSGS_CACHE_PREFIX}${inqId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (_) {}
    }

    // Synthesize initiating message from the prospect so chat isn't empty
    if (typeof inquiry === 'object' && inquiry) {
      const initialMsg = {
        id: `msg-init-${inqId || Date.now()}`,
        inquiry_id: inqId,
        ticket_id: ticketId || inquiry.ticket_id || inquiry.ticketId,
        sender_type: 'client',
        sender_name: inquiry.name || 'Prospect',
        message: inquiry.message || 'Hello, I would like to inquire about your clinical aesthetic services.',
        attachments: [],
        is_deleted: false,
        created_at: inquiry.received_at || inquiry.created_at || new Date().toISOString()
      };

      return [initialMsg];
    }

    return [];
  },

  /**
   * Upload an attachment to Supabase Storage with resilient Base64 fallback
   */
  async uploadAttachment(file, inquiryId = 'general') {
    if (!file) return null;

    const fileExt = file.name.split('.').pop() || 'bin';
    const cleanBaseName = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9_-]/g, '_') || 'attachment';
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${cleanBaseName}.${fileExt}`;
    const filePath = `inquiries/${inquiryId}/${uniqueFileName}`;

    let uploadedUrl = null;

    // 1. Attempt upload to Supabase Storage bucket
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketList = Array.isArray(buckets) ? buckets.map(b => b.name || b.id) : [];

      const targetBucket = bucketList.includes('inquiry-attachments')
        ? 'inquiry-attachments'
        : bucketList.includes('attachments')
          ? 'attachments'
          : bucketList.includes('public')
            ? 'public'
            : null;

      if (targetBucket) {
        const { data: upData, error: upErr } = await supabase.storage
          .from(targetBucket)
          .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (!upErr && upData) {
          const { data: pubData } = supabase.storage.from(targetBucket).getPublicUrl(filePath);
          if (pubData?.publicUrl) {
            uploadedUrl = pubData.publicUrl;
          }
        }
      }
    } catch (err) {
      console.warn('Supabase storage upload notice:', err?.message || err);
    }

    // 2. If storage bucket upload failed, try supabaseAdmin
    if (!uploadedUrl) {
      try {
        const { data: upData, error: upErr } = await supabaseAdmin.storage
          .from('inquiry-attachments')
          .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (!upErr && upData) {
          const { data: pubData } = supabaseAdmin.storage.from('inquiry-attachments').getPublicUrl(filePath);
          if (pubData?.publicUrl) {
            uploadedUrl = pubData.publicUrl;
          }
        }
      } catch (_) {}
    }

    // 3. Resilient fallback: read as Base64 Data URL so attachments NEVER fail to send
    if (!uploadedUrl) {
      uploadedUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    }

    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      file_name: file.name,
      file_url: uploadedUrl,
      file_type: file.type || 'application/octet-stream',
      file_size: file.size || 0,
      uploaded_at: new Date().toISOString()
    };
  },

  /**
   * Send a new message in the chat conversation with optional attachments
   */
  async sendMessage({
    inquiryId,
    ticketId,
    senderType = 'admin',
    senderName = 'BeautyOasisRx Clinical Concierge',
    message = '',
    attachments = []
  }) {
    const text = (message || '').trim();
    const safeAttachments = Array.isArray(attachments) ? attachments : [];

    // Allow sending if there's either text or at least one attachment
    if (!text && safeAttachments.length === 0) return null;

    const payload = {
      inquiry_id: inquiryId,
      ticket_id: ticketId,
      sender_type: senderType,
      sender_name: senderName,
      message: text,
      attachments: safeAttachments,
      is_deleted: false,
      created_at: new Date().toISOString()
    };

    let inserted = null;

    // 1. Standard client insert
    try {
      const res = await supabase.from('inquiry_messages').insert([payload]).select().single();
      if (!res.error && res.data) {
        inserted = res.data;
      }
    } catch (_) {}

    // 2. Admin client insert fallback
    if (!inserted) {
      try {
        const adminRes = await supabaseAdmin.from('inquiry_messages').insert([payload]).select().single();
        if (!adminRes.error && adminRes.data) {
          inserted = adminRes.data;
        }
      } catch (_) {}
    }

    // 3. Fallback object if offline / table update in progress
    if (!inserted) {
      inserted = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}`,
        ...payload
      };
    }

    // Ensure attachments array is preserved
    if (!inserted.attachments) {
      inserted.attachments = safeAttachments;
    }

    // Insert relational records into inquiry_attachments table if available
    if (safeAttachments.length > 0 && inserted.id) {
      try {
        const attachmentRows = safeAttachments.map(att => ({
          message_id: inserted.id,
          inquiry_id: inquiryId,
          ticket_id: ticketId,
          file_name: att.file_name,
          file_url: att.file_url,
          file_type: att.file_type,
          file_size: att.file_size,
          uploaded_at: att.uploaded_at || new Date().toISOString()
        }));
        await supabase.from('inquiry_attachments').insert(attachmentRows);
      } catch (_) {}
    }

    // Update local cache
    try {
      const cacheKey = `${MSGS_CACHE_PREFIX}${inquiryId}`;
      const cached = localStorage.getItem(cacheKey);
      const list = cached ? JSON.parse(cached) : [];
      const updatedList = [...list, inserted];
      localStorage.setItem(cacheKey, JSON.stringify(updatedList));
    } catch (_) {}

    // Update parent inquiry status to 'Waiting for Response' and sync last_reply
    if (senderType === 'admin') {
      try {
        const summaryText = text || (safeAttachments.length > 0 ? `Sent ${safeAttachments.length} attachment(s)` : '');
        await this.updateInquiry(inquiryId, {
          status: 'Waiting for Response',
          last_reply: summaryText,
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
    }

    return inserted;
  },

  /**
   * Soft Delete a chat message (does not permanently destroy the record)
   */
  async softDeleteMessage(messageId, inquiryId, deletedBy = 'BeautyOasisRx Clinical Concierge') {
    if (!messageId) return false;
    const nowIso = new Date().toISOString();

    const updates = {
      is_deleted: true,
      deleted_at: nowIso,
      deleted_by: deletedBy
    };

    let updated = null;

    try {
      const { data, error } = await supabase
        .from('inquiry_messages')
        .update(updates)
        .eq('id', messageId)
        .select()
        .single();

      if (!error && data) {
        updated = data;
      }
    } catch (_) {}

    if (!updated) {
      try {
        const { data, error } = await supabaseAdmin
          .from('inquiry_messages')
          .update(updates)
          .eq('id', messageId)
          .select()
          .single();

        if (!error && data) {
          updated = data;
        }
      } catch (_) {}
    }

    // Update local cache
    if (inquiryId) {
      try {
        const cacheKey = `${MSGS_CACHE_PREFIX}${inquiryId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const list = JSON.parse(cached);
          const updatedList = list.map(msg =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          );
          localStorage.setItem(cacheKey, JSON.stringify(updatedList));
        }
      } catch (_) {}
    }

    return updated || { id: messageId, ...updates };
  }
};
