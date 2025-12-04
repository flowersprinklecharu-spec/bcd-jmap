#!/usr/bin/env node
/**
 * Dev-only Firestore seeding script.
 *
 * Requirements:
 * - Install firebase-admin: npm install firebase-admin
 * - Provide service account credentials via GOOGLE_APPLICATION_CREDENTIALS env var
 *   (or set SERVICE_ACCOUNT_JSON to the JSON string of the key)
 *
 * Usage:
 *   npm run seed
 *
 * This will write a small set of sample documents to `routes`, `landmarks`, and `announcements`.
 */

const fs = require('fs');
const path = require('path');
const { BACOLOD_ROUTES_POLYLINES } = require('./routeCoordinates');

async function main() {
  let admin;
  try {
    admin = require('firebase-admin');
  } catch (err) {
    console.error('Please install firebase-admin first: npm install firebase-admin');
    process.exit(1);
  }

  // Initialize admin SDK with project ID
  try {
    const projectId = process.env.REACT_APP_FIREBASE_PROJECT_ID || "bcd-jmap-app";
    
    if (process.env.SERVICE_ACCOUNT_JSON) {
      const svc = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ 
        credential: admin.credential.cert(svc),
        projectId: projectId
      });
    } else {
      // Initialize with project ID for development
      admin.initializeApp({
        projectId: projectId
      });
    }
    
    console.log(`Initialized Firebase Admin for project: ${projectId}`);
  } catch (err) {
    console.error('Failed to initialize firebase-admin.');
    console.error('For development, make sure your Firebase project allows development access.');
    console.error(err.message || err);
    process.exit(1);
  }

  const db = admin.firestore();

  // Sample data: All 24 Bacolod LPTRP routes with accurate polyline coordinates
  const sampleRoutes = [
    { id: 1, number: '1', name: 'Banago-Libertad Loop', description: 'Travels from Banago to Libertad via downtown Bacolod, passing through major landmarks including Bacolod Public Plaza and SM City.', fare: '₱11.00 - ₱15.00', color: '#FF5722', majorStops: ['Banago Elem. School', 'Pure Banago', 'Bacolod North Terminal', 'Burgos St.', 'Bacolod Public Plaza', 'SM City Bacolod', 'Lacson St.', 'Libertad Terminal'], coordinates: BACOLOD_ROUTES_POLYLINES[1].coordinates },
    { id: 2, number: '2', name: 'Bata-Libertad Loop', description: 'Connects Bata area to Libertad, passing through Lacson Street and downtown Bacolod.', fare: '₱11.00 - ₱15.00', color: '#2196F3', majorStops: ['Bata', 'Marapara Heights', 'Bacolod Queen of Mercy', 'Lacson St.', 'City Plaza', 'Libertad Terminal'], coordinates: BACOLOD_ROUTES_POLYLINES[2].coordinates },
    { id: 3, number: '3', name: 'Northbound Terminal-Libertad Loop', description: 'Links the Northbound Terminal to Libertad area via city center.', fare: '₱11.00 - ₱15.00', color: '#4CAF50', majorStops: ['Northbound Terminal', 'Araneta St.', 'City Hall', 'Lacson St.', 'Public Plaza', 'Libertad Terminal'], coordinates: BACOLOD_ROUTES_POLYLINES[3].coordinates },
    { id: 4, number: '4', name: 'Pepsi-Bata-Bacolod Government Center Loop', description: 'Connects Pepsi area to Bata and Bacolod Government Center via downtown.', fare: '₱11.00 - ₱15.00', color: '#E91E63', majorStops: ['Pepsi Terminal', 'Mandalagan', 'Government Center', 'City Plaza', 'Bata Terminal'], coordinates: BACOLOD_ROUTES_POLYLINES[4].coordinates },
    { id: 5, number: '5', name: 'Shopping-Northbound Terminal Loop', description: 'Links Shopping area to the Northbound Terminal via major commercial districts.', fare: '₱11.00 - ₱15.00', color: '#FFEB3B', majorStops: ['Shopping Area', 'SM City', 'Robinsons Place', 'City Plaza', 'Northbound Terminal'], coordinates: BACOLOD_ROUTES_POLYLINES[5].coordinates },
    { id: 6, number: '6', name: 'Shopping-Libertad Via La Salle Loop', description: 'Connects Shopping area to Libertad passing through La Salle University.', fare: '₱11.00 - ₱15.00', color: '#00BCD4', majorStops: ['Shopping Area', 'La Salle University', 'Doctor\'s Hospital', 'Lacson St.', 'City Center', 'Libertad Terminal'], coordinates: BACOLOD_ROUTES_POLYLINES[6].coordinates },
    { id: 7, number: '7', name: 'Shopping-Libertad Via San Agustin Loop', description: 'Routes from Shopping to Libertad via San Agustin area.', fare: '₱11.00 - ₱15.00', color: '#673AB7', majorStops: ['Shopping Area', 'San Agustin', 'Mayfair Plaza', 'City Plaza', 'Libertad Terminal'], coordinates: BACOLOD_ROUTES_POLYLINES[7].coordinates },
    { id: 8, number: '8', name: 'Eroreco-Central Market Loop', description: 'Connects Eroreco subdivision to Central Market area.', fare: '₱11.00 - ₱15.00', color: '#FF9800', majorStops: ['Eroreco Subd.', 'Valley of Peace', 'Triangle Island Plaza', 'Central Market', 'City Plaza'], coordinates: BACOLOD_ROUTES_POLYLINES[8].coordinates },
    { id: 9, number: '9', name: 'Punta Taytay-Fr. Ferrero St. Loop', description: 'Services Punta Taytay area to downtown via Fr. Ferrero Street.', fare: '₱11.00 - ₱15.00', color: '#F44336', majorStops: ['Punta Taytay', 'Banaga Tomaro', 'Burgos St.', 'Central Market', 'City Plaza'], coordinates: BACOLOD_ROUTES_POLYLINES[9].coordinates },
    { id: 10, number: '10', name: 'Tangub-South Capitol Rd Loop', description: 'Connects Tangub to downtown via South Capitol Road.', fare: '₱11.00 - ₱15.00', color: '#8BC34A', majorStops: ['Tangub', 'South Capitol', 'Ayala Mall Capitol Central', 'Central Market', 'City Plaza'], coordinates: BACOLOD_ROUTES_POLYLINES[10].coordinates },
    { id: 11, number: '11', name: 'Airport Subd-South Capitol Rd Loop', description: 'Services Airport Subdivision to South Capitol Road area.', fare: '₱11.00 - ₱15.00', color: '#9C27B0', majorStops: ['Airport Subd.', 'South Capitol', 'Central Market', 'City Plaza'], coordinates: BACOLOD_ROUTES_POLYLINES[11].coordinates },
    { id: 12, number: '12', name: 'Taculing-Central Market Loop', description: 'Connects Taculing area to Central Market and downtown.', fare: '₱11.00 - ₱15.00', color: '#795548', majorStops: ['Taculing', 'BBB Checkpoint', 'BREDCO Port', 'Central Market', 'City Plaza'], coordinates: BACOLOD_ROUTES_POLYLINES[12].coordinates },
    { id: 13, number: '13', name: 'Alijis (RPHS)-Central Market Loop', description: 'Services Alijis area including RPHS to Central Market.', fare: '₱11.00 - ₱15.00', color: '#00BCD4', majorStops: ['Alijis RPHS', 'Banago', 'Central Market', 'City Plaza'], coordinates: BACOLOD_ROUTES_POLYLINES[13].coordinates },
    { id: 14, number: '14', name: 'Handumanan-Libertad Via Mansilingan Loop', description: 'Connects Handumanan to Libertad via Mansilingan area.', fare: '₱11.00 - ₱15.00', color: '#4CAF50', majorStops: ['Handumanan', 'Mansilingan', 'Central Market', 'City Plaza', 'Libertad Terminal'], coordinates: BACOLOD_ROUTES_POLYLINES[14].coordinates },
    { id: 15, number: '15', name: 'Paglaum Village-Libertad Loop', description: 'Services Paglaum Village area to Libertad downtown.', fare: '₱11.00 - ₱15.00', color: '#E91E63', majorStops: ['Paglaum Village', 'Don Antonio Jayme ES', 'Vista Alegre', 'Central Market', 'Libertad Terminal'], coordinates: BACOLOD_ROUTES_POLYLINES[15].coordinates },
    { id: 16, number: '16', name: 'Mansilingan-Central Market Via City Heights Loop', description: 'Connects Mansilingan to Central Market via City Heights.', fare: '₱11.00 - ₱15.00', color: '#9E9E9E', majorStops: ['Mansilingan', 'City Heights', 'Central Market', 'City Plaza'], coordinates: BACOLOD_ROUTES_POLYLINES[16].coordinates },
    { id: 17, number: '17', name: 'Fortune Town/Estefania-Central Market Loop', description: 'Services Fortune Town and Estefania to Central Market.', fare: '₱11.00 - ₱15.00', color: '#FFC107', majorStops: ['Fortune Town', 'Estefania', 'Central Market', 'City Plaza'], coordinates: BACOLOD_ROUTES_POLYLINES[17].coordinates },
    { id: 18, number: '18', name: 'Granada-Burgos', description: 'Connects Granada area to Burgos Street downtown.', fare: '₱11.00 - ₱15.00', color: '#FF5722', majorStops: ['Granada', 'SM Bacolod South Wing', 'Central Market', 'Burgos St.'], coordinates: BACOLOD_ROUTES_POLYLINES[18].coordinates },
    { id: 19, number: '19', name: 'Alangilan-Burgos', description: 'Services Alangilan area to Burgos Street.', fare: '₱11.00 - ₱15.00', color: '#9C27B0', majorStops: ['Alangilan', 'Yulo\'s Park', 'Central Market', 'Burgos St.'], coordinates: BACOLOD_ROUTES_POLYLINES[19].coordinates },
    { id: 20, number: '20', name: 'San Dionisio-Market Loop', description: 'Connects San Dionisio to Market area.', fare: '₱11.00 - ₱15.00', color: '#00BCD4', majorStops: ['San Dionisio', 'Bacolod South Terminal', 'Public Market', 'Central Market'], coordinates: BACOLOD_ROUTES_POLYLINES[20].coordinates },
    { id: 21, number: '21', name: 'PHHC (Homesite)-Central Market Loop', description: 'Services PHHC Homesite to Central Market.', fare: '₱11.00 - ₱15.00', color: '#3F51B5', majorStops: ['PHHC Homesite', 'Montevista/Homesite PHHC', 'Public Market', 'Central Market'], coordinates: BACOLOD_ROUTES_POLYLINES[21].coordinates },
    { id: 22, number: '22', name: 'Doña Juliana-Central Market Loop', description: 'Connects Doña Juliana area to Central Market.', fare: '₱11.00 - ₱15.00', color: '#FFC107', majorStops: ['Doña Juliana', 'Upper East', 'Gonzaga Street', 'Central Market'], coordinates: BACOLOD_ROUTES_POLYLINES[22].coordinates },
    { id: 23, number: '23', name: 'Bredco Port-Northbound Terminal Via San Juan Loop', description: 'Connects Bredco Port to Northbound Terminal via San Juan.', fare: '₱11.00 - ₱15.00', color: '#00BCD4', majorStops: ['BREDCO Port', 'Baliwag City Bacolod', 'San Juan', 'Central Market', 'Northbound Terminal'], coordinates: BACOLOD_ROUTES_POLYLINES[23].coordinates },
    { id: 24, number: '24', name: 'Pahanocoy (CEGASCO)-BGC Via Circumferential Rd. Loop', description: 'Services Pahanocoy CEGASCO to BGC via Circumferential Road.', fare: '₱11.00 - ₱15.00', color: '#E91E63', majorStops: ['Pahanocoy CEGASCO', 'Banago (Mandalagan)', 'Circumferential Road', 'BGC', 'Central Market'], coordinates: BACOLOD_ROUTES_POLYLINES[24].coordinates }
  ];

  const sampleLandmarks = [
    { id: 101, name: 'Bacolod Public Plaza', description: 'Historic public plaza at the city center, popular gathering spot', category: 'Recreation', icon: 'P', iconColor: '#FF5722', location: new admin.firestore.GeoPoint(10.6772, 122.9576), address: 'Downtown Bacolod', suggestedRoutes: [1, 2, 3] },
    { id: 102, name: 'SM City Bacolod', description: 'Large shopping mall with retail, dining, and entertainment', category: 'Malls', icon: 'S', iconColor: '#2196F3', location: new admin.firestore.GeoPoint(10.6779, 122.9570), address: 'Gatuslao St, Bacolod', suggestedRoutes: [1, 5, 6] },
    { id: 103, name: 'La Salle University', description: 'Major educational institution in Bacolod', category: 'Schools', icon: 'U', iconColor: '#4CAF50', location: new admin.firestore.GeoPoint(10.6800, 122.9500), address: 'Lacson St, Bacolod', suggestedRoutes: [6, 7] },
    { id: 104, name: 'Robinsons Place Bacolod', description: 'Shopping mall with various stores and restaurants', category: 'Malls', icon: 'R', iconColor: '#E91E63', location: new admin.firestore.GeoPoint(10.6750, 122.9600), address: 'Araneta St, Bacolod', suggestedRoutes: [5] },
    { id: 105, name: 'Central Market', description: 'Bustling market with fresh produce and local goods', category: 'Recreation', icon: 'M', iconColor: '#FFEB3B', location: new admin.firestore.GeoPoint(10.6550, 122.9650), address: 'Central Bacolod', suggestedRoutes: [8, 9, 10] },
    { id: 106, name: 'Bacolod City Hospital', description: 'Major government hospital facility', category: 'Hospitals', icon: 'H', iconColor: '#00BCD4', location: new admin.firestore.GeoPoint(10.6720, 122.9480), address: 'Lacson St, Bacolod', suggestedRoutes: [1, 3] },
    { id: 107, name: 'Ayala Mall Capitol Central', description: 'Modern shopping and dining destination', category: 'Malls', icon: 'A', iconColor: '#673AB7', location: new admin.firestore.GeoPoint(10.6600, 122.9700), address: 'South Capitol Rd, Bacolod', suggestedRoutes: [10, 11] },
    { id: 108, name: 'The Ruins', description: 'Historic mansion ruins, popular tourist attraction', category: 'Recreation', icon: 'T', iconColor: '#FF9800', location: new admin.firestore.GeoPoint(10.5700, 122.8900), address: 'Talisay, Negros Occidental', suggestedRoutes: [] },
    { id: 109, name: 'Masferre Restaurant', description: 'Popular restaurant serving local cuisine', category: 'Restaurants', icon: 'F', iconColor: '#F44336', location: new admin.firestore.GeoPoint(10.6700, 122.9550), address: 'Lacson St, Bacolod', suggestedRoutes: [1, 6] },
    { id: 110, name: 'Government Center', description: 'Government administrative buildings and offices', category: 'Recreation', icon: 'G', iconColor: '#8BC34A', location: new admin.firestore.GeoPoint(10.6720, 122.9450), address: 'Downtown Bacolod', suggestedRoutes: [4] }
  ];

  const sampleAnnouncements = [
    { id: 'a1', title: 'Welcome to JMap', description: 'Your guide to Bacolod jeepney routes and landmarks. Navigate the city with ease!', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'a2', title: 'New Route Added', description: 'Route 24 (Pahanocoy-BGC) now available with extended hours. Service starts 5:30 AM daily.', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'a3', title: 'Maintenance Announcement', description: 'Routes 8 and 12 will have reduced frequency on Nov 15 due to road maintenance.', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'a4', title: 'Holiday Schedule Update', description: 'All routes operating with modified schedules during the holiday season. Check individual route details.', date: new Date().toISOString() }
  ];

  try {
    console.log('Skipping routes seeding - routes will be added manually...');
    // Routes seeding disabled - add routes manually via admin interface for accurate coordinates
    // for (const r of sampleRoutes) {
    //   const ref = db.collection('routes').doc(String(r.id));
    //   await ref.set(r);
    //   console.log('  wrote route', r.id);
    // }

    console.log('Seeding landmarks...');
    for (const lm of sampleLandmarks) {
      const ref = db.collection('landmarks').doc(String(lm.id));
      await ref.set(lm);
      console.log('  wrote landmark', lm.id);
    }

    console.log('Seeding announcements...');
    for (const an of sampleAnnouncements) {
      const ref = db.collection('announcements').doc(String(an.id));
      await ref.set(an);
      console.log('  wrote announcement', an.id);
    }

    console.log('\nSeeding complete.');
    console.log('Check your Firestore console to confirm documents were created.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

main();
