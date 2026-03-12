import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getStatusColor, getStatusBgColor } from '@/constants/colors';
import type { EventStatus } from '@/types/pos';

interface StatusBadgeProps {
  status: EventStatus;
  size?: 'small' | 'medium';
}

export default function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
  const color = getStatusColor(status);
  const bgColor = getStatusBgColor(status);

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }, size === 'medium' && styles.badgeMedium]}>
      <View style={[styles.indicator, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }, size === 'medium' && styles.textMedium]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  badgeMedium: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
  },
  textMedium: {
    fontSize: 14,
  },
});