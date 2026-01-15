// Sample jeepney route data structure for multi-leg routing
// Each route has an id, name, color, and an array of stops (lat/lng)
// Transfer points are stops shared by two or more routes

export const jeepneyRoutes = [
  {
    id: 'route1',
    name: 'Route 1: North to Central',
    color: '#FF5733',
    stops: [
      { name: 'North Terminal', lat: 10.700, lng: 122.950 },
      { name: 'Main St', lat: 10.705, lng: 122.955 },
      { name: 'Central Market', lat: 10.710, lng: 122.960 }, // transfer point
      { name: 'Plaza', lat: 10.715, lng: 122.965 }
    ]
  },
  {
    id: 'route2',
    name: 'Route 2: Central to South',
    color: '#33A1FF',
    stops: [
      { name: 'Central Market', lat: 10.710, lng: 122.960 }, // transfer point
      { name: 'South Ave', lat: 10.705, lng: 122.970 },
      { name: 'South Terminal', lat: 10.700, lng: 122.980 }
    ]
  },
  {
    id: 'route3',
    name: 'Route 3: East to Central',
    color: '#28A745',
    stops: [
      { name: 'East Terminal', lat: 10.720, lng: 122.950 },
      { name: 'Central Market', lat: 10.710, lng: 122.960 }, // transfer point
      { name: 'West Ave', lat: 10.710, lng: 122.940 }
    ]
  }
];

// To add more routes, follow the same structure above.
// Transfer points are identified by matching lat/lng and name across routes.
