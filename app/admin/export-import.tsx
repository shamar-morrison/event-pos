import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Download, Upload, FileText } from 'lucide-react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePosStore } from '@/store/pos-store';
import { formatMoney } from '@/utils/money';

export default function ExportImportScreen() {
  const { db, getEventExportJSON, importEventFromJSON } = usePosStore();
  const [importJson, setImportJson] = useState('');
  const [importing, setImporting] = useState(false);

  const events = useMemo(
    () => Object.values(db.events).sort((a, b) => b.createdAt - a.createdAt),
    [db.events]
  );

  const handleExport = async (eventId: string) => {
    try {
      const json = getEventExportJSON(eventId);
      if (!json) {
        Alert.alert('Error', 'Event not found');
        return;
      }

      const event = db.events[eventId];
      const filename = `event_${event?.name?.replace(/[^a-zA-Z0-9]/g, '_') ?? eventId}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'File downloaded');
      } else {
        const file = new File(Paths.cache, filename);
        file.create({ overwrite: true });
        file.write(json);
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Event Data',
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('[Export]', e);
      Alert.alert('Error', 'Failed to export event data');
    }
  };

  const handleImport = async () => {
    const trimmed = importJson.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please paste event JSON data');
      return;
    }
    setImporting(true);
    try {
      const newId = await importEventFromJSON(trimmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `Event imported successfully (ID: ${newId.slice(0, 8)}...)`);
      setImportJson('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON data';
      Alert.alert('Import Error', msg);
    } finally {
      setImporting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>Export Event Data</Text>
      <Text style={styles.description}>
        Export an event's complete data (items, orders, stats) as a JSON file.
      </Text>

      {events.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No events to export</Text>
        </View>
      ) : (
        <View style={styles.eventList}>
          {events.map((event) => (
            <View key={event.eventId} style={styles.exportCard}>
              <View style={styles.exportInfo}>
                <Text style={styles.exportName} numberOfLines={1}>{event.name}</Text>
                <Text style={styles.exportMeta}>
                  {event.stats.totalOrders} orders · {formatMoney(event.stats.totalRevenue)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.exportBtn}
                onPress={() => handleExport(event.eventId)}
              >
                <Download size={16} color={Colors.primary} />
                <Text style={styles.exportBtnText}>Export</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Import Event Data</Text>
      <Text style={styles.description}>
        Paste exported JSON data below to import an event. It will be imported as a new closed event.
      </Text>

      <TextInput
        style={styles.importInput}
        value={importJson}
        onChangeText={setImportJson}
        placeholder="Paste JSON data here..."
        placeholderTextColor={Colors.textMuted}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.importBtn, (!importJson.trim() || importing) && styles.importBtnDisabled]}
        onPress={handleImport}
        disabled={!importJson.trim() || importing}
      >
        <Upload size={16} color={Colors.white} />
        <Text style={styles.importBtnText}>{importing ? 'Importing...' : 'Import Event'}</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 8 },
  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  eventList: { gap: 8 },
  exportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
  },
  exportInfo: { flex: 1, marginRight: 12 },
  exportName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  exportMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primaryBg,
  },
  exportBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.primary },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 28,
  },
  importInput: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 120,
    marginBottom: 16,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  importBtnDisabled: { opacity: 0.4 },
  importBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
});
