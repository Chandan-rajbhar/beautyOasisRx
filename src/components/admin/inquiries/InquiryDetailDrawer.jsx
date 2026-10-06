import React, { useState, useEffect } from 'react';
import { Mail, Phone, MessageSquare, Edit2, Calendar, Hash, Tag, FileText, CheckCircle2, MessageCircle } from 'lucide-react';
import { AdminDrawer } from '../ui/AdminDrawer';
import { AdminButton } from '../ui/AdminButton';
import { AdminBadge } from '../ui/AdminBadge';
import { inquiryService } from '../../../services/inquiryService';
import { supabase } from '../../../lib/supabaseClient';

export const InquiryDetailDrawer = ({
  isOpen,
  onClose,
  inquiry,
  onOpenChat,
  onEdit
}) => {
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (isOpen && inquiry?.id) {
      let isMounted = true;
      setLoadingMessages(true);
      inquiryService.fetchMessages(inquiry)
        .then((msgs) => {
          if (isMounted) setMessages(msgs || []);
        })
        .catch(() => {
          if (isMounted) setMessages([]);
        })
        .finally(() => {
          if (isMounted) setLoadingMessages(false);
        });

      // Real-time listener for conversation updates in details drawer
      const inqId = inquiry.id;
      const channelName = `detail_msgs_${inqId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'inquiry_messages',
            filter: `inquiry_id=eq.${inqId}`
          },
          () => {
            inquiryService.fetchMessages(inquiry).then((msgs) => {
              if (isMounted) setMessages(msgs || []);
            });
          }
        )
        .subscribe();

      return () => {
        isMounted = false;
        try {
          supabase.removeChannel(channel);
        } catch (_) {}
      };
    } else {
      setMessages([]);
    }
  }, [isOpen, inquiry?.id, inquiry]);

  if (!inquiry) return null;

  const ticketId = inquiry.ticket_id || inquiry.ticketId || (inquiry.id ? `INQ-${String(inquiry.id).slice(0, 8).toUpperCase()}` : 'INQ-N/A');

  return (
    <AdminDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Inquiry Details"
      subtitle={`Ticket #${ticketId} — ${inquiry.name}`}
      width="560px"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', width: '100%' }}>
          <AdminButton
            variant="secondary"
            onClick={() => {
              onClose();
              if (onEdit) onEdit(inquiry);
            }}
            icon={<Edit2 size={14} />}
          >
            Edit
          </AdminButton>
          <AdminButton
            variant="primary"
            onClick={() => {
              onClose();
              if (onOpenChat) onOpenChat(inquiry);
            }}
            icon={<MessageSquare size={14} />}
          >
            Reply / Chat
          </AdminButton>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Top Status & Ticket Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 18px',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
              Ticket Identifier
            </span>
            <div style={{ marginTop: '4px', fontFamily: 'monospace', fontSize: '0.98rem', fontWeight: 700, color: '#1e5aa8' }}>
              #{ticketId}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block', textAlign: 'right' }}>
              Current Status
            </span>
            <div style={{ marginTop: '4px' }}>
              <AdminBadge status={inquiry.status || 'New'} />
            </div>
          </div>
        </div>

        {/* Priority & Received Date Info Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
            <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Tag size={13} color="#1e5aa8" />
              Priority Level
            </span>
            <div style={{ marginTop: '8px' }}>
              <AdminBadge status={inquiry.priority || 'Medium'} />
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
            <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Calendar size={13} color="#1e5aa8" />
              Received Date
            </span>
            <div style={{ marginTop: '8px', fontSize: '0.86rem', fontWeight: 600, color: '#0f2942' }}>
              {inquiry.date || (inquiry.received_at ? new Date(inquiry.received_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently')}
            </div>
          </div>
        </div>

        {/* Prospect Contact Card */}
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '0.88rem', color: '#0f2942', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Prospect Contact Information
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '0.84rem' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', fontWeight: 500 }}>Full Name</span>
              <span style={{ fontWeight: 600, color: '#0f2942' }}>{inquiry.name}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', fontWeight: 500 }}>Contact Number</span>
              <span style={{ color: '#334155', fontWeight: 500 }}>
                {inquiry.contact_number || inquiry.phone || 'None provided'}
              </span>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', fontWeight: 500 }}>Email Address</span>
              <a
                href={`mailto:${inquiry.email}`}
                style={{ color: '#1e5aa8', fontWeight: 600, textDecoration: 'none' }}
              >
                {inquiry.email}
              </a>
            </div>
          </div>
        </div>

        {/* Inquiry Subject & Message */}
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
          <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
            Subject
          </div>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.96rem', color: '#0f2942', fontWeight: 700 }}>
            {inquiry.subject}
          </h4>
          <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
            Inquiry Message
          </div>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {inquiry.message}
          </p>
        </div>

        {/* Internal Clinical Staff Notes */}
        {inquiry.notes && (
          <div style={{ background: '#fffbeb', borderRadius: '12px', border: '1px solid #fef3c7', padding: '16px' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.84rem', color: '#b45309', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} />
              Internal Clinical Staff Notes
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#78350f', whiteSpace: 'pre-wrap' }}>
              {inquiry.notes}
            </p>
          </div>
        )}

        {/* Existing Chat / Reply Information */}
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '0.86rem', color: '#0f2942', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={14} color="#1e5aa8" />
              Conversation & Reply History ({messages.length})
            </h4>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenChat) onOpenChat(inquiry);
              }}
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#1e5aa8',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0
              }}
            >
              Open Full Chat →
            </button>
          </div>

          {loadingMessages ? (
            <div style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
              Loading conversation history...
            </div>
          ) : messages.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
              {messages.map((msg) => {
                const isAdmin = msg.sender_role === 'admin' || msg.sender_type === 'admin' || msg.is_staff;
                const isDeleted = Boolean(msg.is_deleted);
                const hasAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0;

                return (
                  <div
                    key={msg.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: isDeleted ? '#f1f5f9' : isAdmin ? '#eff6ff' : '#f8fafc',
                      border: `1px solid ${isDeleted ? '#cbd5e1' : isAdmin ? '#bfdbfe' : '#e2e8f0'}`,
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: isDeleted ? '#64748b' : isAdmin ? '#1e5aa8' : '#0f2942', fontSize: '0.76rem' }}>
                        {isAdmin ? 'BeautyOasis Staff Response' : (inquiry.name || 'Prospect')}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        {new Date(msg.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {isDeleted ? (
                      <p style={{ margin: 0, color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>
                        This message was deleted
                      </p>
                    ) : (
                      <>
                        {msg.message && (
                          <p style={{ margin: 0, color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {msg.message}
                          </p>
                        )}
                        {hasAttachments && (
                          <div style={{ marginTop: '6px', fontSize: '0.74rem', color: '#1e5aa8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>📎 {msg.attachments.length} attachment(s)</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : inquiry.last_reply ? (
            <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                Latest Clinical Response
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                {inquiry.last_reply}
              </p>
            </div>
          ) : (
            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
              No messages logged yet.{' '}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenChat) onOpenChat(inquiry);
                }}
                style={{ color: '#1e5aa8', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Start conversation
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminDrawer>
  );
};
