import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@/types/pos';

const SESSION_KEY = '@pos_session_v2';
const LEGACY_DB_KEY = '@pos_db_v1';
const LEGACY_SESSION_KEY = '@pos_session_v1';

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as Session;
    if (!session.adminId) {
      await AsyncStorage.removeItem(SESSION_KEY);
      return null;
    }

    return session;
  } catch (error) {
    console.error('[Session] Failed to load session:', error);
    return null;
  }
}

export async function saveSession(session: Session | null): Promise<void> {
  try {
    if (!session) {
      await AsyncStorage.removeItem(SESSION_KEY);
      return;
    }

    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('[Session] Failed to save session:', error);
  }
}

export async function clearLegacyLocalData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([LEGACY_DB_KEY, LEGACY_SESSION_KEY]);
  } catch (error) {
    console.error('[Session] Failed to clear legacy local data:', error);
  }
}
