import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { supabase } from '../config/supabase';

export const NotificationsScreen = ({ user, onNavigateToRecord }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'UNREAD'

  // Fetch notifications for the logged in user
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`recipient_user_id.eq.${user.id},user_id.eq.${user.id},patient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (err) {
      console.warn('Error fetching notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();

    // Setup Supabase Realtime subscription
    const channel = supabase
      .channel(`mobile_notifs_${user?.id || 'guest'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNotifications, user?.id]);

  // Mark single notification as read
  const handleMarkAsRead = async (item) => {
    if (item.is_read) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
    );
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', item.id);
    } catch (err) {
      console.warn('Error marking read:', err);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .or(`recipient_user_id.eq.${user.id},user_id.eq.${user.id},patient_id.eq.${user.id}`)
        .eq('is_read', false);
    } catch (err) {
      console.warn('Error marking all read:', err);
    }
  };

  // Notification tap handler
  const handleNotificationPress = async (item) => {
    await handleMarkAsRead(item);

    const type = (item.notification_type || item.type || item.category || '').toLowerCase();
    const entityId = item.related_entity_id || item.reference_id;
    const deepLink = item.deep_link || item.action_url;

    if (onNavigateToRecord) {
      onNavigateToRecord({ type, entityId, deepLink, notification: item });
    }
  };

  const filteredList = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.is_read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const renderItem = ({ item }) => {
    const isRead = Boolean(item.is_read);
    const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : '';

    return (
      <TouchableOpacity
        style={[styles.itemCard, !isRead && styles.itemUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemHeader}>
          <View style={styles.badgeRow}>
            <Text style={styles.categoryBadge}>
              {(item.notification_type || item.type || 'GENERAL').toUpperCase()}
            </Text>
            {!isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>

        <Text style={[styles.itemTitle, !isRead && styles.itemTitleUnread]}>
          {item.title}
        </Text>
        <Text style={styles.itemMessage}>{item.message}</Text>

        {(item.related_entity_id || item.reference_id) && (
          <View style={styles.linkRow}>
            <Text style={styles.linkText}>Tap to view related record →</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount} unread push & clinical alerts
          </Text>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, filter === 'ALL' && styles.tabActive]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.tabText, filter === 'ALL' && styles.tabTextActive]}>
            All ({notifications.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, filter === 'UNREAD' && styles.tabActive]}
          onPress={() => setFilter('UNREAD')}
        >
          <Text style={[styles.tabText, filter === 'UNREAD' && styles.tabTextActive]}>
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#1e5aa8" />
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadNotifications();
              }}
              colors={['#1e5aa8']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptyText}>
                You are all caught up! When appointments or updates are published, you will receive an alert.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f2942',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e5aa8',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 10,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  tabActive: {
    backgroundColor: '#e0f2fe',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0369a1',
  },
  listContent: {
    padding: 16,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemUnread: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1e5aa8',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  itemTitleUnread: {
    color: '#0f2942',
    fontWeight: '700',
  },
  itemMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  linkRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e5aa8',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
  },
});

export default NotificationsScreen;
