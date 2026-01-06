import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './route-map-editor.css';

// Fix Leaflet marker icons issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const RouteMapEditor = ({ route, onSave, onCancel, isNewRoute, onEditStopLocation, onRemoveExistingStop, onEditStopName, onSaveCoordinates }) => {
  const [newStops, setNewStops] = useState([]); // Only track new stops being added
  const [newStopName, setNewStopName] = useState('');
  const [selectedStop, setSelectedStop] = useState(null);
  const [editingStopIndex, setEditingStopIndex] = useState(null);
  const [editingStopName, setEditingStopName] = useState('');
  const [mapCenter] = useState([10.6750, 122.9600]); // Bacolod city center
  const [confirmDelete, setConfirmDelete] = useState(null); // {type: 'existing'|'new', index: number, id?: string, name?: string}
  const [tempPin, setTempPin] = useState(null); // {lat, lng, name} - temporary pin before adding to stops
  const [confirmCancel, setConfirmCancel] = useState(false); // Confirmation for closing modal
  const [isDrawingPath, setIsDrawingPath] = useState(false); // Toggle for drawing mode
  const [pathWaypoints, setPathWaypoints] = useState([]); // Waypoints for the drawn path
  
  // Fallback effect: reload waypoints when component visibility changes or route changes
  useEffect(() => {
    console.log('🔄 Fallback effect: checking if waypoints need reload', {
      isNewRoute,
      routeHasCoords: Array.isArray(route?.coordinates) && route.coordinates.length > 0,
      pathWaypointsLoaded: pathWaypoints.length
    });
    
    if (!isNewRoute && route?.coordinates && Array.isArray(route.coordinates) && route.coordinates.length > 0 && pathWaypoints.length === 0) {
      console.log('⚠️ Fallback: Loading waypoints (main effect may have missed)');
      const existingWaypoints = route.coordinates
        .map((coord, idx) => {
          // Handle {lat, lng} format
          if (coord && typeof coord.lat === 'number' && typeof coord.lng === 'number') {
            return { lat: coord.lat, lng: coord.lng, id: `existing-${idx}-${Date.now()}` };
          }
          // Handle [lat, lng] array format
          if (Array.isArray(coord) && coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1])) {
            return { lat: coord[0], lng: coord[1], id: `existing-${idx}-${Date.now()}` };
          }
          // Handle {latitude, longitude} GeoPoint format
          if (coord && typeof coord.latitude === 'number' && typeof coord.longitude === 'number') {
            return { lat: coord.latitude, lng: coord.longitude, id: `existing-${idx}-${Date.now()}` };
          }
          return null;
        })
        .filter(w => w !== null);
      
      setPathWaypoints(existingWaypoints);
      console.log('🔄 Fallback: Loaded', existingWaypoints.length, 'waypoints');
    }
  }, [route?.id]);
  
  // Bacolod city bounds to limit map area
  const bacolodBounds = [
    [10.6200, 122.9100], // Southwest corner
    [10.7300, 123.0100]  // Northeast corner
  ];

  // Initialize waypoints when editing an existing route with coordinates
  useEffect(() => {
    console.log('🔄 RouteMapEditor: useEffect triggered', {
      isNewRoute,
      hasRoute: !!route,
      hasCoordinates: Array.isArray(route?.coordinates),
      coordinatesLength: route?.coordinates?.length || 0,
      routeId: route?.id
    });
    
    if (!isNewRoute && route?.coordinates && Array.isArray(route.coordinates) && route.coordinates.length > 0) {
      // Load existing path waypoints from the route (silently, without entering drawing mode)
      console.log('✅ Loading existing waypoints:', route.coordinates.length, 'coordinates');
      const existingWaypoints = route.coordinates
        .map((coord, idx) => {
          // Handle {lat, lng} format
          if (coord && typeof coord.lat === 'number' && typeof coord.lng === 'number') {
            return { lat: coord.lat, lng: coord.lng, id: `existing-${idx}-${Date.now()}` };
          }
          // Handle [lat, lng] array format
          if (Array.isArray(coord) && coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1])) {
            return { lat: coord[0], lng: coord[1], id: `existing-${idx}-${Date.now()}` };
          }
          // Handle {latitude, longitude} GeoPoint format
          if (coord && typeof coord.latitude === 'number' && typeof coord.longitude === 'number') {
            return { lat: coord.latitude, lng: coord.longitude, id: `existing-${idx}-${Date.now()}` };
          }
          console.warn('⚠️ Unknown coordinate format at index', idx, ':', coord);
          return null;
        })
        .filter(w => w !== null);
      
      setPathWaypoints(existingWaypoints);
      console.log('📍 Waypoints loaded:', existingWaypoints.length);
      // Don't auto-enter drawing mode - let user control when to enter
    } else if (isNewRoute) {
      console.log('➕ New route mode - no existing waypoints to load');
      setPathWaypoints([]);
    }
  }, [isNewRoute, route?.id, route?.coordinates?.length]);

  // Create custom icon for new stops
  const createStopIcon = (index, isSelected) => {
    return L.divIcon({
      html: `<div class="stop-marker ${isSelected ? 'selected' : ''}">
        <div class="stop-marker-number">${index + 1}</div>
      </div>`,
      className: 'custom-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
  };

  // Create custom icon for existing stops (using route color, fully visible)
  const createExistingStopIcon = (index, routeColor = '#999') => {
    return L.divIcon({
      html: `<div class="existing-stop-marker" style="color: ${routeColor};">
        <div class="existing-stop-marker-label">${index + 1}</div>
      </div>`,
      className: 'existing-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
  };

  // Add stop by clicking map
  // Handle map click - add waypoint when in drawing mode, or create temporary pin for stop
  const handleMapClick = (e) => {
    // When in drawing mode, add waypoint to the path
    if (isDrawingPath) {
      console.log('📍 Adding waypoint at', e.latlng.lat, e.latlng.lng);
      const newWaypoint = {
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        id: Date.now() + Math.random()
      };
      setPathWaypoints([...pathWaypoints, newWaypoint]);
      return;
    }

    // Normal mode: create a temporary pin for a stop
    if (!newStopName.trim()) {
      alert('Please enter a stop name first');
      return;
    }
    
    console.log('📌 Creating temp pin for stop:', newStopName, 'at', e.latlng.lat, e.latlng.lng);
    // Create temporary pin instead of auto-adding to stops
    setTempPin({
      name: newStopName,
      lat: e.latlng.lat,
      lng: e.latlng.lng
    });
  };

  // Map events component
  function MapEvents() {
    useMapEvents({
      click: handleMapClick,
    });
    return null;
  }

  // Remove stop (only new stops can be removed)
  const removeStop = (id) => {
    setNewStops(newStops.filter(stop => stop.id !== id));
    setSelectedStop(null);
    setConfirmDelete(null);
  };

  // Handle delete confirmation
  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    
    if (confirmDelete.type === 'new') {
      removeStop(confirmDelete.id);
    } else if (confirmDelete.type === 'existing') {
      onRemoveExistingStop(confirmDelete.index);
      setConfirmDelete(null);
    }
  };

  // Cleanup/logging on component mount and unmount
  useEffect(() => {
    console.log('🚀 RouteMapEditor mounted', {
      isNewRoute,
      routeId: route?.id,
      coordinatesCount: route?.coordinates?.length || 0,
      stopsCount: route?.majorStops?.length || 0
    });
    return () => {
      console.log('🛑 RouteMapEditor unmounted');
    };
  }, [isNewRoute, route?.id]);

  // Reorder stops (only new stops can be reordered)
  const moveStop = (fromIndex, toIndex) => {
    const reorderedStops = [...newStops];
    [reorderedStops[fromIndex], reorderedStops[toIndex]] = [reorderedStops[toIndex], reorderedStops[fromIndex]];
    setNewStops(reorderedStops);
  };

  // Handle clearing the input and temporary pin
  const handleClearPin = () => {
    setNewStopName('');
    setTempPin(null);
  };

  // Handle converting temporary pin to actual stop
  const handleAddPinAsStop = () => {
    if (!tempPin) {
      alert('Please pin a location on the map first');
      return;
    }
    
    const newStop = {
      id: Date.now(),
      name: tempPin.name,
      lat: tempPin.lat,
      lng: tempPin.lng,
      timestamp: new Date().toLocaleString()
    };
    
    const updatedStops = [...newStops, newStop];
    setNewStops(updatedStops);
    
    // Immediately notify parent component of the new stops
    // This ensures stops are saved to editingRoute.majorStops in the parent
    console.log('✅ Add Stops - Calling onSave with stops:', updatedStops);
    onSave(updatedStops);
    
    setNewStopName('');
    setTempPin(null);
  };

  // Handle save for adding new stops to majorStops
  const handleSave = () => {
    if (newStops.length < 1) {
      alert('Please add at least 1 new stop');
      return;
    }
    onSave(newStops);
  };
  // Handle save for route coordinates (polyline path)
  const handleSaveCoordinates = () => {
    if (newStops.length < 2) {
      alert('Please add at least 2 waypoints to create a route path');
      return;
    }
    // Convert to array of objects instead of nested arrays for Firestore compatibility
    const coordinates = newStops.map(stop => ({
      lat: stop.lat,
      lng: stop.lng
    }));
    onSaveCoordinates(coordinates);
    // Clear the input box after saving path
    setNewStopName('');
  };

  // Handle activating drawing mode for creating path
  const handleCreatePath = () => {
    console.log('🖊️ handleCreatePath called');
    console.log('  route.majorStops:', route?.majorStops);
    console.log('  route.majorStops length:', route?.majorStops?.length);
    console.log('  newStops length:', newStops.length);
    
    const totalStops = (route?.majorStops?.length || 0) + newStops.length;
    console.log('  totalStops:', totalStops);
    
    if (totalStops < 2) {
      alert('Please add at least 2 stops first before creating the path');
      return;
    }
    
    // Always enter drawing mode (don't toggle)
    if (!isDrawingPath) {
      console.log('🖊️ Entering drawing mode for path creation');
      
      // If we have existing saved path coordinates, use them
      if (route?.coordinates && Array.isArray(route.coordinates) && route.coordinates.length > 0) {
        // Load existing path waypoints from the route
        console.log('📍 Loading existing path waypoints in drawing mode:', route.coordinates.length);
        const existingWaypoints = route.coordinates.map((coord, idx) => ({
          lat: coord.lat,
          lng: coord.lng,
          id: `existing-${idx}-${Date.now()}`
        }));
        setPathWaypoints(existingWaypoints);
      } else if (newStops.length > 0) {
        // Use new stops as waypoints
        console.log('📍 Using new stops as waypoints:', newStops.length);
        setPathWaypoints(newStops);
      } else if (!isNewRoute && route?.majorStops && route.majorStops.length > 0) {
        // In edit mode with no saved path and no new stops, use existing stops as waypoints
        console.log('🔍 Checking majorStops for coordinates...');
        console.log('  majorStops data:', route.majorStops);
        
        const existingStopsWithCoords = route.majorStops.filter(stop => {
          const hasCoords = stop && typeof stop === 'object' && stop.lat !== undefined && stop.lng !== undefined;
          console.log('  Stop check:', {stop, hasCoords, type: typeof stop});
          return hasCoords;
        });
        
        console.log('  existingStopsWithCoords:', existingStopsWithCoords);
        console.log('  existingStopsWithCoords length:', existingStopsWithCoords.length);
        
        if (existingStopsWithCoords.length > 0) {
          console.log('📍 Using existing stops as waypoints for path:', existingStopsWithCoords.length);
          const existingWaypoints = existingStopsWithCoords.map((stop, idx) => ({
            lat: stop.lat,
            lng: stop.lng,
            id: `stop-${idx}-${Date.now()}`
          }));
          console.log('  Created waypoints:', existingWaypoints);
          setPathWaypoints(existingWaypoints);
        } else {
          console.log('✨ Starting fresh path (no stops with coords found)');
          setPathWaypoints([]);
        }
      } else {
        // No existing path, start fresh
        console.log('✨ Starting fresh path');
        setPathWaypoints([]);
      }
      setIsDrawingPath(true); // Enter drawing mode
    }
  };

  // Handle saving the drawn path
  const handleSavePath = () => {
    if (pathWaypoints.length < 2) {
      alert('Please click on the map to add at least 2 waypoints along the route path');
      return;
    }
    console.log('💾 Saving path with', pathWaypoints.length, 'waypoints');
    // Convert waypoints to coordinates format
    const coordinates = pathWaypoints.map(waypoint => ({
      lat: waypoint.lat,
      lng: waypoint.lng
    }));
    onSaveCoordinates(coordinates);
    // Exit drawing mode
    setIsDrawingPath(false);
    setNewStopName('');
    // Don't clear pathWaypoints - keep them visible on map for reference
  };

  // Handle canceling drawing mode
  const handleCancelDrawing = () => {
    console.log('❌ Canceled drawing mode');
    setIsDrawingPath(false);
    // Reload existing waypoints if they exist, or clear if new route
    if (!isNewRoute && route?.coordinates && Array.isArray(route.coordinates) && route.coordinates.length > 0) {
      const existingWaypoints = route.coordinates.map((coord, idx) => ({
        lat: coord.lat,
        lng: coord.lng,
        id: `existing-${idx}-${Date.now()}`
      }));
      setPathWaypoints(existingWaypoints);
      console.log('🔄 Reloaded existing waypoints after cancel');
    } else {
      setPathWaypoints([]);
    }
  };

  // Handle deleting individual waypoint
  const handleDeleteWaypoint = (index) => {
    const updatedWaypoints = pathWaypoints.filter((_, i) => i !== index);
    setPathWaypoints(updatedWaypoints);
  };

  return (
    <div className="route-map-editor">
      <div className="editor-container">
        <div className="editor-map-section">
          <div style={{ flex: 1, width: '100%', border: '2px solid #ddd', borderRadius: '6px', overflow: 'hidden', minHeight: 0, display: 'flex' }}>
            <MapContainer 
              center={mapCenter} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
              maxBounds={bacolodBounds}
              maxBoundsViscosity={1.0}
              minZoom={12}
              maxZoom={18}
            >
              <MapEvents />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              
              {/* Render existing stops with route color markers */}
              {!isNewRoute && (route.majorStops || []).map((stop, index) => {
                const stopName = typeof stop === 'string' ? stop : stop.name;
                const hasCoords = typeof stop === 'object' && stop.lat !== undefined && stop.lng !== undefined;
                
                // If stop has coordinates, show it on map
                if (hasCoords) {
                  return (
                    <Marker
                      key={`existing-${index}`}
                      position={[stop.lat, stop.lng]}
                      icon={createExistingStopIcon(index, route.color || '#FF5722')}
                    >
                      <Popup>
                        <div className="marker-popup">
                          <strong>{stopName}</strong>
                          <p>Existing Stop #{index + 1}</p>
                          <p className="coordinates">{stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</p>
                        </div>
                      </Popup>
                    </Marker>
                  );
                }
                return null;
              })}
              
              {/* Draw polyline between new stops */}
              {newStops.length > 1 && (
                <Polyline 
                  positions={newStops.map(s => [s.lat, s.lng])} 
                  color="#0084FF"
                  weight={4}
                  opacity={0.8}
                />
              )}

              {/* Draw polyline for path waypoints (always visible, not just in drawing mode) */}
              {pathWaypoints.length > 1 && (
                <Polyline 
                  positions={pathWaypoints.map(w => [w.lat, w.lng])} 
                  color="#FF6B35"
                  weight={4}
                  opacity={0.9}
                  dashArray="5, 5"
                />
              )}
              
              {/* Render markers for path waypoints (always visible, not just in drawing mode) */}
              {pathWaypoints.map((waypoint, index) => (
                <Marker
                  key={waypoint.id}
                  position={[waypoint.lat, waypoint.lng]}
                  icon={L.divIcon({
                    html: `<div class="path-waypoint-marker">
                      <div class="waypoint-number">${index + 1}</div>
                    </div>`,
                    className: 'waypoint-marker',
                    iconSize: [28, 28],
                    iconAnchor: [14, 28],
                  })}
                >
                  <Popup>
                    <div className="marker-popup">
                      <p>Route Waypoint #{index + 1}</p>
                      <p className="coordinates">{waypoint.lat.toFixed(4)}, {waypoint.lng.toFixed(4)}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
              
              {/* Render markers for new stops */}
              {newStops.map((stop, index) => {
                const stopNumber = (route.majorStops?.length || 0) + index + 1;
                return (
                  <Marker
                    key={stop.id}
                    position={[stop.lat, stop.lng]}
                    icon={createStopIcon(stopNumber - 1, selectedStop?.id === stop.id)}
                    eventHandlers={{
                      click: () => setSelectedStop(stop),
                    }}
                  >
                    <Popup>
                      <div className="marker-popup">
                        <strong>{stop.name}</strong>
                        <p>Stop #{stopNumber}</p>
                        <p className="coordinates">{stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
              
              {/* Render temporary pin marker */}
              {tempPin && (
                <Marker
                  position={[tempPin.lat, tempPin.lng]}
                  icon={L.icon({
                    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0Ij48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI4IiBmaWxsPSIjRkZBNTAwIi8+PHRleHQgeD0iMTIiIHk9IjE1IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiPi4uPC90ZXh0Pjwvc3ZnPg==',
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                  })}
                >
                  <Popup>
                    <div className="marker-popup">
                      <strong>{tempPin.name}</strong>
                      <p>Temporary Pin (click Add Stops to confirm)</p>
                      <p className="coordinates">{tempPin.lat.toFixed(4)}, {tempPin.lng.toFixed(4)}</p>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        </div>

        <div className="editor-controls-section">
          {/* Show Add Point form for both new and editing routes */}
          <div className="add-stop-form">
            <h4>Add Point</h4>
            <input
              type="text"
              placeholder="Stop name (e.g., Lacson & Araneta)"
              value={newStopName}
              onChange={(e) => setNewStopName(e.target.value)}
              className="stop-name-input"
              disabled={isDrawingPath}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newStopName.trim()) {
                  alert('Click on the map to place this point');
                }
              }}
            />
            <p className="help-text">
              {isDrawingPath 
                ? 'Drawing mode active. Click on the map to add waypoints along the route path.'
                : 'Enter name, then click on the map to add the point. Use "Create Path" or "Add Stops" buttons to finalize.'
              }
            </p>
          </div>

          <div className="stops-list-section">
            {!isNewRoute && (
              <div style={{ marginBottom: '12px' }}>
                <h4 style={{ fontSize: '13px', marginBottom: '8px' }}>Existing Stops ({(route.majorStops || []).length})</h4>
                {(route.majorStops || []).length > 0 && (
                  <div className="existing-stops-list">
                    {route.majorStops.map((stop, index) => {
                      const stopName = typeof stop === 'string' ? stop : stop.name;
                      const hasCoords = typeof stop === 'object' && stop.lat !== undefined && stop.lng !== undefined;
                      const isEditing = editingStopIndex === index;
                      
                      return (
                        <div key={`existing-${index}`} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '4px',
                          marginBottom: '6px'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '26px',
                            height: '26px',
                            backgroundColor: route.color || '#666',
                            color: '#fff',
                            borderRadius: '50%',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            flexShrink: 0
                          }}>
                            {index + 1}
                          </div>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                              <input
                                type="text"
                                value={editingStopName}
                                onChange={(e) => setEditingStopName(e.target.value)}
                                style={{
                                  flex: 1,
                                  padding: '4px 6px',
                                  fontSize: '12px',
                                  border: '1px solid #ddd',
                                  borderRadius: '3px'
                                }}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  onEditStopName(index, editingStopName);
                                  setEditingStopIndex(null);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#4CAF50',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: '600'
                                }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingStopIndex(null)}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#999',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: '600'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>{stopName}</div>
                                {hasCoords && <div style={{ fontSize: '11px', color: '#666' }}>📍 {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</div>}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStopIndex(index);
                                  setEditingStopName(stopName);
                                }}
                                title="Edit Name"
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  fontWeight: '600'
                                }}
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditStopLocation(index, stopName)}
                                title="Edit Location"
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  fontWeight: '600'
                                }}
                              >
                                📍
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete({ type: 'existing', index, name: stopName })}
                                title="Remove Stop"
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#fee2e2',
                                  color: '#991b1b',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  fontWeight: '600'
                                }}
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Map Editor Action Buttons - Always visible */}
            <div className="map-editor-actions-compact">
              {isDrawingPath ? (
                // Drawing mode buttons
                <>
                  <button
                    type="button"
                    className="compact-cancel-btn"
                    onClick={handleCancelDrawing}
                    title="Cancel drawing mode"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="compact-save-btn"
                    onClick={handleSavePath}
                    disabled={pathWaypoints.length < 2}
                    title={pathWaypoints.length < 2 ? "Add at least 2 waypoints" : "Save the drawn path"}
                  >
                    Save Path ({pathWaypoints.length})
                  </button>
                </>
              ) : (
                // Normal mode buttons
                <>
                  <button
                    type="button"
                    className="compact-cancel-btn"
                    onClick={handleClearPin}
                    title="Clear input and remove pinned location"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="compact-save-btn"
                    onClick={handleCreatePath}
                    disabled={newStops.length < 2}
                    title={newStops.length < 2 ? "Add at least 2 stops first" : "Enter drawing mode to create route path"}
                  >
                    Create Path
                  </button>
                  <button
                    type="button"
                    className="compact-save-btn"
                    onClick={handleAddPinAsStop}
                    disabled={false}
                    title="Add pinned location as a stop"
                  >
                    Add Stops
                  </button>
                </>
              )}
            </div>

            {/* Display path waypoints (always visible, not just in drawing mode) */}
            {pathWaypoints.length > 0 && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #ddd' }}>
                <h4 style={{ fontSize: '13px', marginBottom: '8px', color: '#d97706' }}>Path Waypoints ({pathWaypoints.length})</h4>
                <div className="waypoints-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {pathWaypoints.map((waypoint, index) => (
                    <div
                      key={waypoint.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        backgroundColor: '#fff8f3',
                        borderRadius: '4px',
                        marginBottom: '6px',
                        border: '1px solid #fed7aa'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '26px',
                          height: '26px',
                          backgroundColor: route.color || '#FF5722',
                          color: '#fff',
                          borderRadius: '50%',
                          fontWeight: 'bold',
                          fontSize: '12px',
                          flexShrink: 0
                        }}
                      >
                        {index + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', color: '#1f2937', fontWeight: '500' }}>
                          Waypoint #{index + 1}
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                          📍 {waypoint.lat.toFixed(4)}, {waypoint.lng.toFixed(4)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteWaypoint(index)}
                        title="Delete this waypoint"
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#fee2e2',
                          color: '#991b1b',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          flexShrink: 0
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Show New Stops section when there are new stops being added */}
            {newStops.length > 0 && (
              <>
                <h4>New Stops ({newStops.length})</h4>
                {newStops.length === 0 ? (
                  <p className="empty-state">No new stops added yet. Add stops by entering a name and clicking the map.</p>
                ) : (
                  <div className="stops-list">
                    {newStops.map((stop, index) => (
                      <div
                        key={stop.id}
                        className={`stop-item ${selectedStop?.id === stop.id ? 'selected' : ''}`}
                        onClick={() => setSelectedStop(stop)}
                      >
                        <div className="stop-item-number" style={{ backgroundColor: route.color || '#FF5722' }}>
                          {(route.majorStops?.length || 0) + index + 1}
                        </div>
                        <div className="stop-item-info">
                          <div className="stop-item-name">{stop.name}</div>
                          <div className="stop-item-coords">
                            {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                          </div>
                        </div>
                        <div className="stop-item-actions">
                          {index > 0 && (
                            <button
                              type="button"
                              className="move-btn up"
                              onClick={() => moveStop(index, index - 1)}
                              title="Move up"
                            >
                              ▲
                            </button>
                          )}
                          {index < newStops.length - 1 && (
                            <button
                              type="button"
                              className="move-btn down"
                              onClick={() => moveStop(index, index + 1)}
                              title="Move down"
                            >
                              ▼
                            </button>
                          )}
                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() => setConfirmDelete({ type: 'new', id: stop.id, name: stop.name })}
                            title="Delete stop"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>Confirm Delete</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280', fontSize: '14px' }}>
              Are you sure you want to delete <strong>"{confirmDelete.name}"</strong>? This action cannot be undone.
            </p>
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e5e7eb',
                  color: '#1f2937',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteMapEditor;
