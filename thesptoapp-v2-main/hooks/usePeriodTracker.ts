import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    updateDoc
} from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

export interface Cycle {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD
  avgCycleLength: number;
  periodLength: number;
}

export interface DailyLog {
  id: string;
  date: string; // YYYY-MM-DD
  symptoms: string[];
  notes?: string;
}

export function usePeriodTracker() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Combined loading state — only false when both queries have resolved
  const loading = cyclesLoading || logsLoading;

  // Fetch cycles
  useEffect(() => {
    if (!user) {
      setCyclesLoading(false);
      return;
    }
    setCyclesLoading(true);
    const q = query(
      collection(db, `users/${user.uid}/cycles`),
      orderBy('startDate', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setCycles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Cycle)));
      setCyclesLoading(false);
    }, err => {
      if (err.code !== 'permission-denied' && !err.message?.includes('permission')) {
        setError(err.message);
      }
      setCyclesLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Fetch logs
  useEffect(() => {
    if (!user) {
      setLogsLoading(false);
      return;
    }
    setLogsLoading(true);
    const q = query(
      collection(db, `users/${user.uid}/logs`),
      orderBy('date', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyLog)));
      setLogsLoading(false);
    }, err => {
      if (err.code !== 'permission-denied' && !err.message?.includes('permission')) {
        setError(err.message);
      }
      setLogsLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Add or update a cycle
  const addOrUpdateCycle = useCallback(async (cycle: Omit<Cycle, 'id'>, id?: string) => {
    if (!user) {
      const message = 'You must be signed in to save cycle data.';
      setError(message);
      throw new Error(message);
    }
    try {
      setError(null);
      if (id) {
        await updateDoc(doc(db, `users/${user.uid}/cycles`, id), cycle);
      } else {
        await addDoc(collection(db, `users/${user.uid}/cycles`), cycle);
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [user]);

  // Log a day (symptoms/notes)
  const logDay = useCallback(async (log: Omit<DailyLog, 'id'>) => {
    if (!user) {
      const message = 'You must be signed in to save log data.';
      setError(message);
      throw new Error(message);
    }
    try {
      setError(null);
      await setDoc(doc(db, `users/${user.uid}/logs`, log.date), log);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [user]);

  // Clear all cycles and logs
  const clearAll = useCallback(async () => {
    if (!user) {
      const message = 'You must be signed in to clear data.';
      setError(message);
      throw new Error(message);
    }
    try {
      setError(null);
      const cyclesSnap = await getDocs(collection(db, `users/${user.uid}/cycles`));
      const logsSnap = await getDocs(collection(db, `users/${user.uid}/logs`));
      await Promise.all([
        ...cyclesSnap.docs.map(d => deleteDoc(d.ref)),
        ...logsSnap.docs.map(d => deleteDoc(d.ref)),
      ]);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [user]);

  return {
    cycles,
    logs,
    loading,
    error,
    addOrUpdateCycle,
    logDay,
    clearAll,
  };
} 