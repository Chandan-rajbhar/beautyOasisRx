import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  RefreshCw,
  User,
  ShieldCheck,
  Clock,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Paperclip,
  X,
  FileText,
  File,
  Image as ImageIcon,
  Download,
  Trash2,
  AlertCircle,
  ExternalLink,
  Maximize2,
  Ban
} from 'lucide-react';
import { AdminDrawer } from '../ui/AdminDrawer';
import { AdminButton } from '../ui/AdminButton';
import { AdminBadge } from '../ui/AdminBadge';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';
import { inquiryService } from '../../../services/inquiryService';
import { supabase } from '../../../lib/supabaseClient';
import toast from 'react-hot-toast';

// Helper to format file size in human-readable units
const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i] || 'MB'}`;
};

// Helper to check if file is an image
const isImageAttachment = (fileType = '', fileName = '') => {
  if (fileType && fileType.startsWith('image/')) return true;
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext);
};

// Helper to check if file is a PDF
const isPdfAttachment = (fileType = '', fileName = '') => {
  if (fileType === 'application/pdf') return true;
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  return ext === 'pdf';
};

export const InquiryChatDrawer = ({
  isOpen,
  onClose,
  inquiry,
  onMessageSent
}) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // File attachments state for queue before sending
  const [queuedFiles, setQueuedFiles] = useState([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  // Soft delete dialog state
  const [deletingMsgId, setDeletingMsgId] = useState(null);
  const [isDeletingMsg, setIsDeletingMsg] = useState(false);

  // Lightbox preview for full image view
  const [lightboxImage, setLightboxImage] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const ticketId = inquiry?.ticket_id || inquiry?.ticketId || (inquiry?.id ? `INQ-${String(inquiry.id).slice(0, 8).toUpperCase()}` : 'INQ-N/A');

  // Load conversation messages whenever drawer opens or inquiry changes
  useEffect(() => {
    let isMounted = true;
    if (isOpen && inquiry) {
      setLoading(true);
      inquiryService.fetchMessages(inquiry).then(msgs => {
        if (isMounted) {
          setMessages(msgs || []);
          setLoading(false);
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            inputRef.current?.focus();
          }, 100);
        }
      }).catch(err => {
        console.error('Failed to load chat messages:', err);
        if (isMounted) setLoading(false);
      });

      // Real-time listener for live incoming messages or status updates
      const inqId = inquiry.id;
      const channelName = `chat_rt_${inqId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setMessages(prev => {
                if (prev.some(m => m.id === payload.new.id)) return prev;
                return [...prev, payload.new];
              });
            } else if (payload.eventType === 'UPDATE') {
              setMessages(prev =>
                prev.map(m => (m.id === payload.new.id ? payload.new : m))
              );
            } else if (payload.eventType === 'DELETE') {
              setMessages(prev => prev.filter(m => m.id !== payload.old.id));
            }
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
      setInputText('');
      setQueuedFiles([]);
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, inquiry]);

  // Scroll to bottom on messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle file selection from file input
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newQueued = files.map(file => ({
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: isImageAttachment(file.type, file.name) ? URL.createObjectURL(file) : null
    }));

    setQueuedFiles(prev => [...prev, ...newQueued]);

    // Reset input so re-selecting the same file fires onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove queued file before sending
  const handleRemoveQueuedFile = (idToRemove) => {
    setQueuedFiles(prev => {
      const item = prev.find(f => f.id === idToRemove);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter(f => f.id !== idToRemove);
    });
  };

  // Dispatch message with attachments
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if ((!text && queuedFiles.length === 0) || sending || !inquiry) return;

    setSending(true);
    let uploadedAttachments = [];

    // 1. Upload queued files to Supabase Storage
    if (queuedFiles.length > 0) {
      setIsUploadingFiles(true);
      try {
        for (const item of queuedFiles) {
          const uploaded = await inquiryService.uploadAttachment(item.file, inquiry.id);
          if (uploaded) {
            uploadedAttachments.push(uploaded);
          }
        }
      } catch (uploadErr) {
        console.error('Failed to upload attachments:', uploadErr);
        toast.error('Some attachments could not be uploaded. Retrying...');
      } finally {
        setIsUploadingFiles(false);
      }
    }

    // 2. Dispatch message record with attachments
    try {
      const newMsg = await inquiryService.sendMessage({
        inquiryId: inquiry.id,
        ticketId: ticketId,
        senderType: 'admin',
        senderName: 'BeautyOasisRx Clinical Concierge',
        message: text,
        attachments: uploadedAttachments
      });

      if (newMsg) {
        setMessages(prev => [...prev, newMsg]);
        setInputText('');

        // Clean up object URLs
        queuedFiles.forEach(f => {
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        });
        setQueuedFiles([]);

        toast.success('Message dispatched to prospect thread.');
        if (onMessageSent) {
          onMessageSent(inquiry.id, text || `Sent ${uploadedAttachments.length} attachment(s)`);
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Could not send message. Please retry.');
    } finally {
      setSending(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  // Confirm soft delete of a message
  const handleConfirmSoftDelete = async () => {
    if (!deletingMsgId || !inquiry) return;

    setIsDeletingMsg(true);
    try {
      await inquiryService.softDeleteMessage(
        deletingMsgId,
        inquiry.id,
        'BeautyOasisRx Clinical Concierge'
      );

      // Optimistically update message in state
      setMessages(prev =>
        prev.map(msg =>
          msg.id === deletingMsgId
            ? { ...msg, is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: 'BeautyOasisRx Clinical Concierge' }
            : msg
        )
      );

      toast.success('Message soft deleted from conversation.');
      setDeletingMsgId(null);
    } catch (err) {
      console.error('Failed to soft delete message:', err);
      toast.error('Failed to delete message.');
    } finally {
      setIsDeletingMsg(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const insertQuickTemplate = (text) => {
    setInputText(prev => (prev ? `${prev} ${text}` : text));
    inputRef.current?.focus();
  };

  if (!inquiry) return null;

  return (
    <>
      <AdminDrawer
        isOpen={isOpen}
        onClose={onClose}
        title="Conversation History"
        subtitle={`Ticket #${ticketId} — ${inquiry.name}`}
        width="600px"
        footer={
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Queued Attachments Preview Strip */}
            {queuedFiles.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  padding: '6px 4px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  maxHeight: '90px'
                }}
              >
                {queuedFiles.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px 8px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      color: '#0f2942',
                      flexShrink: 0,
                      maxWidth: '200px'
                    }}
                  >
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt="Preview"
                        style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                    ) : isPdfAttachment(item.type, item.name) ? (
                      <FileText size={18} color="#dc2626" />
                    ) : (
                      <File size={18} color="#1e5aa8" />
                    )}

                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{formatFileSize(item.size)}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveQueuedFile(item.id)}
                      title="Remove attachment"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '2px',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Clinical Response Chips */}
            <div
              style={{
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                paddingBottom: '4px',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              <button
                type="button"
                onClick={() => insertQuickTemplate(`Dear ${inquiry.name}, thank you for contacting BeautyOasisRx. We have reviewed your inquiry and would be delighted to assist you.`)}
                style={{
                  fontSize: '0.74rem',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                + Welcome greeting
              </button>
              <button
                type="button"
                onClick={() => insertQuickTemplate('Our clinical specialist would be glad to schedule an in-depth aesthetic consultation visit for you.')}
                style={{
                  fontSize: '0.74rem',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                + Consultation offer
              </button>
              <button
                type="button"
                onClick={() => insertQuickTemplate('Please feel free to call our concierge directly at (214) 555-0199 with any questions.')}
                style={{
                  fontSize: '0.74rem',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                + Phone callback
              </button>
            </div>

            {/* Input & Action Buttons Area */}
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', width: '100%' }}>
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {/* Attachment Icon Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach files (Images, PDF, Documents)"
                style={{
                  height: '42px',
                  width: '42px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: queuedFiles.length > 0 ? '#eff6ff' : '#ffffff',
                  color: queuedFiles.length > 0 ? '#1e5aa8' : '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.background = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.background = queuedFiles.length > 0 ? '#eff6ff' : '#ffffff';
                }}
              >
                <Paperclip size={18} />
                {queuedFiles.length > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: '#1e5aa8',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {queuedFiles.length}
                  </span>
                )}
              </button>

              {/* Textarea Composer */}
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea
                  ref={inputRef}
                  className="admin-form-textarea"
                  rows="2"
                  placeholder={`Reply to ${inquiry.name} (Press Enter to dispatch, Shift+Enter for newline)...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{
                    margin: 0,
                    width: '100%',
                    resize: 'none',
                    fontSize: '0.86rem',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    minHeight: '42px',
                    maxHeight: '120px'
                  }}
                />
              </div>

              {/* Send Button */}
              <AdminButton
                type="submit"
                variant="primary"
                disabled={(!inputText.trim() && queuedFiles.length === 0) || sending || isUploadingFiles}
                icon={
                  sending || isUploadingFiles ? (
                    <RefreshCw size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )
                }
                style={{ height: '42px', flexShrink: 0, padding: '0 16px' }}
              >
                {isUploadingFiles ? 'Uploading...' : 'Send'}
              </AdminButton>
            </form>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
          {/* Thread Info Banner */}
          <div
            style={{
              padding: '12px 16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.82rem',
              gap: '10px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Recipient Prospect:</span>
              <span style={{ fontWeight: 600, color: '#0f2942' }}>{inquiry.name}</span>
              <span style={{ color: '#1e5aa8', marginLeft: '6px' }}>({inquiry.email})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AdminBadge status={inquiry.status || 'New'} />
            </div>
          </div>

          {/* Message Thread List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              paddingRight: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              minHeight: 0
            }}
          >
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 10px', color: '#1e5aa8' }} />
                <div style={{ fontSize: '0.86rem' }}>Synchronizing conversation from Supabase...</div>
              </div>
            ) : messages.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                <MessageSquare size={32} style={{ margin: '0 auto 10px', opacity: 0.6 }} />
                <p style={{ margin: 0, fontSize: '0.86rem' }}>No messages recorded yet for this inquiry.</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isAdmin = msg.sender_type === 'admin';
                const isDeleted = Boolean(msg.is_deleted);
                const hasAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0;
                const timeDisplay = msg.created_at
                  ? new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                  : '';
                const dateDisplay = msg.created_at
                  ? new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : '';

                return (
                  <div
                    key={msg.id || idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isAdmin ? 'flex-end' : 'flex-start',
                      maxWidth: '100%',
                      position: 'relative'
                    }}
                  >
                    {/* Sender Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '4px',
                        fontSize: '0.74rem',
                        color: '#64748b'
                      }}
                    >
                      {isAdmin ? (
                        <>
                          <span style={{ fontWeight: 600, color: '#1e5aa8' }}>BeautyOasisRx Concierge</span>
                          <ShieldCheck size={12} color="#1e5aa8" />
                          <span>•</span>
                          <span>{dateDisplay} {timeDisplay}</span>
                        </>
                      ) : (
                        <>
                          <User size={12} color="#64748b" />
                          <span style={{ fontWeight: 600, color: '#334155' }}>{msg.sender_name || inquiry.name}</span>
                          <span>•</span>
                          <span>{dateDisplay} {timeDisplay}</span>
                        </>
                      )}

                      {/* Soft Delete Action for Admin Messages */}
                      {!isDeleted && isAdmin && (
                        <button
                          type="button"
                          onClick={() => setDeletingMsgId(msg.id)}
                          title="Delete message"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            padding: '0 2px',
                            marginLeft: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            transition: 'color 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    {/* Speech Bubble */}
                    <div
                      style={{
                        maxWidth: '85%',
                        padding: '12px 16px',
                        borderRadius: isAdmin ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        background: isDeleted
                          ? '#f1f5f9'
                          : isAdmin
                            ? '#0f2942'
                            : '#ffffff',
                        color: isDeleted
                          ? '#64748b'
                          : isAdmin
                            ? '#ffffff'
                            : '#1e293b',
                        border: isDeleted
                          ? '1px dashed #cbd5e1'
                          : isAdmin
                            ? 'none'
                            : '1px solid #e2e8f0',
                        boxShadow: isAdmin && !isDeleted
                          ? '0 4px 12px rgba(15, 41, 66, 0.15)'
                          : '0 2px 8px rgba(0, 0, 0, 0.04)',
                        fontSize: '0.86rem',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {/* Message Content or Soft Deleted notice */}
                      {isDeleted ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontStyle: 'italic' }}>
                          <Ban size={14} color="#94a3b8" />
                          <span>This message was deleted</span>
                        </div>
                      ) : (
                        <>
                          {msg.message && <div>{msg.message}</div>}

                          {/* Attachments Section */}
                          {hasAttachments && (
                            <div
                              style={{
                                marginTop: msg.message ? '10px' : 0,
                                display: 'grid',
                                gridTemplateColumns: msg.attachments.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(130px, 1fr))',
                                gap: '8px',
                                width: '100%'
                              }}
                            >
                              {msg.attachments.map((att, attIdx) => {
                                const isImg = isImageAttachment(att.file_type, att.file_name);
                                const isPdf = isPdfAttachment(att.file_type, att.file_name);

                                if (isImg) {
                                  return (
                                    <div
                                      key={att.id || attIdx}
                                      onClick={() => setLightboxImage({ url: att.file_url, name: att.file_name })}
                                      title={`Click to preview ${att.file_name}`}
                                      style={{
                                        position: 'relative',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        border: isAdmin ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e2e8f0',
                                        maxHeight: '160px',
                                        background: '#000000',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      <img
                                        src={att.file_url}
                                        alt={att.file_name || 'Attachment'}
                                        style={{
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'cover',
                                          display: 'block'
                                        }}
                                      />
                                      <div
                                        style={{
                                          position: 'absolute',
                                          top: 0,
                                          left: 0,
                                          right: 0,
                                          bottom: 0,
                                          background: 'rgba(15, 41, 66, 0.4)',
                                          opacity: 0,
                                          transition: 'opacity 0.2s ease',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: '#ffffff'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
                                      >
                                        <Maximize2 size={20} />
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <a
                                    key={att.id || attIdx}
                                    href={att.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={att.file_name}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '8px 10px',
                                      borderRadius: '8px',
                                      background: isAdmin ? 'rgba(255, 255, 255, 0.12)' : '#f8fafc',
                                      border: isAdmin ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #e2e8f0',
                                      color: isAdmin ? '#ffffff' : '#0f2942',
                                      textDecoration: 'none',
                                      fontSize: '0.8rem',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    {isPdf ? (
                                      <FileText size={20} color={isAdmin ? '#fca5a5' : '#dc2626'} />
                                    ) : (
                                      <File size={20} color={isAdmin ? '#93c5fd' : '#1e5aa8'} />
                                    )}

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {att.file_name}
                                      </div>
                                      {att.file_size ? (
                                        <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                          {formatFileSize(att.file_size)}
                                        </div>
                                      ) : null}
                                    </div>

                                    <Download size={14} style={{ opacity: 0.8, flexShrink: 0 }} />
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </AdminDrawer>

      {/* Confirmation Dialog for Soft Delete */}
      <AdminConfirmDialog
        isOpen={Boolean(deletingMsgId)}
        onClose={() => setDeletingMsgId(null)}
        onConfirm={handleConfirmSoftDelete}
        title="Delete Message"
        message="Are you sure you want to delete this message? The content will be replaced with 'This message was deleted' while preserving database audit logs."
        loading={isDeletingMsg}
      />

      {/* Lightbox Image Preview Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(4px)',
            zIndex: 100000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            {/* Action Bar */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
                color: '#ffffff'
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lightboxImage.name}
              </span>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <a
                  href={lightboxImage.url}
                  download={lightboxImage.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#ffffff',
                    background: 'rgba(255, 255, 255, 0.2)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={14} />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '6px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Main Image */}
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              style={{
                maxWidth: '90vw',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default InquiryChatDrawer;
