import React, { useState } from 'react';
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
  
  // Bacolod city bounds to limit map area
  const bacolodBounds = [
    [10.6200, 122.9100], // Southwest corner
    [10.7300, 123.0100]  // Northeast corner
  ];

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

  // Create custom icon for existing stops (gray, smaller)
  const createExistingStopIcon = (index) => {
    return L.divIcon({
      html: `<div class="existing-stop-marker">
        <div class="existing-stop-marker-label">${index + 1}</div>
      </div>`,
      className: 'existing-marker',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
  };

  // Add stop by clicking map
  // Handle map click - only create a temporary pin, not auto-add to stops
  const handleMapClick = (e) => {
    if (!newStopName.trim()) {
      alert('Please enter a stop name first');
      return;
    }
    
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
    
    setNewStops([...newStops, newStop]);
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
              
              {/* Render existing stops as gray markers */}
              {!isNewRoute && (route.majorStops || []).map((stop, index) => {
                const stopName = typeof stop === 'string' ? stop : stop.name;
                const hasCoords = typeof stop === 'object' && stop.lat !== undefined && stop.lng !== undefined;
                
                // If stop has coordinates, show it on map
                if (hasCoords) {
                  return (
                    <Marker
                      key={`existing-${index}`}
                      position={[stop.lat, stop.lng]}
                      icon={createExistingStopIcon(index)}
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
                  color={route.color || '#FF5722'}
                  weight={3}
                  opacity={0.7}
                />
              )}
              
              {/* Render markers for new stops */}
              {newStops.map((stop, index) => (
                <Marker
                  key={stop.id}
                  position={[stop.lat, stop.lng]}
                  icon={createStopIcon(index, selectedStop?.id === stop.id)}
                  eventHandlers={{
                    click: () => setSelectedStop(stop),
                  }}
                >
                  <Popup>
                    <div className="marker-popup">
                      <strong>{stop.name}</strong>
                      <p>Stop #{index + 1}</p>
                      <p className="coordinates">{stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
              
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
          <div className="add-stop-form">
            <h4>Add Point</h4>
            <input
              type="text"
              placeholder="Stop name (e.g., Lacson & Araneta)"
              value={newStopName}
              onChange={(e) => setNewStopName(e.target.value)}
              className="stop-name-input"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newStopName.trim()) {
                  alert('Click on the map to place this point');
                }
              }}
            />
            <p className="help-text">Enter name, then click on the map to add the point. Use 'Save Path' or 'Add Stops' buttons to finalize.</p>
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
                onClick={handleSaveCoordinates}
                disabled={false}
                title="Save route path"
              >
                Save Path
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
            </div>
            
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
                      {index + 1}
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
