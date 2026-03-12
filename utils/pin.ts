import * as Crypto from 'expo-crypto';

const SALT = '_eventpos_pin_salt_v1';
const PASSWORD_SALT = '_eventpos_pwd_salt_v1';

export async function hashPin(pin: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + SALT
  );
  return digest;
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const computed = await hashPin(pin);
  return computed === storedHash;
}

export function validatePinFormat(pin: string): string | null {
  if (!/^\d{4,6}$/.test(pin)) {
    return 'PIN must be 4-6 digits';
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password + PASSWORD_SALT
  );
  return digest;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === storedHash;
}

export function validatePassword(password: string): string | null {
  if (password.length < 4) {
    return 'Password must be at least 4 characters';
  }
  if (password.length > 64) {
    return 'Password must be 64 characters or less';
  }
  return null;
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (trimmed.length < 2) {
    return 'Username must be at least 2 characters';
  }
  if (trimmed.length > 32) {
    return 'Username must be 32 characters or less';
  }
  if (!/^[a-zA-Z0-9_\-. ]+$/.test(trimmed)) {
    return 'Username can only contain letters, numbers, spaces, and _-.';
  }
  return null;
}
