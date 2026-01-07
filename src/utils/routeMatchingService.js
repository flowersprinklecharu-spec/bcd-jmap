// Route matching algorithm using Haversine distance formula
// Finds which routes pass near a given coordinate

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find the closest distance from a point to any point in a polyline (route path)
 * @param {number} searchLat - Latitude of search location
 * @param {number} searchLng - Longitude of search location
 * @param {Array} coordinates - Route coordinates array [{lat, lng}, {lat, lng}, ...]
 * @returns {number} Minimum distance in kilometers
 */
function distanceToPolyline(searchLat, searchLng, coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return Infinity;
  }

  let minDistance = Infinity;

  for (const coord of coordinates) {
    const distance = haversineDistance(
      searchLat,
      searchLng,
      coord.lat || coord[0],
      coord.lng || coord[1]
    );
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

/**
 * Find all routes that pass within a certain radius of a location
 * @param {Object} searchCoordinates - {lat: number, lng: number}
 * @param {Array} allRoutes - Array of route objects with coordinates array
 * @param {number} radiusKm - Search radius in kilometers (default 0.5 = 500m)
 * @returns {Array} Array of routes with distance, sorted by proximity
 */
export function findNearbyRoutes(searchCoordinates, allRoutes, radiusKm = 0.5) {
  if (!searchCoordinates || !searchCoordinates.lat || !searchCoordinates.lng) {
    console.warn('Invalid search coordinates:', searchCoordinates);
    return [];
  }

  if (!Array.isArray(allRoutes) || allRoutes.length === 0) {
    console.warn('No routes to search');
    return [];
  }

  const matchedRoutes = [];

  for (const route of allRoutes) {
    // Skip routes without coordinates
    if (!route.coordinates || !Array.isArray(route.coordinates) || route.coordinates.length === 0) {
      continue;
    }

    // Calculate distance from search point to closest point in route path
    const distance = distanceToPolyline(
      searchCoordinates.lat,
      searchCoordinates.lng,
      route.coordinates
    );

    // Include route if it's within the radius
    if (distance <= radiusKm) {
      matchedRoutes.push({
        ...route,
        distanceKm: distance
      });
    }
  }

  // Sort by distance (closest first)
  matchedRoutes.sort((a, b) => a.distanceKm - b.distanceKm);

  console.log(`🔍 Found ${matchedRoutes.length} routes within ${radiusKm}km:`, matchedRoutes);

  return matchedRoutes;
}

/**
 * Format distance for display
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export function formatDistance(distanceKm) {
  if (distanceKm < 0.1) {
    return `${Math.round(distanceKm * 1000)}m`;
  } else if (distanceKm < 1) {
    return `${(distanceKm * 1000).toFixed(0)}m`;
  } else {
    return `${distanceKm.toFixed(2)}km`;
  }
}

/**
 * Find routes that match either by name/number or by proximity
 * @param {string} searchQuery - Search input
 * @param {Array} allRoutes - All routes
 * @param {Object} searchCoordinates - Geocoded coordinates (optional)
 * @returns {Object} {exactMatches: [], nearbyMatches: []}
 */
export function searchRoutesByNameOrProximity(searchQuery, allRoutes, searchCoordinates = null) {
  const query = searchQuery.toLowerCase().trim();

  // Find exact name/number matches
  const exactMatches = allRoutes.filter(route =>
    route.name.toLowerCase().includes(query) ||
    route.number.includes(query) ||
    (route.description && route.description.toLowerCase().includes(query))
  );

  let nearbyMatches = [];

  // If we have geocoded coordinates and found few results, find nearby routes
  if (searchCoordinates && exactMatches.length < 3) {
    nearbyMatches = findNearbyRoutes(searchCoordinates, allRoutes, 0.5);
    
    // Remove exact matches from nearby to avoid duplicates
    const exactIds = new Set(exactMatches.map(r => r.id));
    nearbyMatches = nearbyMatches.filter(r => !exactIds.has(r.id));
  }

  return {
    exactMatches,
    nearbyMatches
  };
}

/**
 * Map Leaflet zoom level to search radius in kilometers
 * Higher zoom = more detail = smaller radius
 * Lower zoom = wider view = larger radius
 * @param {number} zoomLevel - Leaflet map zoom level (0-18)
 * @returns {number} Radius in kilometers
 */
export function getRadiusFromZoom(zoomLevel) {
  const zoomToRadius = {
    8: 20,    // Regional view
    9: 15,    // Wide regional
    10: 10,   // Wide city area
    11: 7,    // City area
    12: 5,    // City district
    13: 3,    // Neighborhood area
    14: 2,    // Small neighborhood
    15: 1.5,  // Detailed neighborhood
    16: 1,    // Street block
    17: 0.7,  // Very detailed street
    18: 0.5   // Street level
  };

  // If zoom is between values, interpolate
  const floorZoom = Math.floor(zoomLevel);
  const ceilZoom = Math.ceil(zoomLevel);
  
  if (floorZoom === ceilZoom) {
    return zoomToRadius[floorZoom] || 5; // Default 5km if zoom not found
  }
  
  // Linear interpolation between zoom levels
  const lowerRadius = zoomToRadius[floorZoom] || 5;
  const upperRadius = zoomToRadius[ceilZoom] || 5;
  const fraction = zoomLevel - floorZoom;
  
  return lowerRadius + (upperRadius - lowerRadius) * fraction;
}

/**
 * Find closest distance from user to a route's polyline
 * @param {Object} userLocation - User's coordinates {lat, lng}
 * @param {Array} routeCoordinates - Route polyline coordinates [[lat,lng], ...]
 * @returns {number} Distance in kilometers
 */
export function getClosestDistanceToRoute(userLocation, routeCoordinates) {
  if (!userLocation || !routeCoordinates || !Array.isArray(routeCoordinates)) {
    return Infinity;
  }

  let closestDistance = Infinity;

  for (const coord of routeCoordinates) {
    const distance = haversineDistance(
      userLocation.lat,
      userLocation.lng,
      coord[0],
      coord[1]
    );
    closestDistance = Math.min(closestDistance, distance);
  }

  return closestDistance;
}

/**
 * Enhance routes with GPS data (distance from user, relevance scoring)
 * @param {Array} routes - Routes found near destination
 * @param {Object} userLocation - User's GPS coordinates {lat, lng} or null
 * @param {Object} destination - Destination coordinates {lat, lng}
 * @returns {Array} Routes with enhanced data, sorted by relevance
 */
export function enhanceRoutesWithGPS(routes, userLocation, destination) {
  if (!userLocation || !destination) {
    // No GPS or no destination - return routes as-is
    return routes;
  }

  return routes
    .map(route => {
      // Calculate distance from user to closest point on route
      const distanceFromUser = getClosestDistanceToRoute(
        userLocation,
        route.coordinates || []
      );

      // Calculate distance from route to destination
      const distanceToDestination = distanceToPolyline(
        destination.lat,
        destination.lng,
        route.coordinates || []
      );

      // Calculate relevance score (lower is better)
      // Weight: 40% accessibility (user to route), 60% route quality (route to destination)
      const relevanceScore = distanceFromUser * 0.4 + distanceToDestination * 0.6;

      // Estimate walking distance to nearest stop on route (assume avg 150m per 0.1km)
      const walkingMeters = Math.round(distanceFromUser * 1500);

      return {
        ...route,
        distanceFromUser,      // km from user to route
        distanceToDestination, // km from route to destination
        relevanceScore,        // Combined score for ranking
        walkingDistance: walkingMeters, // Meters to walk to boarding point
        gpsEnhanced: true      // Flag that this has GPS data
      };
    })
    .sort((a, b) => a.relevanceScore - b.relevanceScore); // Sort by accessibility
}
