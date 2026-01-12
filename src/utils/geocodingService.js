// Nominatim OpenStreetMap API for free geocoding
// Rate limit: 1 request per second (we're fine with user searches)

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Geocode a street address or landmark name to coordinates
 * @param {string} query - Street name, address, or landmark (e.g., "Lacson Street, Bacolod")
 * @returns {Promise<{lat: number, lng: number}|null>} Coordinates or null if not found
 */
export async function geocodeAddress(query) {
  if (!query || query.trim().length === 0) {
    return null;
  }

  try {
    // Nominatim expects: ?q=query&format=json&limit=1
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: 1,
      // Bias search results to Bacolod area (lat 10.6750, lng 122.9600)
      viewbox: '122.8,10.5,123.0,10.8',
      bounded: 1
    });

    const response = await fetch(`${NOMINATIM_BASE_URL}?${params}`, {
      headers: {
        'User-Agent': 'BCD-JMap-App' // Nominatim requires User-Agent
      }
    });

    if (!response.ok) {
      console.error('Geocoding API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.length === 0) {
      console.log('Geocoding: No results found for:', query);
      return null;
    }

    const result = data[0];
    const coordinates = {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon)
    };

    console.log(`✅ Geocoded "${query}" to:`, coordinates);
    return coordinates;
  } catch (err) {
    console.error('Geocoding error:', err);
    return null;
  }
}

/**
 * Reverse geocode coordinates to location name
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string|null>} Location name or null if not found
 */
export async function reverseGeocode(lat, lng) {
  if (lat === undefined || lng === undefined) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      lat: lat,
      lon: lng,
      format: 'json'
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
      {
        headers: {
          'User-Agent': 'BCD-JMap-App'
        }
      }
    );

    if (!response.ok) {
      console.error('Reverse geocoding API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data) {
      return null;
    }

    // Try to get a meaningful location name in order of preference
    const address = data.address || {};
    const locationName = 
      address.neighbourhood || 
      address.village || 
      address.town || 
      address.city || 
      address.county || 
      data.name || 
      null;

    if (locationName) {
      console.log(`✅ Reverse geocoded (${lat}, ${lng}) to: ${locationName}`);
      return locationName;
    }

    return null;
  } catch (err) {
    console.error('Reverse geocoding error:', err);
    return null;
  }
}

/**
 * Batch geocode multiple addresses
 * @param {string[]} queries - Array of address strings
 * @returns {Promise<Object>} Map of query -> coordinates
 */
export async function geocodeMultiple(queries) {
  const results = {};
  
  for (const query of queries) {
    const coords = await geocodeAddress(query);
    results[query] = coords;
    
    // Respect rate limit: 1 request per second
    await new Promise(resolve => setTimeout(resolve, 1100));
  }
  
  return results;
}
