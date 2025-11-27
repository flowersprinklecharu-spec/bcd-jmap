import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, normalizeDocData } from '../firebase';
import Navbar from '../Navbar/Navbar';
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

const JeepneyMap = ({ onNavigate, isAdmin, onAdminToggle, onRequestLogin }) => {
  const [destination, setDestination] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [jeepneyRoutes, setJeepneyRoutes] = useState([]);
  const [landmarks, setLandmarks] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [suggestedRoutes, setSuggestedRoutes] = useState([]);
  const [highlightedStops, setHighlightedStops] = useState([]);
  const routeDetailsRef = useRef(null);

  // Generate suggestions from routes major stops and landmarks
  const suggestions = useMemo(() => {
    const stops = new Set();
    
    // Add major stops from all routes
    jeepneyRoutes.forEach(route => {
      if (route.majorStops && Array.isArray(route.majorStops)) {
        route.majorStops.forEach(stop => {
          if (stop && typeof stop === 'string') {
            stops.add(stop);
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

    return destination.trim() === '' ? [] : filtered;
  }, [destination, jeepneyRoutes, landmarks]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Location access denied');
          setUserLocation({ lat: 10.6750, lng: 122.9500 });
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
          const data = doc.data();
          // Validate coordinates before adding to state
          if (data.coordinates) {
            // If coordinates is an array (polyline), validate each point
            if (Array.isArray(data.coordinates)) {
              const validCoords = data.coordinates.filter(coord => 
                Array.isArray(coord) && 
                coord.length === 2 && 
                typeof coord[0] === 'number' && 
                typeof coord[1] === 'number'
              );
              data.coordinates = validCoords.length > 0 ? validCoords : null;
            }
            // If coordinates is a GeoPoint, convert it
            else if (typeof data.coordinates.latitude === 'number') {
              data.coordinates = {
                latitude: data.coordinates.latitude,
                longitude: data.coordinates.longitude
              };
            }
          }
          return { id: doc.id, ...data };
        });
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
        const anns = snapshot.docs.map(d => {
          const nd = normalizeDocData(d) || {};
          return { id: nd.id ?? d.id, ...nd };
        });
        anns.sort((a, b) => {
          const ta = a.date ? Date.parse(a.date) : 0;
          const tb = b.date ? Date.parse(b.date) : 0;
          return tb - ta;
        });
        setAnnouncements(anns);
      }, (err) => {
        console.error('Announcements listener error', err);
      });

      return () => {
        unsubRoutes && unsubRoutes();
        unsubLandmarks && unsubLandmarks();
        unsubAnnouncements && unsubAnnouncements();
      };
    } catch (err) {
      console.warn('Firestore not available', err);
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

  const triggerFindRoute = (destinationName) => {
    if (!destinationName || jeepneyRoutes.length === 0) return;

    // Find all routes that have the destination in their major stops
    const matchingRoutes = jeepneyRoutes.filter(route =>
      route.majorStops && 
      route.majorStops.some(stop => 
        stop.toLowerCase() === destinationName.toLowerCase()
      )
    );

    // Also find the landmark if it matches
    const matchingLandmark = landmarks.find(lm => 
      lm.name.toLowerCase() === destinationName.toLowerCase()
    );

    // Set suggested routes (use matching routes or random selection)
    if (matchingRoutes.length > 0) {
      setSuggestedRoutes(matchingRoutes);
      setSelectedRoute(matchingRoutes[0]);
    } else {
      // Get 3 random routes as suggestions
      const randomRoutes = [];
      const shuffled = [...jeepneyRoutes].sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(3, shuffled.length); i++) {
        randomRoutes.push(shuffled[i]);
      }
      setSuggestedRoutes(randomRoutes);
      setSelectedRoute(randomRoutes[0]);
    }

    // Collect all major stops from matching routes to highlight on map
    const stopsToHighlight = [];
    matchingRoutes.forEach(route => {
      if (route.majorStops) {
        route.majorStops.forEach(stop => {
          stopsToHighlight.push(stop);
        });
      }
    });

    // Add the landmark if found
    if (matchingLandmark) {
      stopsToHighlight.push(matchingLandmark.name);
    }

    setHighlightedStops(stopsToHighlight);
    setShowRouteDetails(true);
  };

  const handleFindRoute = () => {
    triggerFindRoute(destination);
  };

  return (
    <div className="app">
      <Navbar 
        isAdmin={isAdmin} 
        onAdminToggle={onAdminToggle}
        onNavigate={onNavigate}
        onRequestLogin={onRequestLogin}
        currentPage="home"
      />

      <div className="main-container">
        <div className="main-grid">
          <div className="main-content">
            <div className="card">
              <h2 className="card-title">Find Your Route</h2>
              
              <div className="form-grid">
                <div>
                  <label className="form-label">Destination</label>
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
                    </div>
                    
                    {/* Dropdown suggestions */}
                    {showDropdown && suggestions.length > 0 && (
                      <div className="suggestions-dropdown">
                        {suggestions.slice(0, 10).map((suggestion, index) => (
                          <div
                            key={index}
                            className="suggestion-item"
                            onClick={() => {
                              setDestination(suggestion);
                              setShowDropdown(false);
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
                  onRouteClick={(route) => { setSelectedRoute(route); setShowRouteDetails(true); }}
                />
              </div>
            </div>

            {showRouteDetails && selectedRoute && (
              <div className="card" ref={routeDetailsRef}>
                <h2 className="card-title">Route Details</h2>
                
                <div className="route-details">
                  <div className="route-details-content">
                    <div 
                      className="route-badge"
                      style={{ backgroundColor: selectedRoute.color || '#2196F3' }}
                    >
                      {selectedRoute.number || selectedRoute.id}
                    </div>
                    <div className="route-info">
                      <h3 className="route-name">{selectedRoute.name}</h3>
                      <p className="route-distance">Complete Route Loop</p>

                      <div className="route-stats">
                        <div>
                          <p className="stat-label">Fare:</p>
                          <p className="stat-value">{selectedRoute.fare || '₱11.00 - ₱15.00'}</p>
                        </div>
                        <div>
                          <p className="stat-label">Travel Time:</p>
                          <p className="stat-value">{selectedRoute.travelTime || '30-45 mins'}</p>
                        </div>
                        <div>
                          <p className="stat-label">Next Jeepney:</p>
                          <p className="stat-value">~5 mins</p>
                        </div>
                      </div>

                      <div>
                        <p className="route-desc-label">Route Description:</p>
                        <p className="route-desc-text">
                          {selectedRoute.description || 'This route is part of the Bacolod City LPTRP.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {suggestedRoutes.length > 0 && (
              <div className="card">
                <h2 className="card-title">Available Jeepneys to {destination}</h2>
                
                <div className="suggested-routes">
                  {suggestedRoutes.map((route) => (
                    <div 
                      key={route.id} 
                      className={`suggested-route-item ${selectedRoute?.id === route.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedRoute(route);
                        setShowRouteDetails(true);
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
                      <div className="suggested-route-arrow">→</div>
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
                  announcements.slice(0, 5).map(announcement => (
                    <div key={announcement.id} className="announcement-card">
                      <h3 className="announcement-title">{announcement.title}</h3>
                      <p className="announcement-desc">{announcement.description}</p>
                      <p className="announcement-date">Posted: {announcement.date}</p>
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
                {landmarks.length > 0 ? (
                  landmarks.slice(0, 5).map(landmark => (
                    <div key={landmark.id} className="landmark-item">
                      <div className="landmark-icon">
                        <MapPinSmallIcon />
                      </div>
                      <div>
                        <h3 className="landmark-name">{landmark.name}</h3>
                        <p className="landmark-distance">{landmark.category}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>No landmarks yet</p>
                )}
              </div>

              <button className="link-btn" onClick={() => onNavigate('landmarks')}>
                View All Landmarks
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JeepneyMap;