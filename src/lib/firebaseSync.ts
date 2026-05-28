import React, { useEffect, useRef } from 'react';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  onSnapshot, 
  writeBatch, 
  getDocs 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let app;
export let db: any = null;
export let auth: any = null;
export let isFirebaseActive = false;

// Global sync registry to track all active sync hooks
const syncRegistry = new Map<string, {
  localState: any[];
  localStateRef: React.MutableRefObject<any[]>;
  isInitialLoadRef: React.MutableRefObject<boolean>;
  lastIncomingStrRef: React.MutableRefObject<string>;
}>();

export let syncStatus = {
  isSyncing: false,
  itemsSynced: 0,
  collectionsQueued: 0,
  lastSyncTime: null as Date | null,
  error: null as string | null,
};

export const setSyncStatus = (status: Partial<typeof syncStatus>) => {
  syncStatus = { ...syncStatus, ...status };
};

export const triggerFullSync = async () => {
  if (!isFirebaseActive) {
    console.warn('🚫 Firebase is not active, skipping sync.');
    return;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.warn('🚫 Browser is offline, cannot sync to Firebase.');
    return;
  }

  setSyncStatus({ isSyncing: true, error: null, itemsSynced: 0 });
  let totalSynced = 0;

  try {
    for (const [collectionName, syncData] of syncRegistry) {
      try {
        const colRef = collection(db, collectionName);
        const snapshot = await getDocs(colRef);

        const dbIds = new Set<string>();
        snapshot.forEach((doc) => dbIds.add(doc.id));

        const batch = writeBatch(db);
        let count = 0;

        syncData.localStateRef.current.forEach((item) => {
          const itemDocRef = doc(db, collectionName, item.id);
          batch.set(itemDocRef, item);
          count++;
        });

        dbIds.forEach((id) => {
          if (!syncData.localStateRef.current.some((item) => item.id === id)) {
            const itemDocRef = doc(db, collectionName, id);
            batch.delete(itemDocRef);
            count++;
          }
        });

        if (count > 0) {
          await batch.commit();
          totalSynced += count;
          console.log(`✅ Synced ${count} items in "${collectionName}" to Firestore`);
        }
      } catch (err) {
        console.error(`Error syncing collection "${collectionName}":`, err);
      }
    }

    setSyncStatus({
      isSyncing: false,
      itemsSynced: totalSynced,
      lastSyncTime: new Date(),
      error: null
    });
    console.log(`✨ Full sync complete! ${totalSynced} total items synced.`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    setSyncStatus({ isSyncing: false, error: errorMsg });
    console.error('Full sync failed:', err);
  }
};

// Safe Firebase Initializer
try {
  const isMock = firebaseConfig.apiKey.includes('mock-api-key');
  if (!isMock && firebaseConfig.projectId && firebaseConfig.projectId !== 'placeholder') {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
    isFirebaseActive = true;
    console.log('🔥 Firebase successfully initialized for Equiprime Inventory Portal.');

    // CRITICAL: Validate Connection as per instruction
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  } else {
    console.warn('⚠️ Firebase in mock/placeholder mode since terms have not been accepted yet. Falling back to robust LocalStorage state preservation.');
  }
} catch (err) {
  console.error('⚠️ Could not initialize Firebase:', err);
}

// Mandatory Compliant Firestore Error Handler
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Simple deterministic helper to tell if two objects lists are identical
function areListsEqual<T extends { id: string }>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x.id.localeCompare(y.id));
  const sortedB = [...b].sort((x, y) => x.id.localeCompare(y.id));
  return JSON.stringify(sortedA) === JSON.stringify(sortedB);
}

// Bidirectional Real-time background sync hook
export function useFirebaseCollectionSync<T extends { id: string }>(
  collectionName: string,
  localState: T[],
  setLocalState: React.Dispatch<React.SetStateAction<T[]>>,
  initialSeed: T[]
) {
  const localStateRef = useRef<T[]>(localState);
  const isInitialLoadRef = useRef(true);
  const lastIncomingStrRef = useRef<string>('');

  useEffect(() => {
    localStateRef.current = localState;
  }, [localState]);

  // Register this collection in the sync registry
  useEffect(() => {
    syncRegistry.set(collectionName, {
      localState,
      localStateRef,
      isInitialLoadRef,
      lastIncomingStrRef
    });

    return () => {
      syncRegistry.delete(collectionName);
    };
  }, [collectionName]);

  // Firestore Snapshot Subscriber (Remote Incoming)
  useEffect(() => {
    if (!isFirebaseActive) return;

    console.log(`📡 Connecting background sync listener on collection: "${collectionName}"`);
    const colRef = collection(db, collectionName);

    const unsubscribe = onSnapshot(
      colRef,
      async (snapshot) => {
        const incomingData: T[] = [];
        snapshot.forEach((d) => {
          incomingData.push(d.data() as T);
        });

        const incomingSorted = [...incomingData].sort((x, y) => x.id.localeCompare(y.id));
        const incomingStr = JSON.stringify(incomingSorted);

        // 1. Seed empty database with previous local cache or fallback template data
        if (snapshot.empty && isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
          const seedData = localStateRef.current.length > 0 ? localStateRef.current : initialSeed;
          if (seedData.length > 0) {
            console.log(`🌱 Seeding empty "${collectionName}" with ${seedData.length} entries.`);
            try {
              const batch = writeBatch(db);
              seedData.forEach((item) => {
                const itemDocRef = doc(db, collectionName, item.id);
                batch.set(itemDocRef, item);
              });
              await batch.commit();
            } catch (err) {
              console.error(`Error during batch seed operation for ${collectionName}:`, err);
            }
          }
          return;
        }

        isInitialLoadRef.current = false;

        // 2. If incoming state represents what is already active, skip re-renders
        if (areListsEqual(incomingData, localStateRef.current)) {
          lastIncomingStrRef.current = incomingStr;
          return;
        }

        console.log(`♻️ Sync In: Merging changes on "${collectionName}" from Firestore (${incomingData.length} records)`);
        lastIncomingStrRef.current = incomingStr;
        setLocalState(incomingData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, collectionName);
      }
    );

    return unsubscribe;
  }, [collectionName, setLocalState, initialSeed]);

  // Simple browser online helper
function isBrowserOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

// Local React State Observer (Remote Outgoing)
  useEffect(() => {
    if (!isFirebaseActive) return;
    if (isInitialLoadRef.current) return;
    if (!isBrowserOnline()) {
      console.warn(`⚠️ Firebase sync paused for "${collectionName}" while offline.`);
      return;
    }

    const sortedLocal = [...localState].sort((x, y) => x.id.localeCompare(y.id));
    const localStr = JSON.stringify(sortedLocal);

    // Skip redundancies
    if (localStr === lastIncomingStrRef.current) {
      return;
    }

    const syncOutToFirestore = async () => {
      try {
        const colRef = collection(db, collectionName);
        const snapshot = await getDocs(colRef);

        const dbIds = new Set<string>();
        snapshot.forEach((doc) => dbIds.add(doc.id));

        const batch = writeBatch(db);
        let count = 0;

        // Upsert operations
        localState.forEach((item) => {
          const itemDocRef = doc(db, collectionName, item.id);
          batch.set(itemDocRef, item);
          count++;
        });

        // Removal operations
        dbIds.forEach((id) => {
          if (!localState.some((item) => item.id === id)) {
            const itemDocRef = doc(db, collectionName, id);
            batch.delete(itemDocRef);
            count++;
          }
        });

        if (count > 0) {
          await batch.commit();
          console.log(`📤 Sync Out: Committed ${count} mutations to Firestore for "${collectionName}"`);
        }

        lastIncomingStrRef.current = localStr;
      } catch (err) {
        console.error(`Error during batch sync out for ${collectionName}:`, err);
      }
    };

    // Debounce potential reactive typing updates quickly
    const timer = setTimeout(() => {
      syncOutToFirestore();
    }, 300);

    return () => clearTimeout(timer);
  }, [localState, collectionName]);

  useEffect(() => {
    if (!isFirebaseActive) return;
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      if (isInitialLoadRef.current) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      console.log(`🔄 Browser came back online, triggering full database sync...`);
      triggerFullSync();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);
}

