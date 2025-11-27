import React, { useMemo } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline, Circle } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '8px'
};

const GoogleMapLandmarks = ({ 
  userLocation, 
  selectedLandmark, 
  suggestedRoutes = [] 
}) => {
  const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  
  const center = useMemo(() => {
    if (selectedLandmark && Array.isArray(selectedLandmark.coordinates) && selectedLandmark.coordinates.length === 2) {
      return { lat: selectedLandmark.coordinates[0], lng: selectedLandmark.coordinates[1] };
    }
    return { lat: 10.6760, lng: 122.9500 };
  }, [selectedLandmark]);

  const userLocationMarker = useMemo(() => {
    if (!userLocation) return null;
    return { lat: userLocation.lat, lng: userLocation.lon };
  }, [userLocation]);

  const routePolylines = useMemo(() => {
    return (suggestedRoutes || [])
      .filter(route => route && route.path && Array.isArray(route.path) && route.path.length > 1)
      .map(route => ({
        id: route.id,
        path: route.path.map(coord => ({
          lat: Array.isArray(coord) ? coord[0] : coord.lat,
          lng: Array.isArray(coord) ? coord[1] : coord.lng
        })),
        color: route.color || '#888',
        weight: 4,
        opacity: 0.7
      }));
  }, [suggestedRoutes]);

  const distanceLine = useMemo(() => {
    if (userLocationMarker && selectedLandmark && Array.isArray(selectedLandmark.coordinates)) {
      return [
        userLocationMarker,
        { lat: selectedLandmark.coordinates[0], lng: selectedLandmark.coordinates[1] }
      ];
    }
    return null;
  }, [userLocationMarker, selectedLandmark]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
        <p>⚠️ Google Maps API Key not configured</p>
      </div>
    );
  }

  if (!selectedLandmark || !Array.isArray(selectedLandmark.coordinates) || selectedLandmark.coordinates.length !== 2) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
        <p>Map unavailable</p>
      </div>
    );
  }

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={14}>
        {/* User Location Marker */}
        {userLocationMarker && (
          <>
            <Marker
              position={userLocationMarker}
              icon={{
                url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="32" height="32"><circle cx="20" cy="20" r="12" fill="%234f46e5" stroke="white" stroke-width="2"/><circle cx="20" cy="20" r="6" fill="white"/></svg>`,
                scaledSize: { width: 32, height: 32 }
              }}
              title="Your Location"
            />

            {/* User Location Circle (100m radius) */}
            <Circle
              center={userLocationMarker}
              radius={100}
              options={{
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                strokeColor: '#3b82f6',
                strokeOpacity: 0.3,
                strokeWeight: 2
              }}
            />
          </>
        )}

        {/* Selected Landmark Marker */}
        <Marker
          position={{ lat: selectedLandmark.coordinates[0], lng: selectedLandmark.coordinates[1] }}
          icon={{
            url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><rect x="4" y="4" width="32" height="32" rx="6" fill="%232196F3" stroke="white" stroke-width="2"/><text x="20" y="28" font-size="24" fill="white" text-anchor="middle">${encodeURIComponent(selectedLandmark.icon || 'L')}</text></svg>`,
            scaledSize: { width: 40, height: 40 }
          }}
          title={selectedLandmark.name}
        />

        {/* Route Polylines */}
        {routePolylines.map(route => (
          <Polyline
            key={route.id}
            path={route.path}
            options={{
              strokeColor: route.color,
              strokeWeight: route.weight,
              strokeOpacity: route.opacity,
              geodesic: true
            }}
          />
        ))}

        {/* Distance Line */}
        {distanceLine && (
          <Polyline
            path={distanceLine}
            options={{
              strokeColor: '#64748b',
              strokeWeight: 2,
              strokeOpacity: 0.5,
              strokeDasharray: '5, 5',
              geodesic: true
            }}
          />
        )}
      </GoogleMap>
    </LoadScript>
  );
};

export default GoogleMapLandmarks;
