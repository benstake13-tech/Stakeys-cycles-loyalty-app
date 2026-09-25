/**
 * Stakey's Cycles - Firebase Initialization (TypeScript)
 * Firebase v10+ Modular Web SDK
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoBikeShopKeyStakysCycles2026",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "stakeys-cycles-loyalty.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "stakeys-cycles-loyalty",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "stakeys-cycles-loyalty.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "839201948201",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:839201948201:web:9c8d7e6f5a4b3c2d1e0f",
};

export const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

export default app;
