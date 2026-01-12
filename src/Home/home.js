import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, normalizeDocData } from '../firebase';
import { geocodeAddress } from '../utils/geocodingService';
import { findNearbyRoutes, formatDistance, searchRoutesByNameOrProximity, getRadiusFromZoom, enhanceRoutesWithGPS } from '../utils/routeMatchingService';
import { calculateBounds, addPaddingToBounds } from '../utils/boundsCalculator';
import FeedbackForm from '../Feedback/FeedbackForm';
// Navbar moved to App.js (top-level)
import LeafletMap from '../Map/LeafletMap';

// SVG Icons
const MapPinIcon = () => (
  <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path>
  </svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path>
  </svg>
);

const MapPinSmallIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path>
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"></path>
  </svg>
);

const JeepneyMap = ({ onNavigate, onRequestLogin, onAdminEditingChange }) => {
  const [destination, setDestination] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  const [expandedRouteId, setExpandedRouteId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [jeepneyRoutes, setJeepneyRoutes] = useState([]);
  const [landmarks, setLandmarks] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [suggestedRoutes, setSuggestedRoutes] = useState([]);
  const [highlightedStops, setHighlightedStops] = useState([]);
  const [selectedDestinationCoords, setSelectedDestinationCoords] = useState(null);
  const [zoomBounds, setZoomBounds] = useState(null); // For smart zoom on route selection
  const [searchType, setSearchType] = useState(''); // 'system' for found in DB, 'geocoded' for API search
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(12); // Current map zoom level (for zoom-based radius)
  const [gpsPermission, setGpsPermission] = useState(null); // 'granted' | 'denied' | null
  
  // NEW: Search phase control states (additive, non-breaking)
  const [searchPhase, setSearchPhase] = useState('idle'); // 'idle' | 'searching' | 'viewing-suggestions' | 'viewing-route'
  const [showOnlyDestination, setShowOnlyDestination] = useState(false);
  const [showOnlySuggestedRoutes, setShowOnlySuggestedRoutes] = useState(false);
  const routeDetailsRef = useRef(null);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Get closest point distance from user to a route
  const getClosestDistanceToRoute = (route) => {
    if (!userLocation || !route.coordinates) return Infinity;

    let closestDistance = Infinity;

    if (Array.isArray(route.coordinates)) {
      // If coordinates is a polyline
      route.coordinates.forEach(coord => {
        if (Array.isArray(coord) && coord.length === 2) {
          const distance = calculateDistance(userLocation.lat, userLocation.lng, coord[0], coord[1]);
          closestDistance = Math.min(closestDistance, distance);
        }
      });
    } else if (route.coordinates.latitude && route.coordinates.longitude) {
      // If coordinates is a single point
      closestDistance = calculateDistance(userLocation.lat, userLocation.lng, 
                                         route.coordinates.latitude, 
                                         route.coordinates.longitude);
    }

    return closestDistance;
  };

  // Memoized nearby landmarks with distance calculation
  const nearbyLandmarks = useMemo(() => {
    if (!userLocation || landmarks.length === 0) return [];
    
    const landmarksWithDistance = landmarks.map(landmark => {
      if (!landmark.coordinates || !Array.isArray(landmark.coordinates) || landmark.coordinates.length !== 2) {
        return { ...landmark, distance: Infinity };
      }
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        landmark.coordinates[0],
        landmark.coordinates[1]
      );
      return { ...landmark, distance };
    });
    
    // Filter to within 5 km and sort by distance
    return landmarksWithDistance
      .filter(l => l.distance <= 5 && l.distance !== Infinity)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [userLocation, landmarks]);

  // Generate suggestions from routes major stops and landmarks
  const suggestions = useMemo(() => {
    const stops = new Set();
    
    // Add major stops from all routes (handle both string and object formats)
    jeepneyRoutes.forEach(route => {
      if (route.majorStops && Array.isArray(route.majorStops)) {
        route.majorStops.forEach(stop => {
          if (stop) {
            const stopName = typeof stop === 'string' ? stop : stop.name;
            if (stopName && typeof stopName === 'string') {
              stops.add(stopName);
            }
          }
        });
      }
    });

    // Add landmark names
    landmarks.forEach(landmark => {
      if (landmark.name && typeof landmark.name === 'string') {
        stops.add(landmark.name);
      }
    });

    // Filter based on input and return sorted
    const filtered = Array.from(stops)
      .filter(stop => 
        destination.trim() === '' || 
        stop.toLowerCase().includes(destination.toLowerCase())
      )
      .sort();

    console.log('📋 Suggestions generated:', { totalStops: stops.size, filtered: filtered.length, destination, jeepneyRoutesCount: jeepneyRoutes.length, landmarksCount: landmarks.length });
    return destination.trim() === '' ? [] : filtered;
  }, [destination, jeepneyRoutes, landmarks]);

  useEffect(() => {
    let watcherId = null;

    if (navigator.geolocation) {
      // Use watchPosition for real-time GPS tracking
      watcherId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Location access denied or error:', error.message);
          setUserLocation({ lat: 10.6750, lng: 122.9500 });
        },
        {
          enableHighAccuracy: true,  // Use GPS for better accuracy
          timeout: 10000,            // Wait up to 10 seconds for location
          maximumAge: 5000           // Use cached position if less than 5 seconds old
        }
      );
    } else {
      setUserLocation({ lat: 10.6750, lng: 122.9500 });
    }

    // Firestore listeners
    try {
      const routesCol = collection(db, 'routes');
      const routesQuery = query(routesCol);
      const unsubRoutes = onSnapshot(routesQuery, (snapshot) => {
        const routes = snapshot.docs.map(doc => {
          // Use normalizeDocData to ensure all coordinates are in [lat, lng] format
          const normalized = normalizeDocData(doc);
          const data = normalized;
          
          console.log(`📦 Route loaded: ${data.number || 'unknown'}`, {
            hasCoordinates: !!data.coordinates,
            coordinatesType: Array.isArray(data.coordinates) ? 'array' : typeof data.coordinates,
            coordinatesLength: Array.isArray(data.coordinates) ? data.coordinates.length : 'N/A',
            coordinatesFirstItem: Array.isArray(data.coordinates) ? data.coordinates[0] : 'N/A'
          });
          
          // Validate coordinates are in proper [lat, lng] format
          if (data.coordinates && Array.isArray(data.coordinates)) {
            const validCoords = data.coordinates.filter(coord => 
              Array.isArray(coord) && 
              coord.length === 2 && 
              typeof coord[0] === 'number' && 
              typeof coord[1] === 'number' &&
              !isNaN(coord[0]) && !isNaN(coord[1]) &&
              coord[0] >= -90 && coord[0] <= 90 &&
              coord[1] >= -180 && coord[1] <= 180
            );
            
            if (validCoords.length > 0) {
              data.coordinates = validCoords;
              console.log(`✅ Route ${data.number}: Validated ${validCoords.length} coordinates`);
            } else {
              console.warn(`⚠️ Route ${data.number}: No valid coordinates found`);
              data.coordinates = null;
            }
          } else {
            console.warn(`⚠️ Route ${data.number}: No coordinates found or coordinates not an array`);
            data.coordinates = null;
          }
          
          return { id: doc.id, ...data };
        });
        
        console.log(`📊 Loaded ${routes.length} total routes. Routes with coordinates:`, routes.filter(r => r.coordinates).length);
        setJeepneyRoutes(routes);
      }, (err) => {
        console.error('Routes listener error', err);
      });

      const landmarksCol = collection(db, 'landmarks');
      const landmarksQuery = query(landmarksCol);
      const unsubLandmarks = onSnapshot(landmarksQuery, (snapshot) => {
        const lm = snapshot.docs.map(doc => {
          const normalized = normalizeDocData(doc);
          // Ensure valid coordinates
          if (!normalized.coordinates || !Array.isArray(normalized.coordinates) || normalized.coordinates.length !== 2) {
            normalized.coordinates = null; // Don't render invalid landmarks on map
          }
          return { id: doc.id, ...normalized };
        });
        // Only include landmarks with valid coordinates
        setLandmarks(lm.filter(l => l.coordinates !== null));
      }, (err) => {
        console.error('Landmarks listener error', err);
      });

      const announcementsCol = collection(db, 'announcements');
      const announcementsQuery = query(announcementsCol);
      const unsubAnnouncements = onSnapshot(announcementsQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...normalizeDocData(doc)
        }));
        // Parse dates properly for consistent sorting (handles both ISO and formatted dates)
        data.sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA; // Newest first
        });
        setAnnouncements(data);
      }, (err) => {
        console.error('Announcements listener error', err);
      });

      return () => {
        // Cleanup: Stop watching position when component unmounts
        if (watcherId !== null) {
          navigator.geolocation.clearWatch(watcherId);
        }
        unsubRoutes && unsubRoutes();
        unsubLandmarks && unsubLandmarks();
        unsubAnnouncements && unsubAnnouncements();
      };
    } catch (err) {
      console.warn('Firestore not available', err);
      // Still cleanup geolocation watcher even if Firestore fails
      return () => {
        if (watcherId !== null) {
          navigator.geolocation.clearWatch(watcherId);
        }
      };
    }
  }, []);

  // Scroll to route details when they appear
  useEffect(() => {
    if (showRouteDetails && routeDetailsRef.current) {
      setTimeout(() => {
        routeDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showRouteDetails]);

  // Auto-transition from details to map after 2 seconds
  useEffect(() => {
    if (showRouteDetails && selectedRoute && searchPhase === 'viewing-route') {
      console.log('⏱️ Starting 2-second timer for auto-transition');
      
      // Set new timer to auto-hide details and show map
      const timer = setTimeout(() => {
        console.log('⏱️ Auto-transitioning from details to map view');
        setShowRouteDetails(false);
        // Map will automatically display now
      }, 2000); // 2 second delay
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [showRouteDetails, selectedRoute, searchPhase]);

  // NEW: Auto-scroll to suggestions when phase changes to viewing-suggestions
  useEffect(() => {
    if (searchPhase === 'viewing-suggestions') {
      const suggestionsSection = document.querySelector('.suggested-jeepneys');
      if (suggestionsSection) {
        setTimeout(() => {
          suggestionsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    }
  }, [searchPhase]);

  const triggerFindRoute = (destinationName) => {
    if (!destinationName || jeepneyRoutes.length === 0) return;

    console.log('🔍 triggerFindRoute called with:', destinationName);

    // Find all routes that have the destination in their major stops (handle both string and object formats)
    const matchingRoutes = jeepneyRoutes.filter(route =>
      route.majorStops && 
      route.majorStops.some(stop => {
        const stopName = typeof stop === 'string' ? stop : stop.name;
        return stopName && stopName.toLowerCase() === destinationName.toLowerCase();
      })
    );

    console.log('🛣️ Routes with destination as major stop:', matchingRoutes.length);

    // Also find the landmark if it matches
    const matchingLandmark = landmarks.find(lm => 
      lm.name.toLowerCase() === destinationName.toLowerCase()
    );

    if (matchingLandmark) {
      console.log('🏛️ Found matching landmark:', matchingLandmark.name);
    }

    // Set suggested routes (use matching routes, proximity search, or random selection)
    let routesToSuggest = [];
    let searchMethod = 'none';

    if (matchingRoutes.length > 0) {
      // Option 1: Routes with destination as direct major stop
      searchMethod = 'direct-stops';
      console.log('✅ Using Option 1: Direct stop matching');
      
      // Sort matching routes by distance from user location
      routesToSuggest = matchingRoutes.sort((a, b) => {
        const distA = getClosestDistanceToRoute(a);
        const distB = getClosestDistanceToRoute(b);
        return distA - distB;
      });
      
      // Mark this as a system search
      setSearchType('system');
    } else if (matchingLandmark && matchingLandmark.coordinates) {
      // Option 2: Landmark exists but not a major stop - use proximity search to find nearby routes
      searchMethod = 'proximity-search';
      console.log('✅ Using Option 2: Proximity search for routes near landmark', matchingLandmark.coordinates);
      
      // Use zoom-based radius
      const radiusKm = getRadiusFromZoom(currentZoom);
      let nearbyRoutes = findNearbyRoutes(matchingLandmark.coordinates, jeepneyRoutes, radiusKm);
      console.log(`🎯 Found ${nearbyRoutes.length} routes within ${radiusKm.toFixed(2)}km radius`);
      
      // Enhance with GPS data if user location is available
      if (userLocation && gpsPermission === 'granted') {
        nearbyRoutes = enhanceRoutesWithGPS(nearbyRoutes, userLocation, matchingLandmark.coordinates);
        console.log('📍 Routes enhanced with GPS distance data');
      }
      
      if (nearbyRoutes.length > 0) {
        routesToSuggest = nearbyRoutes;
      }
      
      // Mark this as a system search (landmark was found in system)
      setSearchType('system');
    }

    // Fallback: If no direct routes and no nearby routes, find routes closest to user location
    if (routesToSuggest.length === 0) {
      if (userLocation) {
        searchMethod = 'proximity-to-user';
        console.log('✅ Using Option 3: Routes closest to user location');
        
        // Sort all routes by distance from user location
        routesToSuggest = [...jeepneyRoutes].sort((a, b) => {
          const distA = getClosestDistanceToRoute(a);
          const distB = getClosestDistanceToRoute(b);
          return distA - distB;
        }).slice(0, Math.min(3, jeepneyRoutes.length));
        
        setSearchType('fallback');
      } else {
        searchMethod = 'random';
        console.log('✅ Using Option 3: Random route selection (user location unavailable)');
        
        const shuffled = [...jeepneyRoutes].sort(() => Math.random() - 0.5);
        routesToSuggest = shuffled.slice(0, Math.min(3, shuffled.length));
        
        setSearchType('fallback');
      }
    }

    console.log(`📊 Search method: ${searchMethod}, Routes selected: ${routesToSuggest.length}`);
    console.log(`🏷️ Search type: ${searchType || 'unknown'}`);

    setSuggestedRoutes(routesToSuggest);
    
    // NEW: Transition to viewing suggestions phase after routes are found
    if (routesToSuggest.length > 0) {
      setTimeout(() => {
        setSearchPhase('viewing-suggestions');
        setShowOnlyDestination(false);
        setShowOnlySuggestedRoutes(true);
      }, 300); // Brief delay for animation
    }
    
    // Auto-select the closest route
    if (routesToSuggest.length > 0) {
      const closestRoute = routesToSuggest[0];
      console.log('📌 Closest route selected:', closestRoute.number, closestRoute);
      setSelectedRoute(closestRoute);
      
      // Calculate bounds from the selected route's coordinates and zoom map
      if (closestRoute.coordinates && Array.isArray(closestRoute.coordinates)) {
        console.log('📍 Route coordinates exist, length:', closestRoute.coordinates.length, closestRoute.coordinates);
        const bounds = calculateBounds(closestRoute.coordinates);
        console.log('🔢 Calculated bounds:', bounds);
        if (bounds) {
          console.log('🎯 Setting zoom bounds for route:', closestRoute.number, bounds);
          setZoomBounds(bounds);
        } else {
          console.warn('⚠️ Bounds calculation returned null');
        }
      } else {
        console.warn('⚠️ No valid coordinates found on route:', closestRoute);
      }
    } else {
      console.log('ℹ️ No routes suggested, clearing zoom bounds');
      setZoomBounds(null);
    }

    // Collect all major stops from matching routes to highlight on map
    const stopsToHighlight = [];
    matchingRoutes.forEach(route => {
      if (route.majorStops) {
        route.majorStops.forEach(stop => {
          const stopName = typeof stop === 'string' ? stop : stop.name;
          stopsToHighlight.push(stopName);
        });
      }
    });

    // Also add stops from proximity-found routes
    if (searchMethod === 'proximity-search') {
      routesToSuggest.forEach(route => {
        if (route.majorStops) {
          route.majorStops.forEach(stop => {
            const stopName = typeof stop === 'string' ? stop : stop.name;
            if (!stopsToHighlight.includes(stopName)) {
              stopsToHighlight.push(stopName);
            }
          });
        }
      });
    }

    // Add the landmark if found
    if (matchingLandmark) {
      stopsToHighlight.push(matchingLandmark.name);
    }

    console.log('🔆 Highlighted stops:', stopsToHighlight);
    setHighlightedStops(stopsToHighlight);
  };


  const handleFindRoute = async () => {
    if (!destination) return;

    console.log('🔍 handleFindRoute called with:', destination);
    
    // NEW: Set search phase
    setSearchPhase('searching');
    setShowOnlyDestination(true);
    setShowOnlySuggestedRoutes(false);

    // Inline coordinate finding logic
    let coords = null;
    let foundInSystem = false;

    // First, try to find in landmarks
    const landmark = landmarks.find(lm => 
      lm.name.toLowerCase() === destination.toLowerCase()
    );
    if (landmark && landmark.coordinates) {
      console.log('✅ Found in landmarks:', landmark.coordinates);
      coords = landmark.coordinates;
      foundInSystem = true;
    }

    // If not found in landmarks, search in routes
    if (!coords) {
      console.log('❌ Not in landmarks, searching in routes...');
      for (let route of jeepneyRoutes) {
        if (route.majorStops && Array.isArray(route.majorStops)) {
          // Use .find() to get the actual stop object
          const foundStop = route.majorStops.find(stop => {
            const stopName = typeof stop === 'string' ? stop : (stop?.name || '');
            return stopName.toLowerCase() === destination.toLowerCase();
          });
          
          if (foundStop) {
            const stopName = typeof foundStop === 'string' ? foundStop : (foundStop?.name || '');
            console.log('🎯 Found stop in route:', route.number, stopName);
            foundInSystem = true;
            
            // Priority 1: Check if stop itself has coordinates (lat/lng)
            if (typeof foundStop === 'object' && foundStop.lat !== undefined && foundStop.lng !== undefined) {
              console.log('✅ Found stop with coordinates:', [foundStop.lat, foundStop.lng]);
              coords = [foundStop.lat, foundStop.lng];
            }
            // Priority 2: Fall back to route's first coordinate
            else if (route.coordinates && Array.isArray(route.coordinates) && route.coordinates.length > 0) {
              console.log('✅ Using route coordinate:', route.coordinates[0]);
              coords = route.coordinates[0];
            }
            // Priority 3: Try to find a matching landmark
            else {
              console.log('❌ Stop has no coordinates, trying landmark...');
              const stopLandmark = landmarks.find(lm => 
                lm.name.toLowerCase() === stopName.toLowerCase()
              );
              if (stopLandmark && stopLandmark.coordinates) {
                console.log('✅ Found landmark for stop:', stopLandmark.name);
                coords = stopLandmark.coordinates;
              }
            }
            
            break; // Exit after finding first matching route
          }
        }
      }
    }

    // If still not found in system, try geocoding the input (in case it's a street name)
    if (!coords && !foundInSystem) {
      console.log('🌍 Geocoding search query:', destination);
      const geocodedCoords = await geocodeAddress(destination);
      
      if (geocodedCoords) {
        console.log('✅ Geocoded coordinates:', geocodedCoords);
        coords = [geocodedCoords.lat, geocodedCoords.lng];
        
        // Find nearby routes using geocoded location with zoom-based radius
        const radiusKm = getRadiusFromZoom(currentZoom);
        let nearbyRoutes = findNearbyRoutes(geocodedCoords, jeepneyRoutes, radiusKm);
        console.log(`🛣️ Found ${nearbyRoutes.length} routes within ${radiusKm.toFixed(2)}km radius`);
        
        // Enhance with GPS data if user location is available
        if (userLocation && gpsPermission === 'granted') {
          nearbyRoutes = enhanceRoutesWithGPS(nearbyRoutes, userLocation, geocodedCoords);
          console.log('📍 Routes enhanced with GPS distance data');
        }
        
        if (nearbyRoutes.length > 0) {
          console.log('🛣️ Found nearby routes:', nearbyRoutes);
          setSuggestedRoutes(nearbyRoutes);
          setSelectedRoute(nearbyRoutes[0]);
          
          // Mark this as a geocoded search
          setSearchType('geocoded');
          
          // Show a helpful message
          const routeList = nearbyRoutes.map((r, i) => 
            `${i + 1}. Route ${r.number} - ${r.name} (${formatDistance(r.distanceKm)} away)`
          ).join('\n');
          console.log(`📍 Routes passing near "${destination}":\n${routeList}`);
          
          return; // Stop here, we found nearby routes
        }
      }
    } else if (foundInSystem) {
      // If found in system, mark as system search
      setSearchType('system');
    }

    // Set destination coordinates if found
    if (coords) {
      console.log('📍 Setting selected destination coords:', coords);
      setSelectedDestinationCoords(coords);
    } else {
      console.log('❌ No coordinates found for destination');
    }

    // Trigger route finding
    triggerFindRoute(destination);
    
    // NEW: Transition to suggestions phase after a brief moment for smooth UX
    setTimeout(() => {
      setSearchPhase('viewing-suggestions');
      setShowOnlyDestination(false);
      setShowOnlySuggestedRoutes(true);
    }, 800);
  };

  return (
    <div className="app">
      {/* Navbar is rendered by App.js */}

      <div className="main-container">
        <div className="main-grid">
          <div className="main-content">
            <div className="card">
              <h2 className="card-title">Welcome to JeepneyMap!</h2>
              
              <div className="form-grid">
                <div>
                  <label className="form-label">Find Your Stop</label>
                  <div className="destination-input-wrapper">
                    <div className="input-with-icon">
                      <SearchIcon />
                      <input
                        type="text"
                        value={destination}
                        onChange={(e) => {
                          setDestination(e.target.value);
                          setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                        placeholder="Search for a stop or landmark..."
                        className="input"
                      />
                      {destination && (
                        <button
                          type="button"
                          className="clear-input-btn"
                          onClick={() => {
                            setDestination('');
                            setShowDropdown(false);
                            setExpandedRouteId(null);
                            setSuggestedRoutes([]);
                            setSearchType('');
                            // NEW: Reset search phases
                            setSearchPhase('idle');
                            setShowOnlyDestination(false);
                            setShowOnlySuggestedRoutes(false);
                          }}
                          title="Clear search"
                        >
                          <CloseIcon />
                        </button>
                      )}
                    </div>
                    
                    {/* Dropdown suggestions */}
                    {showDropdown && suggestions.length > 0 && (
                      <div className="suggestions-dropdown">
                        {suggestions.slice(0, 10).map((suggestion, index) => (
                          <div
                            key={index}
                            className="suggestion-item"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setDestination(suggestion);
                              setShowDropdown(false);
                              
                              // Get coordinates and set for map zoom
                              let coords = null;
                              let foundInSystem = false;
                              
                              // First, try to find in landmarks
                              const landmark = landmarks.find(lm => 
                                lm.name.toLowerCase() === suggestion.toLowerCase()
                              );
                              if (landmark && landmark.coordinates) {
                                coords = landmark.coordinates;
                                foundInSystem = true;
                              }
                              
                              // If not found in landmarks, search in routes with priority for stop's own coords
                              if (!coords) {
                                for (let route of jeepneyRoutes) {
                                  if (route.majorStops && Array.isArray(route.majorStops)) {
                                    // Use .find() to get the actual stop object
                                    const foundStop = route.majorStops.find(stop => {
                                      const stopName = typeof stop === 'string' ? stop : (stop?.name || '');
                                      return stopName.toLowerCase() === suggestion.toLowerCase();
                                    });
                                    
                                    if (foundStop) {
                                      const stopName = typeof foundStop === 'string' ? foundStop : (foundStop?.name || '');
                                      foundInSystem = true;
                                      
                                      // Priority 1: Check if stop itself has coordinates (lat/lng)
                                      if (typeof foundStop === 'object' && foundStop.lat !== undefined && foundStop.lng !== undefined) {
                                        coords = [foundStop.lat, foundStop.lng];
                                      }
                                      // Priority 2: Fall back to route's first coordinate
                                      else if (route.coordinates?.length > 0) {
                                        coords = route.coordinates[0];
                                      }
                                      break;
                                    }
                                  }
                                }
                              }
                              
                              // Set coordinates and search type
                              if (coords) {
                                setSelectedDestinationCoords(coords);
                              }
                              if (foundInSystem) {
                                setSearchType('system');
                              }
                              
                              // Auto-trigger find routes
                              setTimeout(() => {
                                triggerFindRoute(suggestion);
                              }, 0);
                            }}
                          >
                            <MapPinSmallIcon />
                            <span>{suggestion}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button 
                onClick={handleFindRoute} 
                className="btn-primary"
                disabled={!destination}
              >
                Find Stops
              </button>
            </div>

            <div className="card">
              <h2 className="card-title"><MapPinIcon /> Map View</h2>
              <div className="map-wrapper">
                <LeafletMap
                  routes={jeepneyRoutes}
                  selectedRoute={selectedRoute}
                  userLocation={userLocation}
                  landmarks={landmarks}
                  highlightedStops={highlightedStops}
                  suggestedRoutes={suggestedRoutes}
                  destination={destination}
                  selectedDestination={selectedDestinationCoords}
                  showLandmarks={!selectedDestinationCoords}
                  zoomBounds={zoomBounds}
                  searchType={searchType}
                  onRouteClick={(route) => { setSelectedRoute(route); setShowRouteDetails(true); }}
                  onZoomChange={(zoom) => setCurrentZoom(zoom)}
                  // NEW: Pass phase control props
                  searchPhase={searchPhase}
                  showOnlyDestination={showOnlyDestination}
                  showOnlySuggestedRoutes={showOnlySuggestedRoutes}
                />
              </div>
            </div>

            {suggestedRoutes.length > 0 && (
              <div className="card suggested-jeepneys">
                <h2 className="card-title">Available Jeepneys to {destination}</h2>
                
                {/* Search type feedback message */}
                {searchType === 'system' && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    backgroundColor: '#d1fae5',
                    borderLeft: '4px solid #10b981',
                    borderRadius: '0.375rem',
                    color: '#065f46',
                    fontSize: '14px'
                  }}>
                    ✓ Found "{destination}" in the system - showing jeepneys that have this stop
                  </div>
                )}
                
                {searchType === 'geocoded' && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    backgroundColor: '#fef3c7',
                    borderLeft: '4px solid #f59e0b',
                    borderRadius: '0.375rem',
                    color: '#78350f',
                    fontSize: '14px'
                  }}>
                    📍 "{destination}" was located using map search - showing jeepneys passing nearby
                  </div>
                )}
                
                {searchType === 'fallback' && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    backgroundColor: '#e0e7ff',
                    borderLeft: '4px solid #6366f1',
                    borderRadius: '0.375rem',
                    color: '#312e81',
                    fontSize: '14px'
                  }}>
                    ℹ️ "{destination}" not found in system - showing jeepneys closest to you
                  </div>
                )}
                
                <div className="suggested-routes">
                  {suggestedRoutes.map((route) => (
                    <div key={route.id}>
                      <div 
                        className="suggested-route-item"
                        onClick={() => {
                          setSelectedRoute(route);
                          setExpandedRouteId(expandedRouteId === route.id ? null : route.id);
                          // NEW: Transition to viewing route details
                          setSearchPhase('viewing-route');
                          setShowRouteDetails(true);
                          setShowOnlySuggestedRoutes(true);
                          
                          // Auto-zoom to show entire route
                          if (route.coordinates && Array.isArray(route.coordinates) && route.coordinates.length > 0) {
                            const bounds = calculateBounds(route.coordinates);
                            if (bounds) {
                              console.log('🎯 Auto-zooming to route:', route.number, bounds);
                              setZoomBounds(bounds);
                            }
                          }
                        }}
                      >
                        <div 
                          className="suggested-route-number"
                          style={{ backgroundColor: route.color }}
                        >
                          {route.number}
                        </div>
                        <div className="suggested-route-info">
                          <h4 className="suggested-route-name">{route.name}</h4>
                          <p className="suggested-route-fare">Fare: {route.fare || '₱11.00 - ₱15.00'}</p>
                          <p className="suggested-route-frequency">
                            {route.frequency || 'Every 5-10 mins'}
                          </p>
                        </div>
                        <div className="suggested-route-arrow">{expandedRouteId === route.id ? '▼' : '→'}</div>
                      </div>

                      {expandedRouteId === route.id && (
                        <div className="route-details-expanded">
                          <div className="route-details">
                            <div className="route-details-content">
                              <div className="route-info">
                                <h3 className="route-name">{route.name}</h3>
                                <p className="route-distance">Complete Route Loop</p>

                                <div className="route-stats">
                                  <div>
                                    <p className="stat-label">Fare:</p>
                                    <p className="stat-value">{route.fare || '₱11.00 - ₱15.00'}</p>
                                  </div>
                                  <div>
                                    <p className="stat-label">Travel Time:</p>
                                    <p className="stat-value">{route.travelTime || '30-45 mins'}</p>
                                  </div>
                                  <div>
                                    <p className="stat-label">Next Jeepney:</p>
                                    <p className="stat-value">~5 mins</p>
                                  </div>
                                </div>

                                <div>
                                  <p className="route-desc-label">Route Description:</p>
                                  <p className="route-desc-text">
                                    {route.description || 'This route is part of the Bacolod City LPTRP.'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="sidebar">
            <div className="card">
              <h2 className="card-title">Latest Announcements</h2>
              
              <div className="announcements">
                {announcements.length > 0 ? (
                  announcements
                    .sort((a, b) => {
                      // Important notices first
                      if (a.isImportant && !b.isImportant) return -1;
                      if (!a.isImportant && b.isImportant) return 1;
                      return 0;
                    })
                    .slice(0, 3)
                    .map(announcement => (
                    <div key={announcement.id} className={`announcement-card ${announcement.isImportant ? 'important' : 'general'}`}>
                      <h3 className="announcement-title">{announcement.title}</h3>
                      <p className="announcement-desc">{announcement.description}</p>
                      <div className="announcement-footer">
                        <p className="announcement-date">Posted: {announcement.date}</p>
                        {announcement.isImportant && (
                          <span className="announcement-badge">Important Notice</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>No announcements yet</p>
                )}
              </div>

              <button className="link-btn" onClick={() => onNavigate('announcements')}>
                View All Announcements
              </button>
            </div>

            <div className="card">
              <h2 className="card-title">Nearby Landmarks</h2>
              
              <div className="landmarks">
                {nearbyLandmarks.length > 0 ? (
                  nearbyLandmarks.map(landmark => (
                    <div key={landmark.id} className="landmark-item">
                      <div className="landmark-icon">
                        <MapPinSmallIcon />
                      </div>
                      <div>
                        <h3 className="landmark-name">{landmark.name}</h3>
                        <p className="landmark-distance">{landmark.category} • {landmark.distance.toFixed(1)} km away</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>No nearby landmarks within 5 km</p>
                )}
              </div>

              <button className="link-btn" onClick={() => onNavigate('landmarks')}>
                View All Landmarks
              </button>
            </div>

            <div className="card">
              <h2 className="card-title">Help Us Improve</h2>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                Your feedback helps us make JeepneyMap better for everyone.
              </p>
              <button 
                className="btn-primary"
                onClick={() => setShowFeedbackForm(true)}
              >
                Share Your Feedback
              </button>
            </div>
          </div>
        </div>
      </div>

      <FeedbackForm 
        isOpen={showFeedbackForm} 
        onClose={() => setShowFeedbackForm(false)} 
      />
    </div>
  );
};

export default JeepneyMap;