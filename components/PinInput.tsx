import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Delete } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface PinInputProps {
  length?: number;
  onComplete: (pin: string) => void;
  title?: string;
  subtitle?: string;
  error?: string;
  loading?: boolean;
}

export default function PinInput({
  length = 4,
  onComplete,
  title,
  subtitle,
  error,
  loading,
}: PinInputProps) {
  const [pin, setPin] = useState<string>('');
  const [shakeAnim] = useState(() => new Animated.Value(0));

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  React.useEffect(() => {
    if (error) {
      shake();
      setPin('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [error, shake]);

  const handlePress = useCallback(
    (digit: string) => {
      if (loading) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length >= length) {
        onComplete(newPin);
        setTimeout(() => setPin(''), 300);
      }
    },
    [pin, length, onComplete, loading]
  );

  const handleDelete = useCallback(() => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin((p) => p.slice(0, -1));
  }, [loading]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      <Animated.View
        style={[styles.digitsRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.digitCell,
              i < pin.length && styles.digitCellFilled,
              error ? styles.digitCellError : undefined,
            ]}
          >
            <Text style={styles.digitText}>{pin[i] ?? ''}</Text>
          </View>
        ))}
      </Animated.View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.keypad}>
        {keys.map((key, i) => {
          if (key === '') {
            return <View key={i} style={styles.keyEmpty} />;
          }
          if (key === 'del') {
            return (
              <TouchableOpacity
                key={i}
                style={styles.key}
                onPress={handleDelete}
                testID="pin-delete"
                activeOpacity={0.6}
              >
                <Delete size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={i}
              style={styles.key}
              onPress={() => handlePress(key)}
              testID={`pin-key-${key}`}
              activeOpacity={0.6}
            >
              <Text style={styles.keyText}>{key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
  },
  digitsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  digitCell: {
    width: 52,
    height: 60,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitCellFilled: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primary,
  },
  digitCellError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerBg,
  },
  digitText: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 280,
    marginTop: 24,
  },
  key: {
    width: 80,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
    borderRadius: 16,
    backgroundColor: Colors.card,
  },
  keyEmpty: {
    width: 80,
    height: 64,
    margin: 6,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '500' as const,
    color: Colors.text,
  },
});
