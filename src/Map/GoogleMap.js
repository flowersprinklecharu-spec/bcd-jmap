import React, { useCallback, useMemo } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '500px'
};

// Custom marker icons using SVG
const createStopMarker = (color = '#3b82f6') => {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="28" height="28"><circle cx="20" cy="20" r="18" fill="${encodeURIComponent(color)}" stroke="white" stroke-width="2"/><circle cx="20" cy="20" r="6" fill="white"/></svg>`;
};

const createLandmarkMarker = (color = '#f59e0b', isHighlighted = false) => {
  const fillColor = isHighlighted ? '#ef4444' : color;
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="32" height="32"><rect x="6" y="6" width="28" height="28" rx="4" fill="${encodeURIComponent(fillColor)}" stroke="white" stroke-width="2"/><text x="20" y="28" font-size="20" fill="white" text-anchor="middle">🏢</text></svg>`;
};

const createUserLocationMarker = () => {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="32" height="32"><circle cx="20" cy="20" r="12" fill="%234f46e5" stroke="white" stroke-width="2"/><circle cx="20" cy="20" r="6" fill="white"/></svg>`;
};

const GoogleMapComponent = ({ 
  routes = [], 
  selectedRoute, 
  userLocation, 
  landmarks = [], 
  onRouteClick, 
  highlightedStops = [], 
  destination = '', 
  suggestedRoutes = [] 
}) => {
  const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  
  const center = useMemo(() => {
    if (userLocation) {
      return { lat: userLocation.lat, lng: userLocation.lng };
    }
    return { lat: 10.6760, lng: 122.9500 }; // Bacolod City
  }, [userLocation]);

  const [hoveredRoute, setHoveredRoute] = React.useState(null);

  // Process routes into polylines
  const routePolylines = useMemo(() => {
    return routes
      .filter(route => route && route.id && route.coordinates && Array.isArray(route.coordinates))
      .map(route => {
        const validCoords = route.coordinates.filter(c => 
          Array.isArray(c) && 
          c.length === 2 && 
          typeof c[0] === 'number' && 
          typeof c[1] === 'number' &&
          !isNaN(c[0]) && 
          !isNaN(c[1])
        );

        if (validCoords.length < 2) return null;

        const isSelectedRoute = selectedRoute?.id === route.id;
        const isSuggestedRoute = suggestedRoutes.length > 0 && suggestedRoutes.some(r => r.id === route.id);
        const isHighlightedRoute = highlightedStops.length > 0 && route.majorStops && 
          route.majorStops.some(stop => highlightedStops.includes(stop));
        
        const isFocusedMode = selectedRoute && highlightedStops.length === 0;
        
        let shouldShowPath = false;
        if (isFocusedMode) {
          shouldShowPath = isSelectedRoute;
        } else {
          shouldShowPath = isSelectedRoute || isSuggestedRoute || isHighlightedRoute;
        }

        if (!shouldShowPath) return null;

        const path = validCoords.map(c => ({ lat: c[0], lng: c[1] }));

        return {
          id: route.id,
          path,
          options: {
            strokeColor: isSelectedRoute ? route.color : (route.color || '#888'),
            strokeWeight: isSelectedRoute ? 6 : (isSuggestedRoute || isHighlightedRoute ? 4 : 2),
            strokeOpacity: shouldShowPath ? 0.9 : 0.2,
            strokeDasharray: isSuggestedRoute && !isSelectedRoute ? 5 : 0,
            geodesic: true,
            clickable: true
          },
          route,
          isSelectedRoute
        };
      })
      .filter(Boolean);
  }, [routes, selectedRoute, highlightedStops, suggestedRoutes]);

  // Process landmarks into markers
  const landmarkMarkers = useMemo(() => {
    return landmarks
      .filter(landmark => landmark && landmark.id && landmark.coordinates)
      .map(landmark => {
        let pos = null;
        if (Array.isArray(landmark.coordinates) && 
            landmark.coordinates.length === 2 &&
            typeof landmark.coordinates[0] === 'number' &&
            typeof landmark.coordinates[1] === 'number') {
          pos = { lat: landmark.coordinates[0], lng: landmark.coordinates[1] };
        } else if (typeof landmark.coordinates.latitude === 'number' &&
                   typeof landmark.coordinates.longitude === 'number') {
          pos = { lat: landmark.coordinates.latitude, lng: landmark.coordinates.longitude };
        }

        if (!pos) return null;

        const isFocusedMode = selectedRoute && highlightedStops.length === 0;
        
        if (isFocusedMode && (!selectedRoute.majorStops || 
            !selectedRoute.majorStops.some(stop => stop.toLowerCase() === landmark.name.toLowerCase()))) {
          return null;
        }

        const isHighlighted = destination && landmark.name.toLowerCase() === destination.toLowerCase();

        return {
          id: landmark.id,
          position: pos,
          icon: createLandmarkMarker('#f59e0b', isHighlighted),
          landmark,
          isHighlighted
        };
      })
      .filter(Boolean);
  }, [landmarks, selectedRoute, highlightedStops, destination]);

  // Process major stops into markers
  const stopMarkers = useMemo(() => {
    if (!selectedRoute || !selectedRoute.majorStops) return [];
    if (highlightedStops.length === 0 && !selectedRoute) return [];

    return selectedRoute.majorStops
      .map((stop, index) => {
        const matchingLandmark = landmarks.find(lm => 
          lm.name.toLowerCase() === stop.toLowerCase()
        );

        if (!matchingLandmark || !matchingLandmark.coordinates) return null;

        let pos = null;
        if (Array.isArray(matchingLandmark.coordinates) && matchingLandmark.coordinates.length === 2) {
          pos = { lat: matchingLandmark.coordinates[0], lng: matchingLandmark.coordinates[1] };
        } else if (typeof matchingLandmark.coordinates.latitude === 'number') {
          pos = { lat: matchingLandmark.coordinates.latitude, lng: matchingLandmark.coordinates.longitude };
        }

        if (!pos) return null;

        const isDestination = destination.toLowerCase() === stop.toLowerCase();

        return {
          id: `stop-${index}`,
          position: pos,
          icon: createStopMarker(isDestination ? '#ef4444' : selectedRoute.color),
          stop,
          isDestination
        };
      })
      .filter(Boolean);
  }, [selectedRoute, landmarks, highlightedStops, destination]);

  const handleRouteClick = useCallback((route) => {
    if (onRouteClick) {
      onRouteClick(route);
    }
  }, [onRouteClick]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div style={{ height: '500px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
        <p style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
          ⚠️ Google Maps API Key not configured. Add REACT_APP_GOOGLE_MAPS_API_KEY to your .env file
        </p>
      </div>
    );
  }

  return (
    <LoadScript 
      googleMapsApiKey={GOOGLE_MAPS_API_KEY}
      onError={() => {
        console.error('Google Maps API failed to load. Check your API key and verify the Maps JavaScript API is enabled.');
      }}
    >
      <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={13} options={{ zoomControl: true, fullscreenControl: true }}>
        {/* Route Polylines */}
        {routePolylines.map(polyline => (
          <Polyline
            key={polyline.id}
            path={polyline.path}
            options={{
              ...polyline.options,
              strokeDasharray: polyline.options.strokeDasharray > 0 ? '5, 5' : undefined
            }}
            onClick={() => handleRouteClick(polyline.route)}
            onMouseOver={() => setHoveredRoute(polyline.id)}
            onMouseOut={() => setHoveredRoute(null)}
          />
        ))}

        {/* Landmark Markers */}
        {landmarkMarkers.map(marker => (
          <Marker
            key={marker.id}
            position={marker.position}
            icon={{ url: marker.icon, scaledSize: { width: 32, height: 32 } }}
            title={marker.landmark.name}
          />
        ))}

        {/* Major Stops Markers */}
        {stopMarkers.map(marker => (
          <Marker
            key={marker.id}
            position={marker.position}
            icon={{ url: marker.icon, scaledSize: { width: 28, height: 28 } }}
            title={marker.stop}
          />
        ))}

        {/* User Location Marker */}
        {userLocation && (
          <Marker
            position={center}
            icon={{ url: createUserLocationMarker(), scaledSize: { width: 32, height: 32 } }}
            title="Your Location"
          />
        )}
      </GoogleMap>
    </LoadScript>
  );
};

export default GoogleMapComponent;
