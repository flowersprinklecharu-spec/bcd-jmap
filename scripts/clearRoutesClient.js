import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBsIYF3tx658PRHm-MAY29OCiX2YW_DLR8",
  authDomain: "bcd-jmap-app.firebaseapp.com",
  projectId: "bcd-jmap-app",
  storageBucket: "bcd-jmap-app.firebasestorage.app",
  messagingSenderId: "739759162622",
  appId: "1:739759162622:web:e657a8a42fc620d76491af",
  measurementId: "G-V81TGY16RK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearAllRoutes() {
  try {
    console.log('Fetching all routes from Firestore...');
    
    const routesCollection = collection(db, 'routes');
    const snapshot = await getDocs(routesCollection);
    
    if (snapshot.empty) {
      console.log('No routes found in the database.');
      return;
    }

    console.log(`Found ${snapshot.size} routes to delete.`);
    
    const deletePromises = [];
    snapshot.forEach(routeDoc => {
      console.log(`Deleting route ${routeDoc.id}...`);
      deletePromises.push(deleteDoc(doc(db, 'routes', routeDoc.id)));
    });

    await Promise.all(deletePromises);
    
    console.log(`✅ Successfully deleted ${snapshot.size} routes from the database.`);
    
  } catch (error) {
    console.error('❌ Failed to clear routes:', error);
  }
}

// Run the function
clearAllRoutes();