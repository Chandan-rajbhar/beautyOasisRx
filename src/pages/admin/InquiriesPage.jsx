import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Eye,
  Mail,
  Send,
  Archive,
  Trash2,
  CheckCircle,
  Clock,
  User,
  Phone
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';

export const InquiriesPage = () => {
  const { inquiries, updateItem, deleteItem, isLoading } = useAdminData();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [replyInquiry, setReplyInquiry] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replySuccess, setReplySuccess] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const handleMarkAsRead = (inq) => {
    if (inq.status === 'New') {
      updateItem('inquiries', inq.id, { status: 'Read' });
    }
  };

  const handleArchive = (inq) => {
    updateItem('inquiries', inq.id, { status: 'Archived' });
  };

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;

    updateItem('inquiries', replyInquiry.id, {
      status: 'Replied',
      lastReply: replyMessage,
      repliedDate: new Date().toLocaleString()
    });

    setReplySuccess(`Reply officially dispatched to ${replyInquiry.email}`);
    setTimeout(() => {
      setReplySuccess('');
      setReplyInquiry(null);
      setReplyMessage('');
    }, 2000);
  };

  const handleDelete = () => {
    if (deleteConfirmId) {
      deleteItem('inquiries', deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        inq.name.toLowerCase().includes(searchLower) ||
        inq.email.toLowerCase().includes(searchLower) ||
        inq.subject.toLowerCase().includes(searchLower) ||
        inq.message.toLowerCase().includes(searchLower);

      const matchStatus = statusFilter === 'ALL' || inq.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [inquiries, searchTerm, statusFilter]);

  const columns = [
    {
      header: 'Sender / Prospect',
      accessor: 'name',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f2942' }}>{row.name}</div>
          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{row.phone}</div>
        </div>
      )
    },
    {
      header: 'Email',
      accessor: 'email',
      render: (row) => (
        <span style={{ fontSize: '0.84rem', color: '#1e5aa8' }}>
          {row.email}
        </span>
      )
    },
    {
      header: 'Subject & Inquiry',
      accessor: 'subject',
      render: (row) => (
        <div style={{ maxWidth: '300px' }}>
          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {row.subject}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {row.message}
          </div>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (row) => <AdminBadge status={row.status} />
    },
    {
      header: 'Received Date',
      accessor: 'date',
      sortable: true,
      render: (row) => (
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
          {row.date}
        </span>
      )
    },
    {
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => {
              handleMarkAsRead(row);
              setSelectedInquiry(row);
            }}
            title="View Full Inquiry"
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '6px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#1e5aa8',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Eye size={14} />
          </button>

          <button
            onClick={() => {
              handleMarkAsRead(row);
              setReplyInquiry(row);
              setReplyMessage(`Dear ${row.name},\n\nThank you for reaching out to BeautyOasisRx Clinical Aesthetics. Dr. Vance and our clinical team would be delighted to welcome you.\n\nWarm regards,\nBeautyOasisRx Clinical Concierge`);
            }}
            title="Reply via Email"
            style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              padding: '6px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Mail size={14} />
          </button>

          <button
            onClick={() => handleArchive(row)}
            title="Archive Inquiry"
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              padding: '6px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#475569',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Archive size={14} />
          </button>

          <button
            onClick={() => setDeleteConfirmId(row.id)}
            title="Delete Inquiry"
            style={{
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              padding: '6px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#b91c1c',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Website Messages & Consultation Inquiries</h1>
          <p>Review and reply to prospective patient inquiries submitted via the public BeautyOasisRx website.</p>
        </div>
      </div>

      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search inquiries by sender, email, subject, text..."
        hasActiveFilters={Boolean(searchTerm) || statusFilter !== 'ALL'}
        onClearFilters={() => {
          setSearchTerm('');
          setStatusFilter('ALL');
        }}
        filters={[
          {
            id: 'status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { label: 'All Statuses', value: 'ALL' },
              { label: 'New', value: 'New' },
              { label: 'Read', value: 'Read' },
              { label: 'Replied', value: 'Replied' },
              { label: 'Archived', value: 'Archived' }
            ]
          }
        ]}
      />

      <AdminTable
        columns={columns}
        data={filteredInquiries}
        loading={isLoading}
        itemsPerPage={8}
        emptyTitle="No messages found"
        emptyDescription="There are currently no patient inquiries in this view."
      />

      {/* View Message Drawer */}
      <AdminDrawer
        isOpen={Boolean(selectedInquiry)}
        onClose={() => setSelectedInquiry(null)}
        title="Consultation Inquiry"
        subtitle={`From: ${selectedInquiry?.name}`}
        footer={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AdminButton
              variant="secondary"
              onClick={() => {
                const inq = selectedInquiry;
                setSelectedInquiry(null);
                setReplyInquiry(inq);
                setReplyMessage(`Dear ${inq.name},\n\nThank you for reaching out to BeautyOasisRx. In response to your question regarding "${inq.subject}":\n\n\nWarm regards,\nBeautyOasisRx Clinical Concierge`);
              }}
              icon={<Mail size={14} />}
            >
              Compose Reply
            </AdminButton>
            <AdminButton variant="primary" onClick={() => setSelectedInquiry(null)}>
              Done
            </AdminButton>
          </div>
        }
      >
        {selectedInquiry && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Inquiry Status
                </span>
                <div style={{ marginTop: '4px' }}>
                  <AdminBadge status={selectedInquiry.status} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Received At
                </span>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f2942' }}>
                  {selectedInquiry.date}
                </div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#0f2942', fontWeight: 700 }}>
                Prospect Contact Information
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Name</span>
                  <span style={{ fontWeight: 600 }}>{selectedInquiry.name}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Phone</span>
                  <span>{selectedInquiry.phone || 'None provided'}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Email</span>
                  <span style={{ color: '#1e5aa8', fontWeight: 600 }}>{selectedInquiry.email}</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.92rem', color: '#0f2942', fontWeight: 700 }}>
                {selectedInquiry.subject}
              </h4>
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {selectedInquiry.message}
              </p>
            </div>

            {selectedInquiry.lastReply && (
              <div style={{ background: '#f0fdf4', borderRadius: '12px', border: '1px solid #86efac', padding: '16px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.84rem', color: '#15803d', fontWeight: 700 }}>
                  Clinical Response Logged ({selectedInquiry.repliedDate})
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                  {selectedInquiry.lastReply}
                </p>
              </div>
            )}
          </div>
        )}
      </AdminDrawer>

      {/* Reply Modal */}
      {replyInquiry && (
        <AdminModal
          isOpen={Boolean(replyInquiry)}
          onClose={() => setReplyInquiry(null)}
          title={`Reply to ${replyInquiry.name}`}
          maxWidth="560px"
        >
          <form onSubmit={handleSendReply}>
            {replySuccess ? (
              <div style={{ padding: '20px', background: '#dcfce7', color: '#15803d', borderRadius: '12px', textAlign: 'center', fontWeight: 600 }}>
                {replySuccess}
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '14px', fontSize: '0.84rem', color: '#475569' }}>
                  Sending clinical response to: <strong>{replyInquiry.email}</strong>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Subject</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    defaultValue={`Re: ${replyInquiry.subject}`}
                    readOnly
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Message Body</label>
                  <textarea
                    className="admin-form-textarea"
                    rows="6"
                    required
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <AdminButton variant="secondary" onClick={() => setReplyInquiry(null)}>
                    Cancel
                  </AdminButton>
                  <AdminButton type="submit" variant="primary" icon={<Send size={14} />}>
                    Dispatch Reply
                  </AdminButton>
                </div>
              </>
            )}
          </form>
        </AdminModal>
      )}

      <AdminConfirmDialog
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Message"
        message="Are you certain you want to purge this message from the system?"
      />
    </div>
  );
};
