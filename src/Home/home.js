// All logic is inside the main JeepneyMap below. Imports must be at the top.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, normalizeDocData } from '../firebase';
import { geocodeAddress, reverseGeocode } from '../utils/geocodingService';
import { findNearbyRoutes, formatDistance, searchRoutesByNameOrProximity, getRadiusFromZoom, enhanceRoutesWithGPS, isSingleRouteSufficient, findMultiLegJourneys, rankMultiLegJourneys } from '../utils/routeMatchingService';
import { calculateBounds, addPaddingToBounds } from '../utils/boundsCalculator';
import FeedbackForm from '../Feedback/FeedbackForm';
import LocationSelector from '../components/LocationSelector';
import DestinationSelector from '../components/DestinationSelector';
import '../components/location-selector.css';
import '../components/destination-selector.css';
// Navbar moved to App.js (top-level)
import LeafletMap from '../Map/LeafletMap';
function JeepneyMap({ onNavigate, onRequestLogin, onAdminEditingChange }) {

  // --- State variables ---
  const [landmarks, setLandmarks] = useState([]);
  const [destination, setDestination] = useState("");
  const [jeepneyRoutes, setJeepneyRoutes] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [gpsPermission, setGpsPermission] = useState('default');
  const [suggestedRoutes, setSuggestedRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [searchType, setSearchType] = useState(null);
  const [selectedDestinationCoords, setSelectedDestinationCoords] = useState(null);
  const [destinationDescription, setDestinationDescription] = useState("");
  const [currentZoom, setCurrentZoom] = useState(15);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [multiLegJourneys, setMultiLegJourneys] = useState([]); // State for multi-leg journeys
  const [directRoutes, setDirectRoutes] = useState([]); // State for direct (one-way) routes
  const [hasDirectRoute, setHasDirectRoute] = useState(false); // Robust flag for direct route
  const [announcements, setAnnouncements] = useState([]);
  const [nearbyLandmarks, setNearbyLandmarks] = useState([]);
  // --- Add missing state for expanded route, search phase, etc. ---
  const [expandedRouteId, setExpandedRouteId] = useState(null);
  const [searchPhase, setSearchPhase] = useState('idle');
  const [showOnlyDestination, setShowOnlyDestination] = useState(false);
  const [showOnlySuggestedRoutes, setShowOnlySuggestedRoutes] = useState(false);
  const [highlightedStops, setHighlightedStops] = useState([]);
  const [zoomBounds, setZoomBounds] = useState(null);
  const [selectedMultiLegJourney, setSelectedMultiLegJourney] = useState(null);
  const [userLocationName, setUserLocationName] = useState(null);
  const routeDetailsRef = useRef(null);

  // --- Utility function for fallback ---
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    // Haversine formula
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Fetch announcements and landmarks (replace with your actual Firestore logic)
  useEffect(() => {
    // Fetch announcements
    // Replace with your Firestore or API logic
    setAnnouncements([
      // Example data
      // { id: '1', title: 'System Update', description: 'New features added!', date: '2026-01-10', isImportant: true },
    ]);

    // Fetch nearby landmarks
    // Replace with your actual logic for finding nearby landmarks
    setNearbyLandmarks([
      // Example data
      // { id: 'lm1', name: 'SM City', category: 'Mall', distance: 1.2 },
    ]);
  }, []);

  // All logic, hooks, and JSX are now inside the JeepneyMap function. No code should exist outside the function except imports and export default.

  // Find the definition of the function that contains 'await geocodeAddress(destination)' and make it async.
  // For example, if you have:
  // const handleFindRoute = () => { ... await ... }
  // Change to:
  // const handleFindRoute = async () => { ... await ... }

  // Route-finding logic moved into an async function
  const handleFindRoute = async () => {
    // First, try to find in landmarks
    let coords = null;
    let foundInSystem = false;
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

    // Set destination coordinates if found, or fallback to a major stop or landmark
    if (coords) {
      console.log('📍 Setting selected destination coords:', coords);
      setSelectedDestinationCoords(coords);

      // --- Direct route detection logic ---
      // Only run if both userLocation and coords are available
      if (userLocation && coords.length === 2) {
        // Prepare destination as object for enhanceRoutesWithGPS
        const destinationObj = { lat: coords[0], lng: coords[1] };
        // Enhance all routes with GPS data
        const enhancedRoutes = enhanceRoutesWithGPS(jeepneyRoutes, userLocation, destinationObj);
        // Filter for direct routes (distance to destination <= 2km by default)
        // AND that have the selected destination as a major stop
        const direct = enhancedRoutes.filter(r => {
          if (r.distanceToDestination > 2) return false;
          if (!r.majorStops || !Array.isArray(r.majorStops)) return false;
          return r.majorStops.some(stop => {
            const stopName = typeof stop === 'string' ? stop : (stop?.name || '');
            return stopName.toLowerCase() === destination.toLowerCase();
          });
        });
        setDirectRoutes(direct);
        setHasDirectRoute(direct.length > 0);
        if (direct.length > 0) {
          // Hide multi-leg journeys if direct route exists
          setMultiLegJourneys([]);
          setSuggestedRoutes(direct);
          setSearchType('system');
          return;
        } else {
          setDirectRoutes([]);
          setHasDirectRoute(false);
        }
      }
    } else {
      // Fallback: Try to find the closest major stop from any route
      let fallbackCoords = null;
      let fallbackName = null;
      let minDist = Infinity;
      for (const route of jeepneyRoutes) {
        if (route.majorStops && Array.isArray(route.majorStops)) {
          for (const stop of route.majorStops) {
            let lat = stop.lat ?? (stop.coordinates ? stop.coordinates[0] : undefined);
            let lng = stop.lng ?? (stop.coordinates ? stop.coordinates[1] : undefined);
            if (lat !== undefined && lng !== undefined) {
              const dist = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, lat, lng) : 0;
              if (dist < minDist) {
                minDist = dist;
                fallbackCoords = [lat, lng];
                fallbackName = stop.name || stop;
              }
            }
          }
        }
      }
      if (fallbackCoords) {
        console.log('⚠️ Fallback: Using closest major stop as destination coords:', fallbackCoords, fallbackName);
        setSelectedDestinationCoords(fallbackCoords);
      } else {
        // Final fallback: use a landmark with coordinates
        const fallbackLandmark = landmarks.find(lm => Array.isArray(lm.coordinates) && lm.coordinates.length === 2);
        if (fallbackLandmark) {
          console.log('⚠️ Fallback: Using landmark as destination coords:', fallbackLandmark.coordinates, fallbackLandmark.name);
          setSelectedDestinationCoords(fallbackLandmark.coordinates);
        } else {
          console.log('❌ No coordinates found for destination, no fallback available');
          setSelectedDestinationCoords(null);
        }
      }
    }
  };

  // --- Effects for Firestore data, geolocation, and UI ---
  useEffect(() => {
    // Fetch jeepney routes from Firestore
    const routesUnsub = onSnapshot(
      query(collection(db, 'routes')),
      (snapshot) => {
        const routes = snapshot.docs.map(doc => normalizeDocData(doc));
        setJeepneyRoutes(routes);
      }
    );

    // Fetch landmarks from Firestore
    const landmarksUnsub = onSnapshot(
      query(collection(db, 'landmarks')),
      (snapshot) => {
        const lm = snapshot.docs.map(doc => normalizeDocData(doc));
        setLandmarks(lm);
      }
    );

    // Fetch announcements from Firestore
    const announcementsUnsub = onSnapshot(
      query(collection(db, 'announcements')),
      (snapshot) => {
        const anns = snapshot.docs.map(doc => normalizeDocData(doc));
        setAnnouncements(anns);
      }
    );

    return () => {
      routesUnsub();
      landmarksUnsub();
      announcementsUnsub();
    };
  }, []);

  // Compute nearby landmarks when userLocation or landmarks change
  useEffect(() => {
    if (!userLocation || !landmarks.length) {
      setNearbyLandmarks([]);
      return;
    }
    const maxDistanceKm = 5;
    const nearby = landmarks
      .map(lm => {
        if (!lm.coordinates || lm.coordinates.length !== 2) return null;
        const [lat, lng] = lm.coordinates;
        const dist = calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
        return { ...lm, distance: dist };
      })
      .filter(lm => lm && lm.distance <= maxDistanceKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
    setNearbyLandmarks(nearby);
  }, [userLocation, landmarks]);

  useEffect(() => {
    if (userLocation) {
      reverseGeocode(userLocation.lat, userLocation.lng).then(locationName => {
        setUserLocationName(locationName);
      });
    } else {
      setUserLocationName(null);
    }
  }, [userLocation]);

  return (
    <React.Fragment>
      <div className="app">
        {/* Navbar is rendered by App.js */}
        <div className="main-container">
          <div className="main-grid">
            <div className="main-content">
              {/* Location and Destination Selectors */}
              <div className="card">
                <h2 className="card-title">Welcome to JeepneyMap!</h2>
                <div className="form-grid" style={{ marginBottom: '20px' }}>
                  <LocationSelector 
                    landmarks={landmarks}
                    onLocationSelect={(location) => {
                      setUserLocation(location && Array.isArray(location.coordinates) && location.coordinates.length === 2
                        ? { lat: location.coordinates[0], lng: location.coordinates[1] }
                        : null);
                    }}
                    selectedLocation={userLocation}
                  />
                  <DestinationSelector 
                    routes={jeepneyRoutes}
                    landmarks={landmarks}
                    onDestinationSelect={(destination) => {
                      setDestination(destination && destination.name ? destination.name : "");
                      setDestinationDescription(
                        destination
                          ? (destination.type === 'stop' ? destination.routeName : destination.category || "")
                          : ""
                      );
                    }}
                    selectedDestination={{ name: destination }}
                  />
                </div>
                <button 
                  onClick={() => {
                    if (!userLocation || !destination) {
                      alert('Please select both your location and destination');
                      return;
                    }
                    handleFindRoute();
                  }}
                  className="btn-primary"
                  disabled={!userLocation || !destination}
                >
                  Find Stops
                </button>
              </div>
              {/* Multi-leg journey panel above the map (only if no direct route) */}
              {!hasDirectRoute && multiLegJourneys && multiLegJourneys.length > 0 && (
                <div className="multi-leg-journeys-panel">
                  <h3>🚌 Multi-Leg Journey Options</h3>
                  <ol>
                    {multiLegJourneys.slice(0, 5).map((journey, idx) => (
                      <li key={idx}>
                        {journey.legs.map((leg, i) => (
                          <span key={i}>
                            <b>{leg.route.number}</b>{i < journey.legs.length - 1 ? ' → ' : ''}
                          </span>
                        ))}
                        <span style={{color: '#666', fontSize: '0.9em'}}> (Transfers: {journey.transfers}, Distance: {journey.totalDistance.toFixed(2)}km)</span>
                        {journey.walkToDestination && (
                          <span style={{color: '#f59e42', marginLeft: '0.5em'}}>+ Walk {journey.walkToDestination.distanceKm.toFixed(2)}km to destination</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {/* Available Jeepneys section */}
              {suggestedRoutes.length > 0 && (
                <div className="card suggested-jeepneys">
                  <h2 className="card-title">Available Jeepneys to {destination}</h2>
                  {/* Search type feedback message */}
                  {searchType === 'system' && (
                    <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', backgroundColor: '#d1fae5', borderLeft: '4px solid #10b981', borderRadius: '0.375rem', color: '#065f46', fontSize: '14px' }}>
                      ✓ Found "{destination}" in the system - showing jeepneys that have this stop
                    </div>
                  )}
                  {searchType === 'geocoded' && (
                    <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', backgroundColor: '#fef3c7', borderLeft: '4px solid #f59e0b', borderRadius: '0.375rem', color: '#78350f', fontSize: '14px' }}>
                      📍 "{destination}" was located using map search - showing jeepneys passing nearby
                    </div>
                  )}
                  {searchType === 'fallback' && (
                    <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', backgroundColor: '#e0e7ff', borderLeft: '4px solid #6366f1', borderRadius: '0.375rem', color: '#312e81', fontSize: '14px' }}>
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
                            setSearchPhase('viewing-route');
                          }}
                        >
                          <div className="suggested-route-number" style={{ backgroundColor: route.color }}>{route.number}</div>
                          <div className="suggested-route-info">
                            <h4 className="suggested-route-name">{route.name}</h4>
                            <p className="suggested-route-fare">Fare: {route.fare || '₱11.00 - ₱15.00'}</p>
                            <p className="suggested-route-frequency">{route.frequency || 'Every 5-10 mins'}</p>
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
                                    <p className="route-desc-text">{route.description || 'This route is part of the Bacolod City LPTRP.'}</p>
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
              {/* Map below the multi-leg journey panel and available jeepneys */}
              <LeafletMap
                routes={jeepneyRoutes}
                selectedRoute={selectedRoute}
                userLocation={userLocation}
                landmarks={landmarks}
                highlightedStops={highlightedStops}
                suggestedRoutes={suggestedRoutes}
                destination={destination}
                selectedDestination={selectedDestinationCoords}
                destinationDescription={destinationDescription}
                showLandmarks={!selectedDestinationCoords}
                zoomBounds={zoomBounds}
                searchType={searchType}
                onRouteClick={(route) => { setSelectedRoute(route); }}
                onZoomChange={(zoom) => setCurrentZoom(zoom)}
                searchPhase={searchPhase}
                showOnlyDestination={showOnlyDestination}
                showOnlySuggestedRoutes={showOnlySuggestedRoutes}
              />
            </div>
            {/* Sidebar restored as before */}
            <div className="sidebar">
              {/* Sidebar cards restored here */}
              <div className="card">
                <h2 className="card-title">Latest Announcements</h2>
                <div className="announcements">
                  {announcements && announcements.length > 0 ? (
                    announcements
                      .sort((a, b) => {
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
                  {nearbyLandmarks && nearbyLandmarks.length > 0 ? (
                    nearbyLandmarks.map(landmark => (
                      <div key={landmark.id} className="landmark-item">
                        <div className="landmark-icon">
                          {/* <MapPinSmallIcon /> */}
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
    </React.Fragment>
  );
}
export default JeepneyMap;