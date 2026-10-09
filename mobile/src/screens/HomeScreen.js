import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { supabase } from '../config/supabase';

export const HomeScreen = ({
  user,
  onOpenNotifications,
  onOpenDiagnostics,
  onLogout,
}) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    if (!user?.id) return;
    try {
      // 1. Unread notifications
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .or(`recipient_user_id.eq.${user.id},user_id.eq.${user.id},patient_id.eq.${user.id}`)
        .eq('is_read', false);

      setUnreadCount(notifCount || 0);

      // 2. Appointments
      const { count: apptCount } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .or(`patient_id.eq.${user.id},client_id.eq.${user.id}`);

      setAppointmentsCount(apptCount || 0);
    } catch (err) {
      console.warn('Error loading home stats:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [user?.id]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.userName}>
            {user?.user_metadata?.name || user?.email?.split('@')[0] || 'Patient'}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notifBadgeBtn}
            onPress={onOpenNotifications}
            activeOpacity={0.7}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badgePill}>
                <Text style={styles.badgeCount}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadStats();
            }}
            colors={['#1e5aa8']}
          />
        }
      >
        {/* Banner Card */}
        <View style={styles.bannerCard}>
          <Text style={styles.bannerTag}>BEAUTYOASIS RX MOBILE</Text>
          <Text style={styles.bannerTitle}>Connected Push Alerts Active</Text>
          <Text style={styles.bannerDesc}>
            Your device is registered with Firebase Cloud Messaging. You will receive real-time notifications for appointment updates, order fulfillments, and clinical alerts.
          </Text>
        </View>

        {/* Quick Stats Grid */}
        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={onOpenNotifications}
            activeOpacity={0.7}
          >
            <Text style={styles.statNumber}>{unreadCount}</Text>
            <Text style={styles.statLabel}>Unread Alerts</Text>
            <Text style={styles.statAction}>View Feed →</Text>
          </TouchableOpacity>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{appointmentsCount}</Text>
            <Text style={styles.statLabel}>Appointments</Text>
            <Text style={styles.statAction}>Confirmed</Text>
          </View>
        </View>

        {/* Diagnostic Tools Card */}
        <View style={styles.toolsCard}>
          <Text style={styles.toolsTitle}>FCM Push Notification Tools</Text>
          <Text style={styles.toolsDesc}>
            Verify push device token registration, test background wakes, and inspect delivery payloads.
          </Text>

          <TouchableOpacity
            style={styles.diagBtn}
            onPress={onOpenDiagnostics}
          >
            <Text style={styles.diagBtnText}>Open Push Diagnostics Console</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Sign Out of Mobile App</Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  welcomeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f2942',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notifBadgeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellIcon: {
    fontSize: 20,
  },
  badgePill: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeCount: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  bannerCard: {
    backgroundColor: '#0f2942',
    borderRadius: 16,
    padding: 20,
  },
  bannerTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 1,
    marginBottom: 6,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  bannerDesc: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1e5aa8',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 4,
  },
  statAction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e5aa8',
    marginTop: 8,
  },
  toolsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  toolsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f2942',
  },
  toolsDesc: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  diagBtn: {
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  diagBtnText: {
    color: '#1e5aa8',
    fontSize: 13,
    fontWeight: '700',
  },
  logoutBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HomeScreen;
