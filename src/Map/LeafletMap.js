import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, LayersControl, ZoomControl, useMap, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { boundsToLeafletFormat, addPaddingToBounds } from '../utils/boundsCalculator';
import { findMultiLegJourneys, rankMultiLegJourneys } from '../utils/routeMatchingService';
import './leaflet-map-multileg.css';

// Helper function to calculate distance between two coordinates (Haversine formula)
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

// Helper function to safely get coordinates
const getCoordinates = (coords) => {
  if (!coords) return null;
  if (Array.isArray(coords) && coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
    return [coords[0], coords[1]];
  }
  if (coords.lat !== undefined && coords.lng !== undefined && !isNaN(coords.lat) && !isNaN(coords.lng)) {
    return [coords.lat, coords.lng];
  }
  if (coords.latitude !== undefined && coords.longitude !== undefined && !isNaN(coords.latitude) && !isNaN(coords.longitude)) {
    return [coords.latitude, coords.longitude];
  }
  return null;
};

// Helper function for fuzzy/partial matching of stop names
// Matches if one string contains the other (case-insensitive)
// Example: "Advertisist Medical Center - Bacolod" matches "Advertisist Medical Center"
const stopNameMatches = (stopName, landmarkName) => {
  if (!stopName || !landmarkName) return false;
  
  const stop = stopName.toLowerCase().trim();
  const landmark = landmarkName.toLowerCase().trim();
  
  // Exact match
  if (stop === landmark) return true;
  
  // One contains the other (for cases like "Name - City" vs "Name")
  if (stop.includes(landmark) || landmark.includes(stop)) return true;
  
  // Check if landmark name is a substring at the start (for partial matches)
  if (stop.startsWith(landmark) || landmark.startsWith(stop)) return true;
  
  return false;
};

// Fix default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different marker types
const createStopIcon = (color = '#3b82f6') => {
  return L.divIcon({
    html: `<svg width="50" height="65" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));"><path d="M 20 0 C 12 0 5 7 5 16 C 5 28 20 50 20 50 C 20 50 35 28 35 16 C 35 7 28 0 20 0 Z" fill="${color}" stroke="white" stroke-width="2.5"/><circle cx="20" cy="16" r="6" fill="white"/></svg>`,
    className: 'stop-marker',
    iconSize: [50, 65],
    iconAnchor: [25, 65],
    popupAnchor: [0, -65],
  });
};

const createLandmarkIcon = (color = '#2196F3') => {
  return L.divIcon({
    html: `<svg width="50" height="65" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));"><path d="M 20 0 C 12 0 5 7 5 16 C 5 28 20 50 20 50 C 20 50 35 28 35 16 C 35 7 28 0 20 0 Z" fill="${color}" stroke="white" stroke-width="2.5"/><circle cx="20" cy="16" r="6" fill="white"/></svg>`,
    className: 'landmark-marker',
    iconSize: [50, 65],
    iconAnchor: [25, 65],
    popupAnchor: [0, -65],
  });
};

const TRANSFER_ICON = L.divIcon({
  html: `<svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#fff" stroke="#6366f1" stroke-width="3"/><text x="16" y="22" text-anchor="middle" font-size="18" fill="#6366f1" font-family="Arial" font-weight="bold">T</text></svg>`,
  className: 'transfer-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Component to handle map click for location selection
const LocationSelectionHandler = ({ editingStopLocation, onLocationSelect }) => {
  const map = useMap();

  useEffect(() => {
    if (!editingStopLocation || !map) return;

    // Set initial center if location has coordinates
    if (editingStopLocation.coordinates) {
      const coords = getCoordinates(editingStopLocation.coordinates);
      if (coords) {
        try {
          map.setView(coords, 15);
        } catch (err) {
          console.error('Error setting map view:', err);
        }
      }
    }

    const handleMapClick = (e) => {
      try {
        const { lat, lng } = e.latlng;
        if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
          if (onLocationSelect) {
            onLocationSelect([lat, lng]);
          }
        }
      } catch (err) {
        console.error('Error handling map click:', err);
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, editingStopLocation, onLocationSelect]);

  return null;
};

// Component to handle map zoom to bounds
const BoundsHandler = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    console.log('🔄 BoundsHandler useEffect triggered. bounds:', bounds, 'map:', !!map);
    
    if (!map) {
      console.warn('⚠️ Map not ready in BoundsHandler');
      return;
    }
    
    if (!bounds) {
      console.log('ℹ️ No bounds provided to BoundsHandler');
      return;
    }

    try {
      console.log('📦 Processing bounds:', bounds);
      // Add 10% padding to bounds for better visibility
      const paddedBounds = addPaddingToBounds(bounds, 0.1);
      console.log('📦 Padded bounds:', paddedBounds);
      
      const leafletBounds = boundsToLeafletFormat(paddedBounds);
      console.log('📦 Leaflet bounds format:', leafletBounds);

      if (leafletBounds) {
        console.log('🎯 Calling map.flyToBounds with:', leafletBounds);
        // Use flyTo for smooth animation
        map.flyToBounds(leafletBounds, {
          padding: [50, 50],
          duration: 1.5,
          easeLinearity: 0.25
        });
        console.log('✅ flyToBounds called successfully');
      } else {
        console.error('❌ boundsToLeafletFormat returned null');
      }
    } catch (err) {
      console.error('❌ Error fitting bounds:', err);
    }
  }, [map, bounds]);

  return null;
};

// Component to handle map zoom and centering on destination
const DestinationMarkerHandler = ({ selectedDestination, userLocation }) => {
  const map = useMap();

  useEffect(() => {
    if (!selectedDestination || !userLocation) return;

    // Clear existing custom markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer.isCustomMarker) {
        map.removeLayer(layer);
      }
    });

    // Add user location marker (blue)
    const userMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 8,
      fillColor: '#3b82f6',
      color: '#1e40af',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(map);
    userMarker.isCustomMarker = true;
    userMarker.bindPopup('Your Location');

    // Add destination marker (red)
    const destMarker = L.circleMarker([selectedDestination[0], selectedDestination[1]], {
      radius: 8,
      fillColor: '#ef4444',
      color: '#7f1d1d',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(map);
    destMarker.isCustomMarker = true;
    destMarker.bindPopup('Destination');

    // Calculate bounds to fit both markers
    const bounds = L.latLngBounds(
      [userLocation.lat, userLocation.lng],
      [selectedDestination[0], selectedDestination[1]]
    );

    // Smooth zoom animation to fit both markers
    map.fitBounds(bounds, { padding: [100, 100], animate: true, duration: 1 });
  }, [selectedDestination, userLocation, map]);

  return null;
};

// Component to track current zoom level and report back to parent
const ZoomLevelTracker = ({ onZoomChange }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !onZoomChange) return;

    // Report initial zoom
    onZoomChange(map.getZoom());

    // Listen for zoom changes
    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };

    map.on('zoom', handleZoom);

    return () => {
      map.off('zoom', handleZoom);
    };
  }, [map, onZoomChange]);

  return null;
};

const MapZoomHandler = ({ destination, landmarks, selectedRoute, routes = [] }) => {
  const map = useMap();

  useEffect(() => {
    console.log('MapZoomHandler triggered:', { destination, landmarksCount: landmarks.length, routesCount: routes.length });
    
    if (!destination || landmarks.length === 0) {
      console.log('Skipping zoom: destination missing or no landmarks');
      return;
    }

    // First, try to find the destination in landmarks directly
    let destinationLandmark = landmarks.find(lm => 
      lm.name.toLowerCase() === destination.toLowerCase()
    );

    console.log('Direct landmark search result:', destinationLandmark?.name);

    // If not found in landmarks, search in routes' major stops
    if (!destinationLandmark) {
      console.log('Not found in landmarks, searching in routes...');
      // Search through all routes to find this stop
      for (let route of routes) {
        if (route.majorStops && Array.isArray(route.majorStops)) {
          const foundStop = route.majorStops.find(stop => {
            const stopName = typeof stop === 'string' ? stop : (stop?.name || '');
            return stopName.toLowerCase() === destination.toLowerCase();
          });
          
          if (foundStop) {
            const foundStopName = typeof foundStop === 'string' ? foundStop : foundStop?.name;
            console.log('Found stop in route:', route.number, foundStopName);
            // Found the stop in a route, now find it in landmarks
            destinationLandmark = landmarks.find(lm => 
              lm.name.toLowerCase() === foundStopName.toLowerCase()
            );
            console.log('Found landmark for stop:', destinationLandmark?.name);
            if (destinationLandmark) break; // Found the landmark, exit loop
          }
        }
      }
    }

    // If we found the destination landmark, zoom to it
    if (destinationLandmark) {
      const pos = getCoordinates(destinationLandmark.coordinates);
      if (pos) {
        try {
          console.log('Zooming to position:', pos);
          // Zoom and center with smooth animation
          map.setView(pos, 16, { animate: true, duration: 1 });
        } catch (err) {
          console.error('Error zooming to destination:', err);
        }
      }
    } else {
      console.log('Destination landmark not found or no coordinates');
    }
  }, [destination, landmarks, selectedRoute, routes, map]);

  return null;
};

// Component to handle zoom to destination with search type (system or geocoded)
const DestinationZoomHandler = ({ searchType = '', selectedDestination }) => {
  const map = useMap();

  useEffect(() => {
    // Only zoom if we have a search type (system or geocoded) and destination coordinates
    if ((searchType === 'system' || searchType === 'geocoded') && selectedDestination) {
      console.log('🔍 DestinationZoomHandler: Zooming to destination at building level', {
        searchType,
        destination: selectedDestination
      });
      
      try {
        // Zoom to building level (18) at the destination
        map.setView([selectedDestination[0], selectedDestination[1]], 18, {
          animate: true,
          duration: 1.5
        });
        console.log('✅ Zoomed to destination at level 18');
      } catch (err) {
        console.error('❌ Error zooming to destination:', err);
      }
    }
  }, [searchType, selectedDestination, map]);

  return null;
};

const renderDirectionsPanel = (multiLegJourney, userLocation, selectedDestination) => {
  if (!multiLegJourney || !userLocation || !selectedDestination) return null;
  const { legs } = multiLegJourney;
  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      padding: '16px',
      margin: '16px auto',
      maxWidth: 480,
      zIndex: 1000
    }}>
      <h3 style={{marginTop:0, color:'#6366f1'}}>Step-by-Step Directions</h3>
      <ol style={{paddingLeft: '1.2em'}}>
        {legs.map((leg, idx) => {
          const isLast = idx === legs.length - 1;
          const start = idx === 0 ? 'Your location' : (legs[idx-1].alighting?.name || 'Transfer Point');
          const end = isLast ? 'Your destination' : (leg.alighting?.name || 'Transfer Point');
          return (
            <li key={idx} style={{marginBottom: '12px'}}>
              <div>
                <span style={{fontWeight:'bold', color:'#6366f1'}}>Ride {leg.route.name}</span><br/>
                Board at <b>{start}</b> and alight at <b>{end}</b>.
                {!isLast && (
                  <div style={{marginTop:'4px', color:'#f59e42'}}>
                    Transfer to next jeepney at <b>{end}</b>.
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};


const LeafletMap = (props) => {
  const {
    routes = [],
    selectedRoute,
    userLocation,
    landmarks = [],
    onRouteClick,
    highlightedStops = [],
    destination = '',
    suggestedRoutes = [],
    editingStopLocation,
    onLocationSelect,
    selectedDestination,
    destinationDescription = '',
    showLandmarks = true,
    zoomBounds = null,
    searchType = '',
    searchPhase = 'idle',
    showOnlyDestination = false,
    showOnlySuggestedRoutes = false,
    onZoomChange,
    hasDirectRoute = false,
    directRoutes = []
  } = props;

  // Multi-leg journey state
  let multiLegJourney = null;
  let transferMarkers = [];
  let allMultiLegJourneys = [];
  if (userLocation && selectedDestination && Array.isArray(selectedDestination) && routes.length > 0) {
    const journeys = rankMultiLegJourneys(
      findMultiLegJourneys(
        { lat: userLocation.lat, lng: userLocation.lng },
        { lat: selectedDestination[0], lng: selectedDestination[1] },
        routes,
        3 // max 3 legs for consistency with Home.js
      )
    );
    allMultiLegJourneys = journeys;
    if (journeys.length > 0) {
      multiLegJourney = journeys[0];
      transferMarkers = multiLegJourney.legs
        .filter((leg, idx) => idx > 0 && leg.alighting && leg.alighting.name)
        .map((leg, idx) => ({
          pos: [leg.alighting.lat, leg.alighting.lng],
          name: leg.alighting.name
        }));
    }
    console.log('[LeafletMap] Multi-leg journeys found:', journeys.length, journeys);
  } else {
    console.log('[LeafletMap] Multi-leg journey NOT computed. userLocation:', userLocation, 'selectedDestination:', selectedDestination, 'routes:', routes.length);
  }

  // Expanded bounds to include Bacolod, Binalbagan, and Isabela municipalities (wider scope)
  const bacolodbounds = [
    [10.20, 122.80],     // Southwest corner (covers Binalbagan and southern area)
    [10.90, 123.50]      // Northeast corner (covers Isabela and eastern area)
  ];
  
  const bacolodboundsCenter = [10.6475, 123.0125]; // Center of Bacolod City
  const center = userLocation ? [userLocation.lat, userLocation.lng] : bacolodboundsCenter;

  // Filtered routes for polylines: if hasDirectRoute, only show directRoutes; else, show selected multi-leg journey routes if available
  let polylineRoutes = routes;
  if (hasDirectRoute && directRoutes.length > 0) {
    polylineRoutes = directRoutes;
  } else if (props.multiLegJourneyRoutes && props.multiLegJourneyRoutes.length > 0) {
    polylineRoutes = props.multiLegJourneyRoutes;
  }

  // Cap zoom to 16 if showing direct route
  const mapZoom = hasDirectRoute ? 16 : 10;

  return (
    <>
      {/* Directions panel for selected multi-leg journey (from Home.js) */}
      {props.selectedMultiLegJourney && renderDirectionsPanel(props.selectedMultiLegJourney, userLocation, selectedDestination)}
      <div className="leaflet-map" style={{ height: '100%', width: '100%', minHeight: '500px' }}>
        <MapContainer 
          center={center} 
          zoom={mapZoom}
          minZoom={8}
          maxZoom={16}
          maxBounds={bacolodbounds}
          maxBoundsViscosity={1.0}
          scrollWheelZoom={true}
          wheelPxPerZoomLevel={60}
          style={{ height: '100%', width: '100%' }} 
          zoomControl={false}
        >
          <ZoomControl position="topright" />
          <ZoomLevelTracker onZoomChange={onZoomChange} />
          {editingStopLocation && <LocationSelectionHandler editingStopLocation={editingStopLocation} onLocationSelect={onLocationSelect} />}
          {zoomBounds && <BoundsHandler bounds={zoomBounds} />}
          <DestinationZoomHandler 
            searchType={searchType}
            selectedDestination={selectedDestination}
          />
          <MapZoomHandler 
            destination={destination}
            landmarks={landmarks}
            selectedRoute={selectedRoute}
            routes={routes}
          />
          {/* Custom destination marker with description popup */}
          {selectedDestination && (
            <Marker position={selectedDestination} icon={createLandmarkIcon('#ef4444')}>
              <Popup>
                <div style={{ fontWeight: 'bold', color: '#ef4444', marginBottom: '4px' }}>
                  {destination}
                </div>
                {destinationDescription && (
                  <div style={{ color: '#888', fontSize: '13px', marginBottom: '4px' }}>
                    {destinationDescription}
                  </div>
                )}
                <div style={{ color: '#222', fontSize: '12px' }}>Pinned Destination</div>
              </Popup>
            </Marker>
          )}
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="CartoDB Voyager">
              <TileLayer
                attribution='&copy; <a href="https://carto.com/attributions">CartoDB</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* Render route polylines for routes with coordinates */}
          {polylineRoutes && polylineRoutes.map(route => {
            try {
              // NEW: Validate majorStops have proper coordinates
              if (route.majorStops && Array.isArray(route.majorStops)) {
                route.majorStops.forEach((stop, idx) => {
                  if (typeof stop === 'object' && stop !== null) {
                    if (typeof stop.lat !== 'number' || typeof stop.lng !== 'number') {
                      console.warn(`⚠️ Route ${route.number} - Stop ${idx} (${stop.name}) has invalid coordinates:`, {
                        hasLat: typeof stop.lat,
                        hasLng: typeof stop.lng,
                        lat: stop.lat,
                        lng: stop.lng,
                        fullStop: stop
                      });
                    }
                  }
                });
              }

              if (!route.coordinates || !Array.isArray(route.coordinates) || route.coordinates.length < 2) {
                return null;
              }

              // NEW: Filter routes based on search phase
              if (showOnlySuggestedRoutes && suggestedRoutes.length > 0) {
                // Only show routes that are in the suggested list OR the currently selected route
                const isSuggested = suggestedRoutes.some(suggested => suggested.id === route.id);
                const isSelected = selectedRoute && selectedRoute.id === route.id;
                if (!isSuggested && !isSelected) {
                  return null;
                }
              }

              // Normalize coordinates: convert {lat, lng} objects to [lat, lng] arrays
              const normalizedCoords = route.coordinates.map(coord => {
                // Already in array format [lat, lng]
                if (Array.isArray(coord) && coord.length === 2) {
                  return coord;
                }
                // Object format {lat, lng}
                if (coord && typeof coord.lat === 'number' && typeof coord.lng === 'number') {
                  return [coord.lat, coord.lng];
                }
                // Latitude/longitude property names
                if (coord && typeof coord.latitude === 'number' && typeof coord.longitude === 'number') {
                  return [coord.latitude, coord.longitude];
                }
                // Log problematic coordinate
                console.warn(`⚠️ Route ${route.number}: Invalid coordinate format:`, coord);
                return null;
              }).filter(coord => coord !== null);

              // Validate that all coordinates are valid [lat, lng] pairs
              const validCoords = normalizedCoords.filter(coord => {
                // Must be an array with 2 elements
                if (!Array.isArray(coord) || coord.length !== 2) {
                  return false;
                }
                // Must have valid lat/lng numbers
                if (typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
                  return false;
                }
                // Check for NaN values
                if (isNaN(coord[0]) || isNaN(coord[1])) {
                  return false;
                }
                // Check valid lat/lng ranges
                if (coord[0] < -90 || coord[0] > 90) {
                  return false;
                }
                if (coord[1] < -180 || coord[1] > 180) {
                  return false;
                }
                return true;
              });

              if (validCoords.length < 2) {
                console.warn(`⚠️ Route ${route.id} (${route.number}): has only ${validCoords.length} valid coordinates after normalization (had ${normalizedCoords.length} normalized), skipping render`);
                console.warn(`   Original coordinates:`, route.coordinates);
                console.warn(`   Normalized coordinates:`, normalizedCoords);
                console.warn(`   Valid coordinates:`, validCoords);
                return null;
              }

              // Check if this route is selected
              const isSelected = selectedRoute && selectedRoute.id === route.id;
              const opacity = isSelected ? 1.0 : 0.6;
              const weight = isSelected ? 6 : 4;

              return (
                <Polyline
                  key={route.id}
                  positions={validCoords}
                  className="route-transition"
                  pathOptions={{
                    color: route.color || '#3b82f6',
                    weight: weight,
                    opacity: opacity,
                    lineJoin: 'round',
                    lineCap: 'round'
                  }}
                >
                <Popup>
                  <div style={{ fontWeight: 'bold', color: route.color }}>
                    Route {route.number}: {route.name}
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    {route.description}
                  </div>
                </Popup>
              </Polyline>
              );
            } catch (err) {
              console.error(`❌ Error rendering route ${route.id}:`, err);
              return null;
            }
          })}

          {showLandmarks && landmarks.map(landmark => {
            if (!landmark || !landmark.id) return null;

            let pos = getCoordinates(landmark.coordinates);
            
            if (!pos) return null;
            
            // NEW: Phase-aware landmark filtering
            if (showOnlyDestination && destination) {
              // During search phase, only show the searched destination
              if (landmark.name.toLowerCase() !== destination.toLowerCase()) {
                return null;
              }
            } else if (showOnlySuggestedRoutes && suggestedRoutes.length > 0) {
              // During suggestions/route view, show stops of ANY suggested route (or selected route)
              let isInAnyRoute = false;
              
              // Check if landmark is in the selected route
              if (selectedRoute && selectedRoute.majorStops) {
                isInAnyRoute = selectedRoute.majorStops.some(stop => {
                  const stopName = typeof stop === 'string' ? stop : (stop?.name || '');
                  return stopNameMatches(stopName, landmark.name);
                });
              }
              
              // If not in selected route, check all suggested routes
              if (!isInAnyRoute) {
                isInAnyRoute = suggestedRoutes.some(route => {
                  if (!route.majorStops) return false;
                  return route.majorStops.some(stop => {
                    const stopName = typeof stop === 'string' ? stop : (stop?.name || '');
                    return stopNameMatches(stopName, landmark.name);
                  });
                });
              }
              
              if (!isInAnyRoute) {
                return null;
              }
            }
            
            // Handle system search: only show the exact destination landmark
            if (searchType === 'system' && destination) {
              if (landmark.name.toLowerCase() !== destination.toLowerCase()) {
                return null; // Only show the searched destination
              }
            }
            
            // Handle geocoded search: only show major stops within 5km of the geocoded location
            if (searchType === 'geocoded' && selectedRoute && selectedRoute.majorStops && selectedDestination) {
              // Check if landmark is a major stop of the selected route
              const isInSelectedRoute = selectedRoute.majorStops.some(stop => {
                const stopName = typeof stop === 'string' ? stop : (stop?.name || '');
                return stopNameMatches(stopName, landmark.name);
              });
              
              if (!isInSelectedRoute) {
                return null; // Not a major stop of selected route
              }
              
              // Check if landmark is within 5km of the geocoded destination
              const distance = calculateDistance(
                selectedDestination[0],
                selectedDestination[1],
                pos[0],
                pos[1]
              );
              
              if (distance > 5) {
                return null; // Beyond 5km range
              }
            }
            
            // Check if we're in focused mode (no search type set, just browsing)
            const isFocusedMode = selectedRoute && !searchType && highlightedStops.length === 0;
            
            // In focused mode, only show landmarks that are major stops of the selected route
            if (isFocusedMode && (!selectedRoute.majorStops || 
                !selectedRoute.majorStops.some(stop => {
                  const stopName = typeof stop === 'string' ? stop : (stop?.name || '');
                  return stopNameMatches(stopName, landmark.name);
                }))) {
              return null;
            }
            
            // Highlight landmark if it matches the searched destination
            const isHighlighted = destination && landmark.name.toLowerCase() === destination.toLowerCase();
            
            return (
              <Marker 
                key={landmark.id} 
                position={pos}
                icon={isHighlighted ? createLandmarkIcon('#ef4444') : createLandmarkIcon('#f59e0b')}
                className={isHighlighted && searchPhase === 'viewing-route' ? 'destination-marker-highlight' : ''}
              >
                <Tooltip direction="top" offset={[0, -10]} permanent={isHighlighted}>
                  {landmark.name}
                  {isHighlighted && searchPhase === 'viewing-route' && ' (Your Destination)'}
                </Tooltip>
                <Popup>
                  <strong>{landmark.name}</strong>
                  {isHighlighted && searchPhase === 'viewing-route' && <div style={{ color: '#ef4444', fontWeight: '600', marginTop: '4px' }}>✓ Your Destination</div>}
                  <br />
                  {landmark.category && `${landmark.category} · `}
                  {landmark.address}
                </Popup>
              </Marker>
            );
          })}

          {/* Render major stops for highlighted routes (search mode) and selected route (focused mode) */}
          {((highlightedStops.length > 0) || (selectedRoute && highlightedStops.length === 0)) && selectedRoute && selectedRoute.majorStops && (
            selectedRoute.majorStops.map((stop, index) => {
              const stopName = typeof stop === 'string' ? stop : (stop?.name || '');

              // Skip rendering if this stop matches the selected destination (to avoid duplicate pin)
              if (
                selectedDestination &&
                ((Array.isArray(selectedDestination) && pos && Math.abs(selectedDestination[0] - pos[0]) < 1e-5 && Math.abs(selectedDestination[1] - pos[1]) < 1e-5) ||
                (stopNameMatches(stopName, destination)))
              ) {
                return null;
              }

              // First, try to get coordinates from the stop object itself
              let pos = null;
              if (typeof stop === 'object' && stop?.lat !== undefined && stop?.lng !== undefined) {
                pos = [stop.lat, stop.lng];
              } else {
                // Fall back to finding a matching landmark using fuzzy matching
                const matchingLandmark = landmarks.find(lm => 
                  stopNameMatches(stopName, lm.name)
                );
                if (matchingLandmark) {
                  pos = getCoordinates(matchingLandmark.coordinates);
                }
              }

              // Only render if we have coordinates from either source
              if (pos) {
                // Apply search filters to major stops

                // System search: only show the exact destination
                if (searchType === 'system' && destination) {
                  if (!stopNameMatches(stopName, destination)) {
                    return null; // Skip this stop
                  }
                }

                // Geocoded search: only show stops within 5km of the geocoded location
                if (searchType === 'geocoded' && selectedDestination) {
                  const distance = calculateDistance(
                    selectedDestination[0],
                    selectedDestination[1],
                    pos[0],
                    pos[1]
                  );

                  if (distance > 5) {
                    return null; // Skip stops beyond 5km
                  }
                }

                const isDestination = stopNameMatches(stopName, destination);
                return (
                  <Marker 
                    key={`stop-${index}`}
                    position={pos}
                    icon={createStopIcon(isDestination ? '#ef4444' : selectedRoute.color)}
                  >
                    <Tooltip direction="top" offset={[0, -10]} permanent={isDestination}>
                      {stopName}
                    </Tooltip>
                    <Popup>
                      <strong>{stopName}</strong>
                      <br />
                      {isDestination && '⭐ Your Destination'}
                    </Popup>
                  </Marker>
                );
              }

              return null;
            })
          )}

          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lng]}>
              <Popup>Your location</Popup>
            </Marker>
          )}

          {/* Render multi-leg journey if available */}
          {multiLegJourney && multiLegJourney.legs.map((leg, idx) => {
            // Draw each leg as a Polyline
            const route = leg.route;
            if (!route || !route.stops || route.stops.length < 2) return null;
            const positions = route.stops.map(stop => [stop.lat, stop.lng]);
            // Alternate colors for each leg
            const colors = ['#6366f1', '#f59e42', '#10b981'];
            return (
              <Polyline
                key={`multi-leg-${idx}`}
                positions={positions}
                pathOptions={{
                  color: colors[idx % colors.length],
                  weight: 7,
                  opacity: 0.85,
                  dashArray: idx > 0 ? '8 12' : undefined
                }}
              >
                <Tooltip direction="center" offset={[0, 0]} permanent>
                  {route.name}
                </Tooltip>
              </Polyline>
            );
          })}
          {/* Render transfer markers */}
          {transferMarkers.map((tm, idx) => (
            <Marker key={`transfer-${idx}`} position={tm.pos} icon={TRANSFER_ICON}>
              <Popup>
                <strong>Transfer Point</strong><br />
                {tm.name}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </>
  );
};

export default LeafletMap;