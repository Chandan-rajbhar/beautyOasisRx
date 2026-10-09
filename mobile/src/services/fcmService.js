import { Platform, PermissionsAndroid, Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { supabase } from '../config/supabase';

class FCMService {
  constructor() {
    this.messageListener = null;
    this.tokenRefreshListener = null;
    this.currentFcmToken = null;
    this.onNotificationOpenedCallback = null;
    this.onForegroundMessageCallback = null;
  }

  /**
   * Request push notification permissions on iOS and Android 13+ (API 33+)
   */
  async requestUserPermission() {
    try {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('[FCMService] Android POST_NOTIFICATIONS permission denied by user.');
          return false;
        }
      }

      const authStatus = await messaging().requestPermission({
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      });

      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      console.log('[FCMService] Notification authorization status:', authStatus, 'Enabled:', enabled);
      return enabled;
    } catch (err) {
      console.error('[FCMService] Error requesting notification permission:', err);
      return false;
    }
  }

  /**
   * Retrieve current device FCM token
   */
  async getFCMToken() {
    try {
      // Ensure APNs token is set on iOS before requesting FCM token
      if (Platform.OS === 'ios') {
        const apnsToken = await messaging().getAPNSToken();
        if (!apnsToken) {
          console.log('[FCMService] Waiting for APNs token on iOS...');
        }
      }

      const token = await messaging().getToken();
      this.currentFcmToken = token;
      return token;
    } catch (err) {
      console.warn('[FCMService] Error fetching FCM token:', err);
      return null;
    }
  }

  /**
   * Register or update the device FCM token in Supabase `push_devices` table
   */
  async registerDeviceWithSupabase(userId, fcmToken = null) {
    if (!userId) {
      console.warn('[FCMService] registerDeviceWithSupabase called without authenticated userId.');
      return { success: false, error: 'User ID is required' };
    }

    const token = fcmToken || this.currentFcmToken || (await this.getFCMToken());
    if (!token) {
      console.warn('[FCMService] No FCM token available to register.');
      return { success: false, error: 'FCM token unavailable' };
    }

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const deviceId = `${Platform.OS}-${userId.slice(0, 8)}`;
    const deviceName = `${Platform.OS.toUpperCase()} Device (${Platform.Version})`;

    try {
      // 1. Try secure RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('register_push_device', {
        p_user_id: userId,
        p_fcm_token: token,
        p_platform: platform,
        p_device_id: deviceId,
        p_device_name: deviceName,
        p_app_version: '1.0.0',
      });

      if (!rpcError && rpcData) {
        console.log('[FCMService] Device registered successfully via RPC:', rpcData);
        return rpcData;
      }

      // 2. Fallback direct upsert
      const { data, error } = await supabase
        .from('push_devices')
        .upsert(
          {
            user_id: userId,
            fcm_token: token,
            platform,
            device_id: deviceId,
            device_name: deviceName,
            app_version: '1.0.0',
            is_active: true,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'fcm_token' }
        )
        .select()
        .single();

      if (!error && data) {
        console.log('[FCMService] Device registered successfully via upsert:', data.id);
        return { success: true, device: data };
      }

      console.error('[FCMService] Failed to register device in Supabase:', error?.message);
      return { success: false, error: error?.message };
    } catch (err) {
      console.error('[FCMService] Device registration error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Safely disassociate/deactivate device token upon user logout
   */
  async unregisterDeviceOnLogout(userId = null) {
    const token = this.currentFcmToken || (await this.getFCMToken());
    if (!token) return;

    try {
      // Call unregister RPC or direct update
      const { error } = await supabase.rpc('unregister_push_device', {
        p_fcm_token: token,
        p_user_id: userId,
      });

      if (error) {
        await supabase
          .from('push_devices')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('fcm_token', token);
      }

      console.log('[FCMService] Device successfully unregistered on logout.');
    } catch (err) {
      console.warn('[FCMService] Error unregistering device on logout:', err);
    }
  }

  /**
   * Initialize FCM listeners: Foreground, Token Refresh, Notification Open, Deep Linking
   */
  initNotificationListeners({
    onNotificationOpened,
    onForegroundMessage,
    userId,
  } = {}) {
    this.onNotificationOpenedCallback = onNotificationOpened;
    this.onForegroundMessageCallback = onForegroundMessage;

    // 1. Listen for Token Refresh
    this.tokenRefreshListener = messaging().onTokenRefresh(async (newToken) => {
      console.log('[FCMService] FCM Token refreshed:', newToken);
      this.currentFcmToken = newToken;
      if (userId) {
        await this.registerDeviceWithSupabase(userId, newToken);
      }
    });

    // 2. Foreground Message Handler (App is currently open)
    this.messageListener = messaging().onMessage(async (remoteMessage) => {
      console.log('[FCMService] Foreground push notification received:', remoteMessage);

      // Trigger user-defined callback for in-app banner or toast
      if (this.onForegroundMessageCallback) {
        this.onForegroundMessageCallback(remoteMessage);
      } else {
        // Default in-app alert presentation
        const notifTitle = remoteMessage.notification?.title || 'BeautyOasis Rx';
        const notifBody = remoteMessage.notification?.body || 'New clinical update received.';

        Alert.alert(
          notifTitle,
          notifBody,
          [
            { text: 'Dismiss', style: 'cancel' },
            {
              text: 'View',
              onPress: () => {
                if (this.onNotificationOpenedCallback) {
                  this.onNotificationOpenedCallback(remoteMessage);
                }
              },
            },
          ]
        );
      }
    });

    // 3. Notification opened from Background State
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('[FCMService] Notification opened from background:', remoteMessage);
      if (this.onNotificationOpenedCallback) {
        this.onNotificationOpenedCallback(remoteMessage);
      }
    });

    // 4. Notification opened from Terminated / Cold Start State
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('[FCMService] App launched from terminated state via notification:', remoteMessage);
          if (this.onNotificationOpenedCallback) {
            this.onNotificationOpenedCallback(remoteMessage);
          }
        }
      });
  }

  /**
   * Cleanup listeners on unmount
   */
  cleanup() {
    if (this.messageListener) {
      this.messageListener();
      this.messageListener = null;
    }
    if (this.tokenRefreshListener) {
      this.tokenRefreshListener();
      this.tokenRefreshListener = null;
    }
  }
}

export const fcmService = new FCMService();
export default fcmService;
