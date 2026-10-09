import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { fcmService } from '../services/fcmService';
import { supabase } from '../config/supabase';

export const PushDiagnosticsScreen = ({ user, onClose }) => {
  const [fcmToken, setFcmToken] = useState('');
  const [permissionStatus, setPermissionStatus] = useState('Checking...');
  const [registrationStatus, setRegistrationStatus] = useState('Checking...');
  const [registeredDeviceRow, setRegisteredDeviceRow] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      // 1. Check FCM Token
      const token = await fcmService.getFCMToken();
      setFcmToken(token || 'Not generated');

      // 2. Check Permission
      const hasPerm = await fcmService.requestUserPermission();
      setPermissionStatus(hasPerm ? 'Authorized (Active)' : 'Denied / Disabled');

      // 3. Check Supabase push_devices table
      if (token) {
        const { data, error } = await supabase
          .from('push_devices')
          .select('*')
          .eq('fcm_token', token)
          .maybeSingle();

        if (data) {
          setRegistrationStatus(data.is_active ? 'Active in Supabase' : 'Inactive');
          setRegisteredDeviceRow(data);
        } else {
          setRegistrationStatus('Token not found in push_devices table');
        }
      }
    } catch (err) {
      console.warn('Diagnostics check error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleRegisterNow = async () => {
    if (!user?.id) {
      Alert.alert('Sign in Required', 'Please authenticate first.');
      return;
    }
    setLoading(true);
    try {
      const res = await fcmService.registerDeviceWithSupabase(user.id);
      Alert.alert('Result', JSON.stringify(res, null, 2));
      await checkStatus();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    if (!user?.id) {
      Alert.alert('Sign in Required', 'Please authenticate first.');
      return;
    }

    setLoading(true);
    try {
      const idempotencyKey = `test_${Date.now()}`;
      const payload = {
        title: 'BeautyOasis Push Test',
        message: 'FCM push notification successfully delivered to your device!',
        notification_type: 'general',
        recipient_user_id: user.id,
        idempotency_key: idempotencyKey,
      };

      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: payload,
      });

      if (!error) {
        Alert.alert(
          'Push Dispatched',
          `Notification ID: ${data?.notification_id || 'Created'}\nStatus: ${data?.delivery_status}\nTokens Target: ${data?.tokens_count || 1}`
        );
      } else {
        Alert.alert('Notice', `Edge Function response: ${error.message}`);
      }
    } catch (err) {
      Alert.alert('Transmission Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Push Diagnostics Console</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Device & OS Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Environment</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Platform:</Text>
            <Text style={styles.val}>{Platform.OS.toUpperCase()} (API {Platform.Version})</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Current User ID:</Text>
            <Text style={styles.val}>{user?.id ? `${user.id.slice(0, 12)}...` : 'Not Authenticated'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>OS Permission:</Text>
            <Text style={[styles.val, { color: permissionStatus.includes('Authorized') ? '#16a34a' : '#dc2626' }]}>
              {permissionStatus}
            </Text>
          </View>
        </View>

        {/* FCM Token Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Firebase FCM Token</Text>
          <Text style={styles.tokenText} numberOfLines={4} ellipsizeMode="middle">
            {fcmToken || 'No token retrieved'}
          </Text>
        </View>

        {/* Supabase Registration Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Supabase Database Registration</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Table Status:</Text>
            <Text style={[styles.val, { color: registrationStatus.includes('Active') ? '#16a34a' : '#ea580c' }]}>
              {registrationStatus}
            </Text>
          </View>
          {registeredDeviceRow && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Device ID:</Text>
                <Text style={styles.val}>{registeredDeviceRow.device_id || 'N/A'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Last Seen:</Text>
                <Text style={styles.val}>{new Date(registeredDeviceRow.last_seen_at).toLocaleTimeString()}</Text>
              </View>
            </>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsBox}>
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={handleRegisterNow}
            disabled={loading}
          >
            <Text style={styles.btnSecondaryText}>Force Re-Register Token</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleSendTestPush}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Send Live Test Push</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f2942',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0a1d30',
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a5f',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1e3a5f',
  },
  closeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: '#162b44',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    fontSize: 13,
    color: '#94a3b8',
  },
  val: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f8fafc',
  },
  tokenText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#cbd5e1',
    backgroundColor: '#0a1d30',
    padding: 10,
    borderRadius: 8,
  },
  actionsBox: {
    gap: 12,
    marginTop: 10,
  },
  btnPrimary: {
    backgroundColor: '#1e5aa8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PushDiagnosticsScreen;
