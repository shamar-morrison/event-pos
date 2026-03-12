import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { posKeys } from '@/hooks/use-pos-data';
import { usePosStore } from '@/store/pos-store';
import { createEmptyStats, type AdminEventListItem } from '@/types/pos';

export default function CreateEventScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createEvent = usePosStore((s) => s.createEvent);
  const pairedAdmin = usePosStore((s) => s.pairedAdmin);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter an event name');
      return;
    }
    setLoading(true);
    try {
      if (!pairedAdmin) {
        throw new Error('This device is not paired to an admin.');
      }

      const eventId = await createEvent(trimmed);
      const now = Date.now();
      queryClient.setQueryData<AdminEventListItem[]>(posKeys.events(pairedAdmin.adminId), (current = []) =>
        [
          {
            eventId,
            name: trimmed,
            startTime: now,
            status: 'draft' as const,
            createdAt: now,
            createdBy: pairedAdmin.adminId,
            defaultPaymentMethod: undefined,
            stats: createEmptyStats(),
            endTime: undefined,
            itemCount: 0,
          },
          ...current.filter((event) => event.eventId !== eventId),
        ].sort((left, right) => right.createdAt - left.createdAt)
      );
      void queryClient.invalidateQueries({ queryKey: posKeys.events(pairedAdmin.adminId) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/admin/event/${eventId}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to create event');
      console.error('[CreateEvent]', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.label}>Event Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Saturday Night Party"
          placeholderTextColor={Colors.textMuted}
          autoFocus
          maxLength={100}
          testID="event-name-input"
        />
        <Text style={styles.hint}>The event will be created as a draft. You can add items and go live later.</Text>

        <TouchableOpacity
          style={[styles.createBtn, (!name.trim() || loading) && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!name.trim() || loading}
          activeOpacity={0.7}
          testID="create-event-submit"
        >
          <Text style={styles.createBtnText}>{loading ? 'Creating...' : 'Create Event'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, flex: 1 },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    fontSize: 17,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  hint: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 32,
  },
  createBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { fontSize: 16, fontWeight: '600' as const, color: Colors.white },
});
