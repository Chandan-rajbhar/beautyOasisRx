import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { supabase } from '../config/supabase';

export const OrderDetailScreen = ({ orderId, onBack }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) return;
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle();

        if (!error && data) {
          setOrder(data);
        }
      } catch (err) {
        console.warn('Error fetching order:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [orderId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#1e5aa8" />
        </View>
      ) : order ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.badgeRow}>
            <Text style={styles.statusBadge}>
              {order.order_status || order.status || 'Pending'}
            </Text>
            <Text style={styles.paymentBadge}>
              Payment: {order.payment_status || 'Pending'}
            </Text>
          </View>

          <Text style={styles.orderNumber}>
            Order #{order.order_number || order.id?.slice(0, 8)}
          </Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Recipient:</Text>
              <Text style={styles.val}>{order.customer_name || order.client_name || 'Patient'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Total Amount:</Text>
              <Text style={styles.val}>${Number(order.total_amount || order.amount || 0).toFixed(2)}</Text>
            </View>
            {order.tracking_number && (
              <View style={styles.row}>
                <Text style={styles.label}>Tracking #:</Text>
                <Text style={[styles.val, { color: '#0284c7' }]}>{order.tracking_number}</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.label}>Date Placed:</Text>
              <Text style={styles.val}>{order.created_at ? new Date(order.created_at).toLocaleDateString() : 'Recent'}</Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.centerBox}>
          <Text style={styles.notFoundText}>Order record not found.</Text>
        </View>
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
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f2942',
  },
  backBtn: {
    padding: 6,
  },
  backText: {
    fontSize: 15,
    color: '#1e5aa8',
    fontWeight: '600',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paymentBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  orderNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f2942',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    color: '#64748b',
  },
  val: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f2942',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  notFoundText: {
    fontSize: 15,
    color: '#64748b',
  },
});

export default OrderDetailScreen;
