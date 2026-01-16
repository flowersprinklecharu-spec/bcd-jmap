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

/**
 * Check if a single route is sufficient to reach destination
 * Returns false if the closest route cannot reasonably serve the destination
 * @param {Object} enhancedRoutes - Routes with GPS enhancement
 * @param {number} distanceThresholdKm - Max acceptable distance to destination (default 2km)
 * @returns {boolean} True if a single route is sufficient, false if multi-leg needed
 */
export function isSingleRouteSufficient(enhancedRoutes, distanceThresholdKm = 2) {
  if (!Array.isArray(enhancedRoutes) || enhancedRoutes.length === 0) {
    return false; // No routes available
  }

  // Check the best route (first in sorted array)
  const bestRoute = enhancedRoutes[0];
  
  // If best route's distance to destination is within threshold, single route is sufficient
  if (bestRoute.distanceToDestination <= distanceThresholdKm) {
    return true;
  }

  return false;
}

/**
 * Find transfer points between two routes
 * Prefer name+coordinate matches, but allow proximity-based transfers (within 50m) as fallback
 * @param {Object} route1 - First route object with majorStops array and coordinates
 * @param {Object} route2 - Second route object with majorStops array and coordinates
 * @param {number} maxDistanceKm - Maximum distance between stops to be considered transfer point (default 0.05km = 50m)
 * @returns {Array} Transfer points: [{stop1, stop2, distanceKm, lat, lng}, ...]
 */
export function findTransferPoints(route1, route2, maxDistanceKm = 0.05) {
  const transferPoints = [];

  // Get major stops arrays
  const stops1 = route1.majorStops || [];
  const stops2 = route2.majorStops || [];

  for (const stop1 of stops1) {
    for (const stop2 of stops2) {
      // Check if coordinates are close (within maxDistanceKm)
      let distance = Infinity;
      if (
        (stop1.lat !== undefined && stop1.lng !== undefined && stop2.lat !== undefined && stop2.lng !== undefined)
      ) {
        distance = haversineDistance(
          stop1.lat,
          stop1.lng,
          stop2.lat,
          stop2.lng
        );
      } else if (
        Array.isArray(stop1) && stop1.length === 2 &&
        Array.isArray(stop2) && stop2.length === 2
      ) {
        distance = haversineDistance(
          stop1[0], stop1[1], stop2[0], stop2[1]
        );
      }

      // Prefer name+coordinate match, but allow proximity as fallback
      const stopNameMatch = stop1.name && stop2.name && 
        stop1.name.trim().toLowerCase() === stop2.name.trim().toLowerCase();

      if ((stopNameMatch && distance <= maxDistanceKm) || (!stopNameMatch && distance <= maxDistanceKm)) {
        transferPoints.push({
          stop1,
          stop2,
          distanceKm: distance,
          lat: stop1.lat || stop1[0],
          lng: stop1.lng || stop1[1],
          stopName: stop1.name || stop2.name || 'Transfer Point',
          proximityTransfer: !stopNameMatch && distance <= maxDistanceKm
        });
      }
    }
  }

  return transferPoints;
}

/**
 * Find all possible transfer routes from a given route
 * Returns routes that can be reached from the current route via transfer points
 * @param {Object} currentRoute - Current route object
 * @param {Array} allRoutes - All available routes
 * @param {number} transferDistanceKm - Max distance between stops (default 2km)
 * @returns {Array} Connectable routes: [{route, transferPoints, ...}, ...]
 */
export function findConnectableRoutes(currentRoute, allRoutes, transferDistanceKm = 2) {
  if (!Array.isArray(allRoutes) || allRoutes.length === 0) {
    return [];
  }

  const connectableRoutes = [];

  for (const otherRoute of allRoutes) {
    // Skip the same route
    if (otherRoute.id === currentRoute.id) {
      continue;
    }

    // Find transfer points between routes
    const transferPoints = findTransferPoints(currentRoute, otherRoute, transferDistanceKm);

    // If transfer points exist, add to connectable routes
    if (transferPoints.length > 0) {
      connectableRoutes.push({
        ...otherRoute,
        transferPoints,
        numTransferPoints: transferPoints.length,
        minTransferDistance: Math.min(...transferPoints.map(t => t.distanceKm))
      });
    }
  }

  return connectableRoutes;
}

/**
 * Build multi-leg journeys using BFS to find optimal route combinations
 * If no transfer point is found, allow the closest major stop to the destination to be used as the final jeepney stop, and suggest walking from there to the destination.
 * @param {Object} userLocation - User's GPS coordinates {lat, lng}
 * @param {Object} destination - Destination coordinates {lat, lng}
 * @param {Array} allRoutes - All available routes with enhanced GPS data
 * @param {number} maxLegs - Maximum number of route segments allowed (default 3)
 * @returns {Array} Multi-leg journeys: [{legs: [{route, boarding, alighting}, ...], totalDistance, transfers, walkToDestination}, ...]
 */
export function findMultiLegJourneys(userLocation, destination, allRoutes, maxLegs = 3) {
  if (!userLocation || !destination || !Array.isArray(allRoutes) || allRoutes.length === 0) {
    return [];
  }

  const journeys = [];
  const visited = new Set(); // Track visited route combinations to avoid duplicates
  const queue = [];

  // Find all routes near user and all routes near destination
  const userNearbyRoutes = findNearbyRoutes(userLocation, allRoutes, 1.2); // Slightly relaxed radius
  const destNearbyRoutes = findNearbyRoutes(destination, allRoutes, 2.5); // Slightly relaxed radius

  // For each user-nearby route, check for intersection with any destination-nearby route
  for (const routeA of userNearbyRoutes) {
    // Ensure routeA passes through user location
    const userIsOnA = distanceToPolyline(userLocation.lat, userLocation.lng, routeA.coordinates || []) <= 1.2;
    if (!userIsOnA) continue;

    for (const routeB of destNearbyRoutes) {
      if (routeA.id === routeB.id) continue;
      // Ensure routeB passes through destination
      const destinationIsOnB = distanceToPolyline(destination.lat, destination.lng, routeB.coordinates || []) <= 2.5;
      if (!destinationIsOnB) continue;

      // Find intersection points between routeA and routeB (relaxed to 0.3km)
      const transferPoints = findTransferPoints(routeA, routeB, 0.3);
      for (const tp of transferPoints) {
        // Strictly enforce: leg2 route must pass through destination
        const coordsB = routeB.coordinates || [];
        let passesDestination = false;
        for (const coord of coordsB) {
          const lat = coord.lat || coord[0];
          const lng = coord.lng || coord[1];
          if (haversineDistance(lat, lng, destination.lat, destination.lng) <= 2.5) {
            passesDestination = true;
            break;
          }
        }
        if (!passesDestination) continue;

        // Build a two-leg journey: user -> transfer -> destination
        const leg1 = {
          route: routeA,
          boarding: { ...userLocation, name: userLocation.name || 'Your location' },
          alighting: { lat: tp.lat, lng: tp.lng, name: tp.stopName || 'Transfer Point' }
        };
        const leg2 = {
          route: routeB,
          boarding: { lat: tp.lat, lng: tp.lng, name: tp.stopName || 'Transfer Point' },
          alighting: { ...destination, name: destination.name || 'Your destination' }
        };
        journeys.push({
          legs: [leg1, leg2],
          totalDistance: (leg1.distanceToTransfer || 0) + (leg2.distanceToDestination || 0),
          transfers: 1,
          routeIds: [routeA.id, routeB.id],
          walkToDestination: null
        });
      }
    }
  }
  // Fallback: If no valid 2-leg journeys, use original BFS for 3+ legs
  if (journeys.length === 0) {
    // ...existing code for BFS multi-leg search...
    const startingRoutes = findNearbyRoutes(userLocation, allRoutes, 1); // 1km radius
    for (const route of startingRoutes) {
      // Always skip direct routes for multi-leg search
      const destinationIsOnRoute = distanceToPolyline(destination.lat, destination.lng, route.coordinates || []) <= 2;
      const userIsOnRoute = distanceToPolyline(userLocation.lat, userLocation.lng, route.coordinates || []) <= 2;
      if (destinationIsOnRoute && userIsOnRoute) {
        if (route.majorStops && Array.isArray(route.majorStops)) {
          let userIdx = -1, destIdx = -1;
          route.majorStops.forEach((stop, idx) => {
            let lat = stop.lat ?? (stop.coordinates ? stop.coordinates[0] : undefined);
            let lng = stop.lng ?? (stop.coordinates ? stop.coordinates[1] : undefined);
            if (lat !== undefined && lng !== undefined) {
              if (haversineDistance(userLocation.lat, userLocation.lng, lat, lng) < 0.3) userIdx = idx;
              if (haversineDistance(destination.lat, destination.lng, lat, lng) < 0.3) destIdx = idx;
            }
          });
          if (userIdx !== -1 && destIdx !== -1 && userIdx < destIdx) {
            // This is a direct route, skip for multi-leg
            continue;
          }
        }
      }
      queue.push({
        currentRoute: route,
        path: [{
          route,
          boarding: { ...userLocation, name: userLocation.name || 'Your location' },
          // alighting will be set when a transfer or destination is found
        }],
        totalDistance: route.distanceFromUser || 0,
        transfers: 0
      });
    }
    // ...existing BFS code continues...
  }

  // BFS through route combinations
  while (queue.length > 0) {
    const { currentRoute, path, totalDistance, transfers } = queue.shift();

    // Check if current route reaches destination
    const distanceToDestination = distanceToPolyline(
      destination.lat,
      destination.lng,
      currentRoute.coordinates || []
    );

    // If this route reaches destination, save as valid journey
    if (distanceToDestination <= 2) { // 2km threshold
      // Build legs as true segments: each with boarding, alighting, and route
      let legs = [];
      for (let i = 0; i < path.length; i++) {
        const seg = { ...path[i] };
        // Set alighting for all but last leg (if not already set)
        if (!seg.alighting && i < path.length - 1 && path[i + 1].boarding) {
          seg.alighting = path[i + 1].boarding;
        }
        legs.push(seg);
      }
      // Last leg: set alighting to destination
      if (legs.length > 0) {
        legs[legs.length - 1].alighting = { ...destination, name: destination.name || 'Your destination' };
      }
      // Fix: ensure all legs have both boarding and alighting, and filter out any zero-length legs
      let filteredLegs = [];
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        if (leg.boarding && leg.alighting && leg.route) {
          filteredLegs.push(leg);
        }
      }
      // Ensure last leg is the route that passes through the destination
      if (filteredLegs.length >= 2) {
        // Find the leg whose route passes closest to the destination
        let lastIdx = filteredLegs.length - 1;
        let minDist = Infinity;
        for (let i = 0; i < filteredLegs.length; i++) {
          const leg = filteredLegs[i];
          const dist = distanceToPolyline(destination.lat, destination.lng, leg.route.coordinates || []);
          if (dist < minDist) {
            minDist = dist;
            lastIdx = i;
          }
        }
        // Move the leg passing closest to the destination to the end
        if (lastIdx !== filteredLegs.length - 1) {
          const lastLeg = filteredLegs.splice(lastIdx, 1)[0];
          filteredLegs.push(lastLeg);
        }
        // Set its alighting to destination
        filteredLegs[filteredLegs.length - 1].alighting = { ...destination, name: destination.name || 'Your destination' };
      }
      // Only accept journeys with at least two legs (one transfer)
      if (filteredLegs.length >= 2) {
        journeys.push({
          legs: filteredLegs,
          totalDistance: totalDistance + distanceToDestination,
          transfers: Math.max(0, filteredLegs.length - 1),
          routeIds: filteredLegs.map(l => l.route.id),
          walkToDestination: null
        });
      }
      continue; // Move to next queue item
    }

    // If we haven't reached max legs, explore transfer routes
    if (path.length < maxLegs) {
      // Tighten transfer distance threshold to 0.2km (200m) for realistic transfers
      const connectableRoutes = findConnectableRoutes(currentRoute, allRoutes, 0.2);

      for (const nextRoute of connectableRoutes) {
        // Avoid cycles: skip routes already in path
        const routeIdInPath = path.some(leg => leg.route.id === nextRoute.id);
        if (routeIdInPath) {
          continue;
        }

        // Only allow transfer points that are within 0.2km of both routes
        let validTransferPoint = null;
        for (const tp of nextRoute.transferPoints) {
          // Check if transfer point is close to both currentRoute and nextRoute
          const distToCurrent = distanceToPolyline(tp.lat, tp.lng, currentRoute.coordinates || []);
          const distToNext = distanceToPolyline(tp.lat, tp.lng, nextRoute.coordinates || []);
          if (distToCurrent <= 0.2 && distToNext <= 0.2) {
            validTransferPoint = tp;
            break;
          }
        }
        if (!validTransferPoint) continue; // No valid transfer point

        // Set alighting for current leg and boarding for next leg
        const newPath = [
          ...path.slice(0, -1),
          {
            ...path[path.length - 1],
            alighting: {
              lat: validTransferPoint.lat,
              lng: validTransferPoint.lng,
              name: validTransferPoint.stopName || 'Transfer Point'
            },
          },
          {
            route: nextRoute,
            boarding: {
              lat: validTransferPoint.lat,
              lng: validTransferPoint.lng,
              name: validTransferPoint.stopName || 'Transfer Point'
            }
          }
        ];

        const newDistance = totalDistance + (validTransferPoint.distanceKm || 0);

        // Add to queue for further exploration
        queue.push({
          currentRoute: nextRoute,
          path: newPath,
          totalDistance: newDistance,
          transfers: transfers + 1
        });
      }
    }
  }

  // If no journeys found, allow closest major stop to destination as final jeepney stop
  if (journeys.length === 0) {
    // Find all major stops from all routes
    const allMajorStops = allRoutes.flatMap(route =>
      (route.majorStops || []).map(stop => ({
        ...stop,
        route
      }))
    );
    // Find the closest major stop to the destination
    let minDist = Infinity;
    let closestStop = null;
    for (const stop of allMajorStops) {
      if (stop.lat !== undefined && stop.lng !== undefined) {
        const dist = haversineDistance(destination.lat, destination.lng, stop.lat, stop.lng);
        if (dist < minDist) {
          minDist = dist;
          closestStop = stop;
        }
      }
    }
    if (closestStop && minDist < 2) { // Only suggest if within 2km
      // Find a route that serves this stop
      const route = closestStop.route;
      journeys.push({
        legs: [
          { route, boarding: userLocation, alighting: { lat: closestStop.lat, lng: closestStop.lng, name: closestStop.name }, distanceToDestination: minDist }
        ],
        totalDistance: minDist,
        transfers: 0,
        routeIds: [route.id],
        walkToDestination: {
          from: { lat: closestStop.lat, lng: closestStop.lng, name: closestStop.name },
          to: destination,
          distanceKm: minDist
        }
      });
    }
  }

  return journeys;
}

/**
 * Rank and optimize multi-leg journeys
 * Prioritizes: fewest transfers, then minimum distance, then estimated time
 * @param {Array} journeys - Multi-leg journeys from findMultiLegJourneys
 * @returns {Array} Ranked journeys, best first
 */
export function rankMultiLegJourneys(journeys) {
  if (!Array.isArray(journeys) || journeys.length === 0) {
    return [];
  }

  // Only display journeys where the second leg's route passes near the destination
  const seenKeys = new Set();
  const filteredJourneys = journeys.filter(journey => {
    if (!journey.legs || journey.legs.length < 2) return false;
    const leg2 = journey.legs[1];
    if (!leg2.route || !leg2.route.coordinates) return false;
    const destLat = leg2.alighting.lat;
    const destLng = leg2.alighting.lng;
    const coords = leg2.route.coordinates || [];
    let passesDestination = false;
    for (const coord of coords) {
      const lat = coord.lat || coord[0];
      const lng = coord.lng || coord[1];
      if (haversineDistance(lat, lng, destLat, destLng) <= 2) {
        passesDestination = true;
        break;
      }
    }
    if (!passesDestination) return false;
    // Prevent duplicate journeys (same route IDs and transfer point)
    const leg1 = journey.legs[0];
    if (journey.routeIds && journey.routeIds.length === 2) {
      const key = journey.routeIds.join('-') + '-' + leg1.alighting.lat + '-' + leg1.alighting.lng;
      if (seenKeys.has(key)) {
        return false;
      }
      seenKeys.add(key);
    }
    return true;
  });

  // Score journeys: lower is better
  const scoredJourneys = filteredJourneys.map(journey => {
    // Primary: Number of transfers (0 transfers = best)
    const transferScore = journey.transfers * 100;

    // Secondary: Total distance in km (normalize to 0-100 scale, assume 10km = 100 points)
    const distanceScore = (journey.totalDistance / 10) * 20;

    // Tertiary: Estimated time (assume 20km/h average speed)
    const estimatedTimeHours = journey.totalDistance / 20;
    const timeScore = estimatedTimeHours * 10;

    const totalScore = transferScore + distanceScore + timeScore;

    return {
      ...journey,
      score: totalScore,
      estimatedTimeMinutes: Math.round(estimatedTimeHours * 60)
    };
  });

  // Sort by score (lower is better)
  scoredJourneys.sort((a, b) => a.score - b.score);

  // Prioritize 2-leg journeys, only show 3-leg if no valid 2-leg exist
  const twoLeg = scoredJourneys.filter(j => j.legs.length === 2);
  if (twoLeg.length > 0) {
    return twoLeg.slice(0, 3);
  }
  return scoredJourneys.slice(0, 3);
}
