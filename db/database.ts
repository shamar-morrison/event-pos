import AsyncStorage from '@react-native-async-storage/async-storage';
import { POSDatabase, Session, createEmptyDB } from '@/types/pos';

const DB_KEY = '@pos_db_v1';
const SESSION_KEY = '@pos_session_v1';

export async function loadDB(): Promise<POSDatabase> {
  try {
    const raw = await AsyncStorage.getItem(DB_KEY);
    if (!raw) {
      console.log('[DB] No existing database, creating empty');
      return createEmptyDB();
    }
    const db = JSON.parse(raw) as POSDatabase;
    console.log('[DB] Loaded database, schema version:', db.schemaVersion);
    return migrateDB(db);
  } catch (e) {
    console.error('[DB] Failed to load database:', e);
    return createEmptyDB();
  }
}

export async function saveDB(db: POSDatabase): Promise<void> {
  try {
    const raw = JSON.stringify(db);
    await AsyncStorage.setItem(DB_KEY, raw);
    console.log('[DB] Saved database successfully');
  } catch (e) {
    console.error('[DB] Failed to save database:', e);
    throw new Error('Failed to save data. Please try again.');
  }
}

function migrateDB(db: any): POSDatabase {
  let current = { ...db };
  if (!current.schemaVersion) {
    current.schemaVersion = 1;
  }
  if (!current.auditLog) {
    current.auditLog = [];
  }
  if (current.schemaVersion < 2) {
    const admins: Record<string, any> = {};
    if (current.users?.admin && current.users.admin.pinHash) {
      const adminId = 'migrated_admin';
      admins[adminId] = {
        adminId,
        username: 'admin',
        passwordHash: current.users.admin.pinHash,
        createdAt: current.users.admin.createdAt || Date.now(),
      };
      console.log('[DB] Migrated legacy admin to username-based admin');
    }
    current.users = {
      admins,
      cashiers: current.users?.cashiers || {},
    };
    current.schemaVersion = 2;
  }
  if (!current.users.admins) {
    current.users.admins = {};
  }
  return current as POSDatabase;
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session | null): Promise<void> {
  try {
    if (session) {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(SESSION_KEY);
    }
  } catch (e) {
    console.error('[DB] Failed to save session:', e);
  }
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([DB_KEY, SESSION_KEY]);
  console.log('[DB] Cleared all data');
}
