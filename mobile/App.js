import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  View,
  Alert,
} from 'react-native';
import { supabase } from './src/config/supabase';
import { fcmService } from './src/services/fcmService';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { AppointmentDetailScreen } from './src/screens/AppointmentDetailScreen';
import { OrderDetailScreen } from './src/screens/OrderDetailScreen';
import { PushDiagnosticsScreen } from './src/screens/PushDiagnosticsScreen';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('HOME'); // 'HOME', 'NOTIFICATIONS', 'APPOINTMENT_DETAIL', 'ORDER_DETAIL', 'DIAGNOSTICS'
  const [selectedEntityId, setSelectedEntityId] = useState(null);

  // Deep Link Navigator
  const handleDeepLink = useCallback((navData) => {
    if (!navData) return;
    const { type, entityId, deepLink } = navData;
    console.log('[App] Handling deep link navigate:', { type, entityId, deepLink });

    if (type === 'appointment' && entityId) {
      setSelectedEntityId(entityId);
      setCurrentScreen('APPOINTMENT_DETAIL');
    } else if (type === 'order' && entityId) {
      setSelectedEntityId(entityId);
      setCurrentScreen('ORDER_DETAIL');
    } else {
      setCurrentScreen('NOTIFICATIONS');
    }
  }, []);

  // Initialize Auth & FCM
  useEffect(() => {
    let isMounted = true;

    async function initApp() {
      try {
        // 1. Check existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted && session?.user) {
          setUser(session.user);

          // 2. Register push device in Supabase for existing session
          await fcmService.requestUserPermission();
          const token = await fcmService.getFCMToken();
          if (token) {
            await fcmService.registerDeviceWithSupabase(session.user.id, token);
          }
        }
      } catch (err) {
        console.warn('App init session error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initApp();

    // 3. Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await fcmService.requestUserPermission();
          const token = await fcmService.getFCMToken();
          if (token) {
            await fcmService.registerDeviceWithSupabase(session.user.id, token);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setCurrentScreen('HOME');
        }
      }
    );

    // 4. Setup FCM Listeners (Foreground, Background Tap, Cold Start Tap)
    fcmService.initNotificationListeners({
      userId: user?.id,
      onNotificationOpened: (remoteMessage) => {
        const notifData = remoteMessage?.data || {};
        handleDeepLink({
          type: notifData.type || notifData.category,
          entityId: notifData.related_entity_id,
          deepLink: notifData.deep_link,
        });
      },
      onForegroundMessage: (remoteMessage) => {
        const title = remoteMessage.notification?.title || 'BeautyOasis Rx';
        const body = remoteMessage.notification?.body || 'New alert received';

        Alert.alert(title, body, [
          { text: 'Dismiss', style: 'cancel' },
          {
            text: 'View',
            onPress: () => {
              const notifData = remoteMessage?.data || {};
              handleDeepLink({
                type: notifData.type || notifData.category,
                entityId: notifData.related_entity_id,
                deepLink: notifData.deep_link,
              });
            },
          },
        ]);
      },
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
      fcmService.cleanup();
    };
  }, [handleDeepLink, user?.id]);

  const handleLogout = async () => {
    if (user?.id) {
      await fcmService.unregisterDeviceOnLogout(user.id);
    }
    await supabase.auth.signOut();
    setUser(null);
    setCurrentScreen('HOME');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e5aa8" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f2942" />

      {!user ? (
        <LoginScreen onLoginSuccess={(u) => setUser(u)} />
      ) : currentScreen === 'NOTIFICATIONS' ? (
        <NotificationsScreen
          user={user}
          onNavigateToRecord={(navData) => handleDeepLink(navData)}
        />
      ) : currentScreen === 'APPOINTMENT_DETAIL' ? (
        <AppointmentDetailScreen
          appointmentId={selectedEntityId}
          onBack={() => setCurrentScreen('NOTIFICATIONS')}
        />
      ) : currentScreen === 'ORDER_DETAIL' ? (
        <OrderDetailScreen
          orderId={selectedEntityId}
          onBack={() => setCurrentScreen('NOTIFICATIONS')}
        />
      ) : currentScreen === 'DIAGNOSTICS' ? (
        <PushDiagnosticsScreen
          user={user}
          onClose={() => setCurrentScreen('HOME')}
        />
      ) : (
        <HomeScreen
          user={user}
          onOpenNotifications={() => setCurrentScreen('NOTIFICATIONS')}
          onOpenDiagnostics={() => setCurrentScreen('DIAGNOSTICS')}
          onLogout={handleLogout}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f2942',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f2942',
  },
});
