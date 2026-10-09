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

export const AppointmentDetailScreen = ({ appointmentId, onBack }) => {
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetail() {
      if (!appointmentId) return;
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('id', appointmentId)
          .maybeSingle();

        if (!error && data) {
          setAppointment(data);
        }
      } catch (err) {
        console.warn('Error fetching appointment:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [appointmentId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointment Details</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#1e5aa8" />
        </View>
      ) : appointment ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statusBadgeRow}>
            <Text style={styles.statusBadge}>
              {appointment.status || 'Confirmed'}
            </Text>
            <Text style={styles.paymentBadge}>
              Payment: {appointment.payment_status || 'Pending'}
            </Text>
          </View>

          <Text style={styles.serviceTitle}>
            {appointment.protocol_title || appointment.service_name || 'Clinical Treatment Session'}
          </Text>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Patient:</Text>
              <Text style={styles.val}>{appointment.patient_name || appointment.client_name || 'Patient'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Date:</Text>
              <Text style={styles.val}>{appointment.appointment_date || appointment.date || 'TBD'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Time:</Text>
              <Text style={styles.val}>{appointment.appointment_time || appointment.time || 'TBD'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Clinician:</Text>
              <Text style={styles.val}>{appointment.clinician_name || appointment.providerName || 'Staff Specialist'}</Text>
            </View>
            {appointment.notes && (
              <View style={[styles.detailRow, { flexDirection: 'column', gap: 4 }]}>
                <Text style={styles.label}>Clinical Notes:</Text>
                <Text style={styles.val}>{appointment.notes}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.centerBox}>
          <Text style={styles.notFoundText}>Appointment record not found.</Text>
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
  statusBadgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paymentBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  serviceTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f2942',
  },
  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  detailRow: {
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

export default AppointmentDetailScreen;
