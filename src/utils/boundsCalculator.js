// Utility function to calculate bounding box from route coordinates

/**
 * Calculate bounding box from an array of coordinates
 * @param {Array} coordinates - Array of coordinates [{lat, lng}, [lat, lng], etc.]
 * @returns {Object|null} {minLat, maxLat, minLng, maxLng} or null if invalid
 */
export function calculateBounds(coordinates) {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
    return null;
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const coord of coordinates) {
    let lat, lng;

    // Handle both {lat, lng} and [lat, lng] formats
    if (Array.isArray(coord) && coord.length === 2) {
      [lat, lng] = coord;
    } else if (coord && typeof coord === 'object' && 'lat' in coord && 'lng' in coord) {
      lat = coord.lat;
      lng = coord.lng;
    } else {
      continue; // Skip invalid coordinates
    }

    if (typeof lat === 'number' && typeof lng === 'number') {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }
  }

  // Check if we found valid coordinates
  if (
    minLat === Infinity ||
    maxLat === -Infinity ||
    minLng === Infinity ||
    maxLng === -Infinity
  ) {
    return null;
  }

  return {
    minLat,
    maxLat,
    minLng,
    maxLng
  };
}

/**
 * Convert bounds object to Leaflet fitBounds format
 * @param {Object} bounds - {minLat, maxLat, minLng, maxLng}
 * @returns {Array} [[minLat, minLng], [maxLat, maxLng]]
 */
export function boundsToLeafletFormat(bounds) {
  if (!bounds) return null;
  return [[bounds.minLat, bounds.minLng], [bounds.maxLat, bounds.maxLng]];
}

/**
 * Add padding to bounds (expands the bounding box)
 * @param {Object} bounds - {minLat, maxLat, minLng, maxLng}
 * @param {number} paddingPercent - Percentage to expand (e.g., 0.1 for 10%)
 * @returns {Object} Padded bounds
 */
export function addPaddingToBounds(bounds, paddingPercent = 0.1) {
  if (!bounds) return null;

  const latDiff = (bounds.maxLat - bounds.minLat) * paddingPercent;
  const lngDiff = (bounds.maxLng - bounds.minLng) * paddingPercent;

  return {
    minLat: bounds.minLat - latDiff,
    maxLat: bounds.maxLat + latDiff,
    minLng: bounds.minLng - lngDiff,
    maxLng: bounds.maxLng + lngDiff
  };
}
