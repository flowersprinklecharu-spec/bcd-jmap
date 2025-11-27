// Firebase initialization and simple helpers for Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';

// Firebase config is best provided via environment variables in React apps.
// See the .env file in the project root.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBsIYF3tx658PRHm-MAY29OCiX2YW_DLR8",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "bcd-jmap-app.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "bcd-jmap-app",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "bcd-jmap-app.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "739759162622",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:739759162622:web:e657a8a42fc620d76491af",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-V81TGY16RK"
};

console.log('Firebase config loaded:', firebaseConfig);

let app;
let db;
let auth;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  console.log('Firebase initialized successfully');
} catch (err) {
  // In development it's fine to console the error — the app should still run without Firebase.
  console.error('Firebase initialization error', err);
}

export { db, auth };

export async function saveAboutContent(content) {
  if (!db) throw new Error('Firestore not initialized');
  try {
    await setDoc(doc(db, 'about', 'content'), content);
  } catch (err) {
    console.error('Failed to save about content', err);
    throw err;
  }
}

export async function saveLandmark(landmark) {
  if (!db) throw new Error('Firestore not initialized');
  try {
    if (landmark.id !== undefined && landmark.id !== null) {
      // Use numeric id as document id (stringified)
      await setDoc(doc(db, 'landmarks', String(landmark.id)), landmark);
    } else {
      await addDoc(collection(db, 'landmarks'), landmark);
    }
  } catch (err) {
    console.error('Failed to save landmark', err);
    throw err;
  }
}

export async function loginWithEmail(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Login successful:', userCredential.user.email);
    return userCredential.user;
  } catch (err) {
    console.error('Login error:', err);
    throw err;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
    console.log('Logout successful');
  } catch (err) {
    console.error('Logout error:', err);
    throw err;
  }
}

export async function deleteRoute(routeId) {
  if (!db) throw new Error('Firestore not initialized');
  try {
    await deleteDoc(doc(db, 'routes', String(routeId)));
  } catch (err) {
    console.error('Failed to delete route', err);
    throw err;
  }
}

export async function deleteLandmark(landmarkId) {
  if (!db) throw new Error('Firestore not initialized');
  try {
    await deleteDoc(doc(db, 'landmarks', String(landmarkId)));
  } catch (err) {
    console.error('Failed to delete landmark', err);
    throw err;
  }
}

export async function deleteAnnouncement(announcementId) {
  if (!db) throw new Error('Firestore not initialized');
  try {
    await deleteDoc(doc(db, 'announcements', String(announcementId)));
  } catch (err) {
    console.error('Failed to delete announcement', err);
    throw err;
  }
}

export async function saveRoute(route) {
  if (!db) throw new Error('Firestore not initialized');
  try {
    if (route.id !== undefined && route.id !== null) {
      await setDoc(doc(db, 'routes', String(route.id)), route);
    } else {
      await addDoc(collection(db, 'routes'), route);
    }
  } catch (err) {
    console.error('Failed to save route', err);
    throw err;
  }
}

export async function saveAnnouncement(announcement) {
  if (!db) throw new Error('Firestore not initialized');
  try {
    if (announcement.id !== undefined && announcement.id !== null) {
      await setDoc(doc(db, 'announcements', String(announcement.id)), announcement);
    } else {
      await addDoc(collection(db, 'announcements'), announcement);
    }
  } catch (err) {
    console.error('Failed to save announcement', err);
    throw err;
  }
}

// Helper to normalize Firestore document data to app-friendly shapes.
// - Converts GeoPoint objects to [lat, lng] arrays when found in `coordinates` or `location` fields.
export function normalizeDocData(doc) {
  if (!doc) return null;
  const data = doc.data ? doc.data() : doc;
  const normalized = { ...data };

  // Helper to convert a GeoPoint to [lat, lng]
  const gpToArr = (gp) => {
    if (!gp) return gp;
    if (typeof gp.latitude === 'number' && typeof gp.longitude === 'number') return [gp.latitude, gp.longitude];
    return gp;
  };

  // Normalize `coordinates`: can be array of GeoPoints or array of [lat,lng]
  if (Array.isArray(normalized.coordinates)) {
    normalized.coordinates = normalized.coordinates.map(item => {
      if (item && typeof item.latitude === 'number' && typeof item.longitude === 'number') {
        return [item.latitude, item.longitude];
      }
      return item;
    });
  }

  // Normalize single `coordinates` GeoPoint -> [lat,lng]
  if (normalized.coordinates && typeof normalized.coordinates.latitude === 'number') {
    normalized.coordinates = gpToArr(normalized.coordinates);
  }

  // Some documents may use `location` instead of `coordinates` for landmarks
  if (normalized.location && typeof normalized.location.latitude === 'number') {
    normalized.coordinates = gpToArr(normalized.location);
    delete normalized.location;
  }

  return normalized;
}
