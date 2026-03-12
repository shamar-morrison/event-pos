import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
  bgColor?: string;
}

export default function StatCard({ label, value, icon, color = Colors.primary, bgColor }: StatCardProps) {
  return (
    <View style={[styles.card, bgColor ? { backgroundColor: bgColor } : undefined]}>
      <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    flex: 1,
    minWidth: 140,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  value: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
});
