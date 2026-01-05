import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, LayersControl, ZoomControl, useMap, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { boundsToLeafletFormat, addPaddingToBounds } from '../utils/boundsCalculator';

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
    html: `<div style="
      background-color: ${color};
      color: white;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 12px;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">●</div>`,
    className: 'stop-marker',
    iconSize: [28, 28],
    popupAnchor: [0, -14],
  });
};

const createLandmarkIcon = (color = '#f59e0b') => {
  return L.divIcon({
    html: `<div style="
      background-color: ${color};
      color: white;
      border-radius: 4px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">🏢</div>`,
    className: 'landmark-marker',
    iconSize: [32, 32],
    popupAnchor: [0, -16],
  });
};

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

const LeafletMap = ({ routes = [], selectedRoute, userLocation, landmarks = [], onRouteClick, highlightedStops = [], destination = '', suggestedRoutes = [], editingStopLocation, onLocationSelect, selectedDestination, showLandmarks = true, zoomBounds = null, searchType = '' }) => {
  // Bacolod City bounds (southwest and northeast corners) - tighter bounds
  const bacolodbounds = [
    [10.4050, 122.9150], // Southwest corner
    [10.8900, 123.1100]  // Northeast corner
  ];
  
  const bacolodboundsCenter = [10.6475, 123.0125]; // Center of Bacolod City
  const center = userLocation ? [userLocation.lat, userLocation.lng] : bacolodboundsCenter;

  return (
    <div className="leaflet-map" style={{ height: '100%', width: '100%', minHeight: '500px' }}>
      <MapContainer 
        center={center} 
        zoom={12}
        minZoom={11}
        maxZoom={18}
        maxBounds={bacolodbounds}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={true}
        wheelPxPerZoomLevel={60}
        style={{ height: '100%', width: '100%' }} 
        zoomControl={false}
      >
        <ZoomControl position="topright" />
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
        <DestinationMarkerHandler 
          selectedDestination={selectedDestination}
          userLocation={userLocation}
        />
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
        {routes && routes.map(route => {
          if (!route.coordinates || !Array.isArray(route.coordinates) || route.coordinates.length < 2) {
            return null;
          }

          // Validate that all coordinates are valid [lat, lng] pairs
          const validCoords = route.coordinates.filter(coord => 
            Array.isArray(coord) && 
            coord.length === 2 && 
            typeof coord[0] === 'number' && 
            typeof coord[1] === 'number' &&
            coord[0] >= -90 && coord[0] <= 90 &&
            coord[1] >= -180 && coord[1] <= 180
          );

          if (validCoords.length < 2) {
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
        })}

        {showLandmarks && landmarks.map(landmark => {
          if (!landmark || !landmark.id) return null;

          let pos = getCoordinates(landmark.coordinates);
          
          if (!pos) return null;
          
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
              return stopName.toLowerCase() === landmark.name.toLowerCase();
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
                return stopName.toLowerCase() === landmark.name.toLowerCase();
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
            >
              <Tooltip direction="top" offset={[0, -10]} permanent={isHighlighted}>
                {landmark.name}
              </Tooltip>
              <Popup>
                <strong>{landmark.name}</strong>
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
            
            // First, try to get coordinates from the stop object itself
            let pos = null;
            if (typeof stop === 'object' && stop?.lat !== undefined && stop?.lng !== undefined) {
              pos = [stop.lat, stop.lng];
            } else {
              // Fall back to finding a matching landmark
              const matchingLandmark = landmarks.find(lm => 
                lm.name.toLowerCase() === stopName.toLowerCase()
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
                if (stopName.toLowerCase() !== destination.toLowerCase()) {
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
              
              const isDestination = destination.toLowerCase() === stopName.toLowerCase();
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
      </MapContainer>
    </div>
  );
};

export default LeafletMap;