import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, ZoomControl } from 'react-leaflet';
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

const LeafletMap = ({ routes = [], selectedRoute, userLocation, landmarks = [], onRouteClick, highlightedStops = [], destination = '', suggestedRoutes = [] }) => {
  const center = userLocation ? [userLocation.lat, userLocation.lng] : [10.6760, 122.9500];

  return (
    <div className="leaflet-map" style={{ height: '500px', width: '100%' }}>
      <MapContainer center={center} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <ZoomControl position="topright" />
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

        {/* Route polylines removed - routes will be added manually with accurate coordinates */}

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