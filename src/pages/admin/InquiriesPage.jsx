import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Eye,
  Edit2,
  Trash2,
  Plus,
  MoreVertical,
  Check,
  ChevronDown,
  RotateCcw,
  RefreshCw,
  Mail,
  Phone,
  Hash,
  Tag
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  useDropdownMenu
} from '../../components/ui/dropdown-menu';
import { AddEditInquiryDrawer } from '../../components/admin/inquiries/AddEditInquiryDrawer';
import { InquiryDetailDrawer } from '../../components/admin/inquiries/InquiryDetailDrawer';
import { InquiryChatDrawer } from '../../components/admin/inquiries/InquiryChatDrawer';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  ShadcnSelect
} from '../../components/ui/select';
import { inquiryService, normalizeInquiry } from '../../services/inquiryService';
import { supabase } from '../../lib/supabaseClient';

// Refined status styling themes matching BeautyOasis design tokens
const STATUS_THEMES = {
  'New': {
    label: 'New',
    dot: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1d4ed8'
  },
  'In Progress': {
    label: 'In Progress',
    dot: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    text: '#b45309'
  },
  'Waiting for Response': {
    label: 'Waiting for Response',
    dot: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    text: '#6d28d9'
  },
  'Resolved': {
    label: 'Resolved',
    dot: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    text: '#15803d'
  },
  'Closed': {
    label: 'Closed',
    dot: '#64748b',
    bg: '#f8fafc',
    border: '#cbd5e1',
    text: '#475569'
  }
};

// Premium Shadcn status select inside the actions dropdown menu
const InquiryStatusActionSelect = ({ row, onUpdateStatus }) => {
  const menuContext = useDropdownMenu();
  const currentStatus = row.status || 'New';
  const theme = STATUS_THEMES[currentStatus] || STATUS_THEMES['New'];

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Select
        value={currentStatus}
        onValueChange={(newStatus) => {
          onUpdateStatus(row.id, newStatus);
          // Automatically close the 3-dot menu after status selection
          setTimeout(() => {
            menuContext?.setOpen(false);
          }, 150);
        }}
      >
        <SelectTrigger
          style={{
            height: '34px',
            width: '100%',
            padding: '0 10px',
            borderRadius: '7px',
            backgroundColor: theme.bg,
            border: `1px solid ${theme.border}`,
            color: theme.text,
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            transition: 'all 0.15s ease'
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: theme.dot,
                boxShadow: `0 0 0 2px ${theme.bg}, 0 0 0 3px ${theme.border}`,
                flexShrink: 0
              }}
            />
            <span style={{ whiteSpace: 'nowrap' }}>{theme.label}</span>
          </span>
        </SelectTrigger>

        <SelectContent
          side="auto"
          style={{
            width: '100%',
            minWidth: '210px',
            padding: '4px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            boxShadow: '0 12px 28px -4px rgba(15, 41, 66, 0.16), 0 4px 8px -2px rgba(15, 41, 66, 0.06)',
            zIndex: 100002
          }}
        >
          {Object.entries(STATUS_THEMES).map(([stKey, stTheme]) => {
            const isSelected = currentStatus === stKey;
            return (
              <SelectItem
                key={stKey}
                value={stKey}
                indicatorColor={stTheme.text}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  backgroundColor: isSelected ? stTheme.bg : 'transparent',
                  color: isSelected ? stTheme.text : '#334155',
                  fontWeight: isSelected ? 600 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.12s ease'
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: stTheme.dot,
                      flexShrink: 0
                    }}
                  />
                  <span style={{ whiteSpace: 'nowrap' }}>{stTheme.label}</span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};

export const InquiriesPage = () => {
  const { inquiries = [], clients = [], createItem, updateItem, deleteItem, isLoading: contextLoading } = useAdminData();

  // Local state initialized with context inquiries or dynamic fetch
  const [inquiriesList, setInquiriesList] = useState(() => (Array.isArray(inquiries) ? inquiries.map(normalizeInquiry) : []));
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Search & Status filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals & Drawers state
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState(null);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [chatInquiry, setChatInquiry] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch inquiries dynamically from Supabase
  const refreshInquiries = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await inquiryService.fetchInquiries();
      setInquiriesList(data || []);
    } catch (err) {
      console.error('Error refreshing inquiries from Supabase:', err);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, []);

  useEffect(() => {
    refreshInquiries();
  }, [refreshInquiries]);

  // Real-time Supabase postgres subscription for live updates
  useEffect(() => {
    const channelName = `inq_feed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inquiries' },
        () => {
          refreshInquiries();
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (_) { }
    };
  }, [refreshInquiries]);

  // Synchronize when context inquiries update (before local fetch completes)
  useEffect(() => {
    if (!hasFetched && Array.isArray(inquiries) && inquiries.length > 0) {
      setInquiriesList(inquiries.map(normalizeInquiry));
    }
  }, [inquiries, hasFetched]);

  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Auto-open inquiry details drawer when navigated from a notification
  useEffect(() => {
    const targetId = location.state?.selectedInquiryId || location.state?.highlightId || searchParams.get('id') || searchParams.get('ticket');
    if (targetId && inquiriesList.length > 0) {
      const match = inquiriesList.find(i => 
        String(i.id).toLowerCase() === String(targetId).toLowerCase() || 
        String(i.ticket_id || '').toLowerCase() === String(targetId).toLowerCase()
      );
      if (match) {
        setSelectedInquiry(match);
      }
    }
  }, [location.state, searchParams, inquiriesList]);

  // ─────────────────────────────────────────────────────────────
  // CRUD HANDLERS (SUPABASE)
  // ─────────────────────────────────────────────────────────────

  // Create or Update Inquiry
  const handleSaveInquiry = async (payload, existingId) => {
    if (existingId) {
      const updated = await inquiryService.updateInquiry(existingId, payload);
      try {
        await updateItem('inquiries', existingId, payload);
      } catch (_) { }

      setInquiriesList(prev =>
        prev.map(item => (item.id === existingId ? updated : item))
      );
    } else {
      const created = await inquiryService.createInquiry(payload);
      try {
        await createItem('inquiries', created);
      } catch (_) { }

      setInquiriesList(prev => [created, ...prev.filter(x => x.id !== created.id)]);
    }
  };

  // Immediate Status Update
  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const updated = await inquiryService.updateInquiry(id, { status: newStatus });
      try {
        await updateItem('inquiries', id, { status: newStatus });
      } catch (_) { }

      setInquiriesList(prev =>
        prev.map(item => (item.id === id ? { ...item, status: newStatus } : item))
      );

      // If drawer is open with this inquiry, sync its status
      if (selectedInquiry && selectedInquiry.id === id) {
        setSelectedInquiry(prev => ({ ...prev, status: newStatus }));
      }
      if (chatInquiry && chatInquiry.id === id) {
        setChatInquiry(prev => ({ ...prev, status: newStatus }));
      }

      toast.success(`Inquiry status updated to ${newStatus}.`);
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error('Could not update status.');
    }
  };

  // Delete Inquiry
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;

    setIsDeleting(true);
    try {
      await inquiryService.deleteInquiry(deleteConfirmId);
      try {
        await deleteItem('inquiries', deleteConfirmId);
      } catch (_) { }

      setInquiriesList(prev => prev.filter(item => item.id !== deleteConfirmId));
      toast.success('Inquiry record deleted successfully.');
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete inquiry:', err);
      toast.error('Failed to delete inquiry.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Callback when a new chat message is dispatched
  const handleMessageSent = (inquiryId, lastMessageText) => {
    setInquiriesList(prev =>
      prev.map(item => {
        if (item.id === inquiryId) {
          return {
            ...item,
            status: 'Waiting for Response',
            last_reply: lastMessageText,
            updated_at: new Date().toISOString()
          };
        }
        return item;
      })
    );
  };

  // Open View Details Drawer and fetch fresh dynamic data from Supabase
  const handleOpenDetails = async (inquiryOrRow) => {
    if (!inquiryOrRow) return;
    // 1. Immediately open with existing data for zero-lag UI response
    setSelectedInquiry(inquiryOrRow);

    // 2. Dynamically fetch fresh data from Supabase in the background
    const idToFetch = inquiryOrRow.id || inquiryOrRow.ticket_id || inquiryOrRow.ticketId;
    if (idToFetch) {
      try {
        const freshRecord = await inquiryService.getInquiryById(idToFetch);
        if (freshRecord) {
          setSelectedInquiry(freshRecord);
        }
      } catch (err) {
        console.warn('Could not refresh inquiry detail from Supabase:', err);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SEARCH & FILTER LOGIC
  // ─────────────────────────────────────────────────────────────
  const filteredInquiries = useMemo(() => {
    const list = hasFetched
      ? inquiriesList
      : (inquiriesList.length > 0 ? inquiriesList : inquiries.map(normalizeInquiry));
    const searchLower = searchTerm.toLowerCase().trim();

    return list.filter((inq) => {
      const ticketId = (inq.ticket_id || inq.ticketId || '').toLowerCase();
      const name = (inq.name || '').toLowerCase();
      const email = (inq.email || '').toLowerCase();
      const phone = (inq.contact_number || inq.phone || '').toLowerCase();
      const subject = (inq.subject || '').toLowerCase();
      const message = (inq.message || '').toLowerCase();

      const matchSearch =
        !searchLower ||
        ticketId.includes(searchLower) ||
        name.includes(searchLower) ||
        email.includes(searchLower) ||
        phone.includes(searchLower) ||
        subject.includes(searchLower) ||
        message.includes(searchLower);

      const matchStatus = statusFilter === 'ALL' || inq.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [inquiriesList, inquiries, searchTerm, statusFilter, hasFetched]);

  // ─────────────────────────────────────────────────────────────
  // TABLE COLUMNS CONFIGURATION
  // ─────────────────────────────────────────────────────────────
  const columns = [
    {
      header: 'Ticket ID',
      accessor: 'ticket_id',
      sortable: true,
      render: (row) => {
        const tid = row.ticket_id || row.ticketId || (row.id ? `INQ-${String(row.id).slice(0, 8).toUpperCase()}` : 'INQ-N/A');
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetails(row);
            }}
            title={`View Details for Ticket #${tid}`}
            style={{
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: '0.8rem',
              color: '#1e5aa8',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '3px 8px',
              borderRadius: '6px',
              letterSpacing: '0.02em',
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#dbeafe';
              e.currentTarget.style.borderColor = '#93c5fd';
              e.currentTarget.style.color = '#1d4ed8';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(30, 90, 168, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#eff6ff';
              e.currentTarget.style.borderColor = '#bfdbfe';
              e.currentTarget.style.color = '#1e5aa8';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            #{tid}
          </button>
        );
      }
    },
    {
      header: 'Sender Name',
      accessor: 'name',
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDetails(row);
          }}
          title={`View Details for ${row.name}`}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            margin: 0,
            font: 'inherit',
            fontWeight: 600,
            color: '#0f2942',
            fontSize: '0.88rem',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'inline-flex',
            alignItems: 'center',
            transition: 'color 0.15s ease',
            outline: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#1e5aa8';
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#0f2942';
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          {row.name}
        </button>
      )
    },
    {
      header: 'Email',
      accessor: 'email',
      sortable: true,
      render: (row) => (
        <a
          href={`mailto:${row.email}`}
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: '0.84rem', color: '#1e5aa8', textDecoration: 'none', fontWeight: 500 }}
        >
          {row.email}
        </a>
      )
    },
    {
      header: 'Contact No.',
      accessor: 'contact_number',
      render: (row) => {
        const phone = row.contact_number || row.phone;
        return (
          <span style={{ fontSize: '0.82rem', color: phone ? '#334155' : '#94a3b8', whiteSpace: 'nowrap' }}>
            {phone || '—'}
          </span>
        );
      }
    },
    {
      header: 'Subject & Inquiry',
      accessor: 'subject',
      render: (row) => (
        <div style={{ maxWidth: '340px' }}>
          <div
            style={{
              fontWeight: 600,
              color: '#1e293b',
              fontSize: '0.86rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            title={row.subject}
          >
            {row.subject}
          </div>
          <div
            style={{
              fontSize: '0.76rem',
              color: '#64748b',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: '2px'
            }}
            title={row.message}
          >
            {row.message}
          </div>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (row) => <AdminBadge status={row.status || 'New'} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Inquiry Actions"
                style={{
                  background: '#f8fafc',
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
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" width="220px" fixed={true}>
              {/* 1. View Details */}
              <DropdownMenuItem
                onClick={() => {
                  handleOpenDetails(row);
                }}
              >
                <Eye size={15} color="#1e5aa8" />
                <span>View Details</span>
              </DropdownMenuItem>

              {/* 2. Edit Inquiry */}
              <DropdownMenuItem
                onClick={() => {
                  setEditingInquiry(row);
                  setIsAddDrawerOpen(true);
                }}
              >
                <Edit2 size={15} color="#475569" />
                <span>Edit Inquiry</span>
              </DropdownMenuItem>

              {/* 3. Reply / Chat */}
              <DropdownMenuItem
                onClick={() => {
                  setChatInquiry(row);
                }}
              >
                <MessageSquare size={15} color="#15803d" />
                <span>Reply / Chat</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* 4. Refined Change Status Section */}
              <div
                style={{
                  padding: '6px 4px 4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#94a3b8',
                    paddingLeft: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <RotateCcw size={11} color="#94a3b8" />
                  <span>Change Status</span>
                </div>

                <InquiryStatusActionSelect row={row} onUpdateStatus={handleUpdateStatus} />
              </div>

              <DropdownMenuSeparator />

              {/* 5. Delete Inquiry */}
              <DropdownMenuItem
                variant="danger"
                onClick={() => setDeleteConfirmId(row.id)}
              >
                <Trash2 size={15} color="#dc2626" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Inquiries & Leads</h1>
          <p>Review, respond, and manage prospective patient inquiries submitted via the public BeautyOasisRx website.</p>
        </div>

        <div className="admin-page-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>

          <AdminButton
            variant="primary"
            onClick={() => {
              setEditingInquiry(null);
              setIsAddDrawerOpen(true);
            }}
            icon={<Plus size={16} />}
          >
            Add Inquiry
          </AdminButton>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by ticket ID, name, email, contact no, subject, message..."
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
              { label: 'New', value: 'New', dotColor: '#2563eb' },
              { label: 'In Progress', value: 'In Progress', dotColor: '#d97706' },
              { label: 'Waiting for Response', value: 'Waiting for Response', dotColor: '#7c3aed' },
              { label: 'Resolved', value: 'Resolved', dotColor: '#16a34a' },
              { label: 'Closed', value: 'Closed', dotColor: '#64748b' }
            ]
          }
        ]}
      />

      {/* Dynamic Supabase Inquiries Table */}
      <AdminTable
        columns={columns}
        data={filteredInquiries}
        loading={isLoading || (contextLoading && inquiriesList.length === 0)}
        itemsPerPage={20}
        itemLabel="inquiries"
        emptyTitle="No inquiries found"
        emptyDescription="There are currently no prospective patient inquiries matching your filter criteria."
        emptyActionLabel="Add New Inquiry"
        onEmptyAction={() => {
          setEditingInquiry(null);
          setIsAddDrawerOpen(true);
        }}
      />

      {/* Add / Edit Inquiry Right-Side Drawer */}
      <AddEditInquiryDrawer
        isOpen={isAddDrawerOpen}
        onClose={() => {
          setIsAddDrawerOpen(false);
          setEditingInquiry(null);
        }}
        onSave={handleSaveInquiry}
        inquiry={editingInquiry}
        existingInquiries={inquiriesList}
        initialPatients={clients}
      />

      {/* View Inquiry Details Right-Side Drawer */}
      <InquiryDetailDrawer
        isOpen={Boolean(selectedInquiry)}
        onClose={() => setSelectedInquiry(null)}
        inquiry={selectedInquiry}
        onEdit={(inq) => {
          setSelectedInquiry(null);
          setEditingInquiry(inq);
          setIsAddDrawerOpen(true);
        }}
        onOpenChat={(inq) => {
          setSelectedInquiry(null);
          setChatInquiry(inq);
        }}
      />

      {/* Reply / Chat Right-Side Drawer */}
      <InquiryChatDrawer
        isOpen={Boolean(chatInquiry)}
        onClose={() => setChatInquiry(null)}
        inquiry={chatInquiry}
        onMessageSent={handleMessageSent}
      />

      {/* Delete Confirmation Dialog */}
      <AdminConfirmDialog
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Inquiry Record"
        message="Are you certain you want to purge this consultation inquiry and its messaging history from Supabase? This action cannot be reversed."
        loading={isDeleting}
      />
    </div>
  );
};

export default InquiriesPage;
