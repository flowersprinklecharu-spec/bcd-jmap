#!/usr/bin/env node
/**
 * Dev-only Firestore seeding script using client SDK
 * This works without service account credentials
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, writeBatch } = require('firebase/firestore');
const { BACOLOD_ROUTES_POLYLINES } = require('./routeCoordinates');

// Use the same config as the React app
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBsIYF3tx658PRHm-MAY29OCiX2YW_DLR8",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "bcd-jmap-app.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "bcd-jmap-app",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "bcd-jmap-app.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "739759162622",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:739759162622:web:e657a8a42fc620d76491af"
};

async function main() {
  try {
    console.log('Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('Connected to Firestore successfully!');

    // Sample data: All 24 Bacolod LPTRP routes
    const sampleRoutes = [
      { id: 1, number: '1', name: 'Banago-Libertad Loop', description: 'Travels from Banago to Libertad via downtown Bacolod, passing through major landmarks including Bacolod Public Plaza and SM City.', fare: '₱11.00 - ₱15.00', color: '#FF5722', majorStops: ['Banago Elem. School', 'Pure Banago', 'Bacolod North Terminal', 'Burgos St.', 'Bacolod Public Plaza', 'SM City Bacolod', 'Lacson St.', 'Libertad Terminal'], coordinates: BACOLOD_ROUTES_POLYLINES[1].coordinates },
      { id: 2, number: '2', name: 'Bata-Libertad Loop', description: 'Connects Bata area to Libertad, passing through Lacson Street and downtown Bacolod.', fare: '₱11.00 - ₱15.00', color: '#2196F3', majorStops: ['Bata', 'Marapara Heights', 'Bacolod Queen of Mercy', 'Lacson St.', 'City Plaza', 'Libertad Terminal'], coordinates: BACOLOD_ROUTES_POLYLINES[2].coordinates },
      { id: 3, number: '3', name: 'Northbound Terminal-Libertad Loop', description: 'Links the Northbound Terminal to Libertad area via city center.', fare: '₱11.00 - ₱15.00', color: '#4CAF50', majorStops: ['Northbound Terminal', 'Araneta St.', 'City Hall', 'Lacson St.', 'Public Plaza', 'Libertad Terminal'], coordinates: BACOLOD_ROUTES_POLYLINES[3].coordinates }
    ];

    console.log('Seeding routes...');
    const batch = writeBatch(db);
    
    sampleRoutes.forEach(route => {
      const routeRef = doc(db, 'routes', route.id.toString());
      // Convert coordinates array to Firestore-compatible format
      const routeData = {
        ...route,
        coordinates: route.coordinates.map(coord => ({
          lat: coord[0],
          lng: coord[1]
        }))
      };
      batch.set(routeRef, routeData);
    });

    await batch.commit();
    console.log(`✅ Successfully seeded ${sampleRoutes.length} routes!`);

    // Seed some landmarks
    console.log('Seeding landmarks...');
    const landmarks = [
      { id: 1, name: 'Bacolod Public Plaza', description: 'Historic city center and main plaza of Bacolod', coordinates: { lat: 10.6745, lng: 122.9542 }, category: 'Historical' },
      { id: 2, name: 'SM City Bacolod', description: 'Major shopping mall and commercial center', coordinates: { lat: 10.6780, lng: 122.9507 }, category: 'Shopping' },
      { id: 3, name: 'The Ruins', description: 'Famous historical mansion ruins in Talisay', coordinates: { lat: 10.7319, lng: 123.0150 }, category: 'Tourist Attraction' }
    ];

    const landmarkBatch = writeBatch(db);
    landmarks.forEach(landmark => {
      const landmarkRef = doc(db, 'landmarks', landmark.id.toString());
      landmarkBatch.set(landmarkRef, landmark);
    });

    await landmarkBatch.commit();
    console.log(`✅ Successfully seeded ${landmarks.length} landmarks!`);

    console.log('🎉 Database seeding completed successfully!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

main();