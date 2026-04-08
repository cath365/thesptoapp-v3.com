import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_LOG_KEY = 'auth_diagnostics_v1';
const MAX_ENTRIES = 200;

export interface AuthDiagnosticEntry {
  ts: string;
  event: string;
  details?: Record<string, unknown>;
}

function safeStringify(input: unknown): string {
  try {
    return JSON.stringify(input);
  } catch {
    return '[unserializable]';
  }
}

/** Returns false during SSR / Node server-side render where AsyncStorage is unavailable. */
function canPersist(): boolean {
  try {
    return typeof window !== 'undefined';
  } catch {
    return false;
  }
}

export async function appendAuthDiagnostic(event: string, details?: Record<string, unknown>): Promise<void> {
  const entry: AuthDiagnosticEntry = {
    ts: new Date().toISOString(),
    event,
    details,
  };

  console.log('[AuthDiag]', entry.ts, event, details ? safeStringify(details) : '');

  if (!canPersist()) return;

  try {
    const existing = await AsyncStorage.getItem(AUTH_LOG_KEY);
    const parsed: AuthDiagnosticEntry[] = existing ? JSON.parse(existing) : [];
    parsed.push(entry);
    const trimmed = parsed.slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(AUTH_LOG_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.warn('[AuthDiag] Failed to persist auth diagnostic entry', error);
  }
}

export async function getAuthDiagnostics(): Promise<AuthDiagnosticEntry[]> {
  if (!canPersist()) return [];
  try {
    const existing = await AsyncStorage.getItem(AUTH_LOG_KEY);
    if (!existing) return [];
    const parsed = JSON.parse(existing);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearAuthDiagnostics(): Promise<void> {
  if (!canPersist()) return;
  try {
    await AsyncStorage.removeItem(AUTH_LOG_KEY);
  } catch {
    // no-op
  }
}
