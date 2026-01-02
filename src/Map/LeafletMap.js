import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, LayersControl, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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
      map.setView(editingStopLocation.coordinates, 15);
    }

    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng;
      if (onLocationSelect) {
        onLocationSelect([lat, lng]);
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, editingStopLocation, onLocationSelect]);

  return null;
};

// Component to handle map zoom and centering on destination
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
          const foundStop = route.majorStops.find(stop => 
            stop.toLowerCase() === destination.toLowerCase()
          );
          
          if (foundStop) {
            console.log('Found stop in route:', route.number, foundStop);
            // Found the stop in a route, now find it in landmarks
            destinationLandmark = landmarks.find(lm => 
              lm.name.toLowerCase() === foundStop.toLowerCase()
            );
            console.log('Found landmark for stop:', destinationLandmark?.name);
            if (destinationLandmark) break; // Found the landmark, exit loop
          }
        }
      }
    }

    // If we found the destination landmark, zoom to it
    if (destinationLandmark && destinationLandmark.coordinates) {
      let pos = null;
      if (Array.isArray(destinationLandmark.coordinates) && destinationLandmark.coordinates.length === 2) {
        pos = [destinationLandmark.coordinates[0], destinationLandmark.coordinates[1]];
      } else if (typeof destinationLandmark.coordinates.latitude === 'number') {
        pos = [destinationLandmark.coordinates.latitude, destinationLandmark.coordinates.longitude];
      }

      if (pos) {
        console.log('Zooming to position:', pos);
        // Zoom and center with smooth animation
        map.setView(pos, 16, { animate: true, duration: 1 });
      }
    } else {
      console.log('Destination landmark not found or no coordinates');
    }
  }, [destination, landmarks, selectedRoute, routes, map]);

  return null;
};

const LeafletMap = ({ routes = [], selectedRoute, userLocation, landmarks = [], onRouteClick, highlightedStops = [], destination = '', suggestedRoutes = [], editingStopLocation, onLocationSelect }) => {
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
        <MapZoomHandler 
          destination={destination}
          landmarks={landmarks}
          selectedRoute={selectedRoute}
          routes={routes}
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

        {landmarks.map(landmark => {
          if (!landmark || !landmark.id) return null;

          let pos = null;
          if (landmark.coordinates) {
            if (Array.isArray(landmark.coordinates) && 
                landmark.coordinates.length === 2 &&
                typeof landmark.coordinates[0] === 'number' &&
                typeof landmark.coordinates[1] === 'number') {
              pos = [landmark.coordinates[0], landmark.coordinates[1]];
            } else if (typeof landmark.coordinates.latitude === 'number' &&
                       typeof landmark.coordinates.longitude === 'number') {
              pos = [landmark.coordinates.latitude, landmark.coordinates.longitude];
            }
          }
          
          if (!pos) return null;
          
          // Check if we're in focused mode
          const isFocusedMode = selectedRoute && highlightedStops.length === 0;
          
          // In focused mode, only show landmarks that are major stops of the selected route
          if (isFocusedMode && (!selectedRoute.majorStops || 
              !selectedRoute.majorStops.some(stop => stop.toLowerCase() === landmark.name.toLowerCase()))) {
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
            const matchingLandmark = landmarks.find(lm => 
              lm.name.toLowerCase() === stop.toLowerCase()
            );

            if (matchingLandmark && matchingLandmark.coordinates) {
              let pos = null;
              if (Array.isArray(matchingLandmark.coordinates) && matchingLandmark.coordinates.length === 2) {
                pos = [matchingLandmark.coordinates[0], matchingLandmark.coordinates[1]];
              } else if (typeof matchingLandmark.coordinates.latitude === 'number') {
                pos = [matchingLandmark.coordinates.latitude, matchingLandmark.coordinates.longitude];
              }

              if (pos) {
                const isDestination = destination.toLowerCase() === stop.toLowerCase();
                return (
                  <Marker 
                    key={`stop-${index}`}
                    position={pos}
                    icon={createStopIcon(isDestination ? '#ef4444' : selectedRoute.color)}
                  >
                    <Popup>
                      <strong>{stop}</strong>
                      <br />
                      {isDestination && '⭐ Your Destination'}
                    </Popup>
                  </Marker>
                );
              }
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