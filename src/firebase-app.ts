import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type User as FirebaseUser } from 'firebase/auth';

// Firebase web configuration is public by design. Restrict this key to the
// production domains in Google Cloud; it is not an authorization mechanism.
const firebaseConfig = {
  apiKey: 'AIzaSyBF2sweJQHuc_I3S71dPjw0_5pEUQOzuu8',
  authDomain: 'representapro-b84c3.firebaseapp.com',
  projectId: 'representapro-b84c3',
  storageBucket: 'representapro-b84c3.firebasestorage.app',
  messagingSenderId: '948207221757',
  appId: '1:948207221757:web:be1da69bbe4490076af794',
  measurementId: 'G-K4P1RYCKW5',
};

export const SYSTEM_ADMIN_EMAIL = 'rockstaraki2@gmail.com';
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

export function isSystemAdminAccount(user: FirebaseUser | null | undefined): boolean {
  return Boolean(user?.emailVerified && user.email?.toLowerCase() === SYSTEM_ADMIN_EMAIL);
}
