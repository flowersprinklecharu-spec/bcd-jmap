// Quick script to examine the structure of Route 2's majorStops
// Run this in the browser console on the Routes page after Route 2 has loaded

// Paste this in the console to see the actual structure:
/*
// Check the routes stored in Redux/state
const routesContainer = document.querySelector('[data-testid="routes-list"]') || document.body;
console.table(window.__routesData); // if exposed
*/

// Or better - check what the console logs show when routes load
// Look for: "📦 Route loaded from Firestore:" and check the majorStops structure

console.log(`
=== TO EXAMINE ROUTE 2 DATA ===
1. Open browser DevTools (F12)
2. Go to Console tab
3. On the Routes page, look for logs that say "📦 Route loaded from Firestore:"
4. Find Route 2 (number: '2')
5. Expand the object and check:
   - majorStops (what type? strings? objects?)
   - Each stop in majorStops (does it have {name, lat, lng}? or just a string?)
   - coordinates format ([lat,lng]? or {lat,lng}? or [lat,lng,...]?)

=== EXPECTED STRUCTURES ===
Option A - Strings only (no coordinates):
  majorStops: ['Stop Name 1', 'Stop Name 2', 'Stop Name 3']
  Problem: No location info, can't render as markers

Option B - Objects with coordinates:
  majorStops: [
    {name: 'Stop 1', lat: 10.3912, lng: 122.9678},
    {name: 'Stop 2', lat: 10.3945, lng: 122.9712}
  ]
  Good: Can render as markers

Option C - Mixed:
  majorStops: [
    'Stop 1 Name',
    {name: 'Stop 2', lat: 10.3945, lng: 122.9712}
  ]
  Problem: Inconsistent - some can render, some can't
`);
