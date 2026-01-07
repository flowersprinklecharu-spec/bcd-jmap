import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
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

const RouteMapEditor = forwardRef(({ route, onSave, onCancel, isNewRoute, onEditStopLocation, onRemoveExistingStop, onEditStopName, onSaveCoordinates, shouldCreatePath, onCreatePathTriggered, pendingStopName, onPendingStopPlaced, onDrawingModeChange, onSavePathClick }, ref) => {
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
  const [selectedPathPopup, setSelectedPathPopup] = useState(null); // {show: boolean, latlng: [lat, lng]}
  const [renameStopDialog, setRenameStopDialog] = useState(null); // {show: boolean, index: number, currentName: string, newName: string}
  
  // Watch for shouldCreatePath trigger from parent
  useEffect(() => {
    if (shouldCreatePath) {
      handleCreatePath();
      if (onCreatePathTriggered) {
        onCreatePathTriggered();
      }
    }
  }, [shouldCreatePath, onCreatePathTriggered]);
  
  // Fallback effect: reload waypoints when component visibility changes or route changes
  useEffect(() => {
    console.log('🔄 Fallback effect: checking if waypoints need reload', {
      isNewRoute,
      routeHasCoords: Array.isArray(route?.coordinates) && route.coordinates.length > 0,
      pathWaypointsLoaded: pathWaypoints.length
    });
    
    if (!isNewRoute && route?.coordinates && Array.isArray(route.coordinates) && route.coordinates.length > 0) {
      console.log('⚠️ Fallback: Loading waypoints from editingRoute.coordinates');
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
  
  // Extended bounds to include nearby municipalities (Bacolod, Silay, Talisay, Sumag)
  const bacolodBounds = [
    [10.5400, 122.8800], // Southwest corner (Talisay area)
    [10.8000, 123.0500]  // Northeast corner (Silay area)
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
      html: `<svg width="50" height="65" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));"><path d="M 20 0 C 12 0 5 7 5 16 C 5 28 20 50 20 50 C 20 50 35 28 35 16 C 35 7 28 0 20 0 Z" fill="#2196F3" stroke="white" stroke-width="2.5"/><text x="20" y="20" font-size="24" font-weight="900" text-anchor="middle" fill="white" dominant-baseline="central">${index + 1}</text></svg>`,
      className: 'custom-marker',
      iconSize: [50, 65],
      iconAnchor: [25, 65],
    });
  };

  // Create custom icon for existing stops (using blue teardrop)
  const createExistingStopIcon = (index, routeColor = '#2196F3') => {
    return L.divIcon({
      html: `<svg width="50" height="65" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));"><path d="M 20 0 C 12 0 5 7 5 16 C 5 28 20 50 20 50 C 20 50 35 28 35 16 C 35 7 28 0 20 0 Z" fill="${routeColor}" stroke="white" stroke-width="2.5"/><text x="20" y="20" font-size="24" font-weight="900" text-anchor="middle" fill="white" dominant-baseline="central">${index + 1}</text></svg>`,
      className: 'existing-marker',
      iconSize: [50, 65],
      iconAnchor: [25, 65],
    });
  };

  // Add stop by clicking map
  // Handle map click - add waypoint when in drawing mode, or create temporary pin for stop
  const handleMapClick = (e) => {
    // When a stop is pending placement (from "Add Point" button with input name)
    if (pendingStopName && pendingStopName.trim()) {
      console.log('📍 Preview marker for stop:', pendingStopName, 'coords:', e.latlng.lat, e.latlng.lng);
      
      // Show preview marker - don't add to route yet
      setTempPin({
        name: pendingStopName.trim(),
        lat: e.latlng.lat,
        lng: e.latlng.lng
      });
      
      // Notify parent of preview coordinates for confirmation button
      if (onPendingStopPlaced) {
        onPendingStopPlaced({
          name: pendingStopName.trim(),
          lat: e.latlng.lat,
          lng: e.latlng.lng
        });
      }
      return;
    }

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

  // Notify parent when drawing mode status or waypoint count changes
  useEffect(() => {
    if (onDrawingModeChange) {
      onDrawingModeChange(isDrawingPath, pathWaypoints.length);
    }
  }, [isDrawingPath, pathWaypoints.length, onDrawingModeChange]);

  // Expose savePath method to parent via ref
  useImperativeHandle(ref, () => ({
    savePath: () => {
      if (pathWaypoints.length >= 2) {
        handleSavePath();
      } else {
        alert('Please add at least 2 waypoints on the map before saving');
      }
    },
    clearTempPin: () => {
      setTempPin(null);
    }
  }), [pathWaypoints]);

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
    if (pathWaypoints.length < 2) {
      alert('Please add at least 2 waypoints to create a route path');
      return;
    }
    // Convert to array format [lat, lng] for consistency with Leaflet and Firestore
    const coordinates = pathWaypoints.map(waypoint => [waypoint.lat, waypoint.lng]);
    console.log('📍 handleSaveCoordinates - Saving', coordinates.length, 'coordinates:', coordinates);
    onSaveCoordinates(coordinates);
    // Clear the input box after saving path
    setNewStopName('');
  };

  // Handle activating drawing mode for creating path
  const handleCreatePath = () => {
    console.log('🖊️ handleCreatePath called');
    console.log('  route.majorStops:', route?.majorStops);
    console.log('  route.majorStops length:', route?.majorStops?.length);
    console.log('  current pathWaypoints:', pathWaypoints.length);
    
    const totalStops = (route?.majorStops?.length || 0);
    console.log('  totalStops:', totalStops);
    
    if (totalStops < 2) {
      alert('Please add at least 2 stops first before creating the path');
      return;
    }
    
    // Enter drawing mode - KEEP existing waypoints if they exist, or start fresh if none
    if (!isDrawingPath) {
      console.log('🖊️ Entering drawing mode for path creation');
      if (pathWaypoints.length === 0) {
        console.log('✨ Starting fresh path - user will manually plot waypoints');
        setPathWaypoints([]);
      } else {
        console.log('📍 Continuing from existing waypoints:', pathWaypoints.length, 'points');
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
    // Convert waypoints to coordinates format as [lat, lng] arrays
    const coordinates = pathWaypoints.map(waypoint => [
      waypoint.lat,
      waypoint.lng
    ]);
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
      const existingWaypoints = route.coordinates.map((coord, idx) => {
        // Handle both array [lat, lng] and object {lat, lng} formats
        if (Array.isArray(coord) && coord.length === 2) {
          return { lat: coord[0], lng: coord[1], id: `existing-${idx}-${Date.now()}` };
        }
        if (coord && typeof coord.lat === 'number' && typeof coord.lng === 'number') {
          return { lat: coord.lat, lng: coord.lng, id: `existing-${idx}-${Date.now()}` };
        }
        return null;
      }).filter(w => w !== null);
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

  // Handle renaming existing stop
  const handleRenameStop = (index, newName) => {
    if (!newName.trim()) {
      alert('Stop name cannot be empty');
      return;
    }
    
    // Call the parent callback to handle renaming
    if (onEditStopName) {
      onEditStopName(index, newName.trim());
    }
    
    setRenameStopDialog(null);
  };

  // Handle removing existing stop
  const handleRemoveStop = (index) => {
    if (onRemoveExistingStop) {
      onRemoveExistingStop(index);
    }
  };

  return (
    <div className="route-map-editor">
      <div className="editor-container">
        <div className="editor-map-section">
          <div style={{ flex: 1, width: '100%', border: '2px solid #ddd', borderRadius: '6px', overflow: 'hidden', minHeight: 0, display: 'flex' }}>
            <MapContainer 
              center={mapCenter} 
              zoom={12} 
              style={{ height: '100%', width: '100%' }}
              maxBounds={bacolodBounds}
              maxBoundsViscosity={1.0}
              minZoom={10}
              maxZoom={18}
            >
              <MapEvents />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              
              {/* Render existing stops with route color markers */}
              {(route.majorStops || []).map((stop, index) => {
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
                          <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexDirection: 'column' }}>
                            <button
                              onClick={() => setRenameStopDialog({ show: true, index, currentName: stopName, newName: stopName })}
                              style={{
                                padding: '6px 8px',
                                backgroundColor: '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => handleRemoveStop(index)}
                              style={{
                                padding: '6px 8px',
                                backgroundColor: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}
                            >
                              Remove
                            </button>
                          </div>
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
              {/* Render from editingRoute.coordinates (saved path) OR pathWaypoints (current drawing) */}
              {((route?.coordinates && route.coordinates.length > 1) || pathWaypoints.length > 1) && (
                <Polyline 
                  positions={
                    // PRIORITY: If drawing mode is active, show the current waypoints being drawn
                    isDrawingPath && pathWaypoints.length > 1
                      ? pathWaypoints.map(w => [w.lat, w.lng])
                      // Otherwise show saved coordinates if they exist
                      : route?.coordinates && route.coordinates.length > 1
                        ? route.coordinates.map(c => {
                            // Handle both array [lat, lng] and object {lat, lng} formats
                            if (Array.isArray(c) && c.length === 2) {
                              return c;
                            }
                            if (c && typeof c.lat === 'number' && typeof c.lng === 'number') {
                              return [c.lat, c.lng];
                            }
                            return null;
                          }).filter(c => c !== null)
                        : []
                  } 
                  color="#FF6B35"
                  weight={4}
                  opacity={0.9}
                  dashArray="5, 5"
                  eventHandlers={{
                    click: (e) => {
                      const latlng = e.latlng;
                      setSelectedPathPopup({ show: true, latlng: [latlng.lat, latlng.lng] });
                    }
                  }}
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
              
              {/* Path Popup - shown when user clicks on the drawn path */}
              {selectedPathPopup?.show && selectedPathPopup?.latlng && (
                <Popup position={selectedPathPopup.latlng} onClose={() => setSelectedPathPopup({ ...selectedPathPopup, show: false })}>
                  <div className="marker-popup" style={{ minWidth: '250px' }}>
                    <strong>Route Path Waypoints</strong>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Total: {pathWaypoints.length}</p>
                    
                    {/* List of waypoints with individual remove buttons */}
                    <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '8px', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
                      {pathWaypoints.map((waypoint, index) => (
                        <div
                          key={waypoint.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 0',
                            borderBottom: '1px solid #eee',
                            fontSize: '12px'
                          }}
                        >
                          <div>
                            <strong>#{index + 1}</strong> ({waypoint.lat.toFixed(4)}, {waypoint.lng.toFixed(4)})
                          </div>
                          <button
                            onClick={() => {
                              setPathWaypoints(pathWaypoints.filter((_, i) => i !== index));
                            }}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#ff6b6b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '600',
                              marginLeft: '6px'
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Save Path and Close buttons */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '0' }}>
                      <button
                        onClick={() => {
                          if (pathWaypoints.length < 2) {
                            alert('Need at least 2 waypoints to save the path');
                            return;
                          }
                          handleSavePath();
                          setSelectedPathPopup({ show: false });
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          backgroundColor: '#4caf50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        Save Path
                      </button>
                      <button
                        onClick={() => setSelectedPathPopup({ show: false })}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          backgroundColor: '#9e9e9e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </Popup>
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

      {/* Rename Stop Dialog */}
      {renameStopDialog?.show && (
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
            <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>Rename Stop</h3>
            <p style={{ margin: '0 0 0.5rem 0', color: '#6b7280', fontSize: '13px' }}>
              Current name: <strong>{renameStopDialog.currentName}</strong>
            </p>
            <input
              type="text"
              value={renameStopDialog.newName}
              onChange={(e) => setRenameStopDialog({ ...renameStopDialog, newName: e.target.value })}
              placeholder="Enter new stop name"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '14px',
                boxSizing: 'border-box',
                marginBottom: '1.5rem'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleRenameStop(renameStopDialog.index, renameStopDialog.newName);
                }
              }}
            />
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setRenameStopDialog(null)}
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
                onClick={() => handleRenameStop(renameStopDialog.index, renameStopDialog.newName)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

RouteMapEditor.displayName = 'RouteMapEditor';
export default RouteMapEditor;
