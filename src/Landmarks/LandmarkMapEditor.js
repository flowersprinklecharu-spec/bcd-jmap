import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './landmark-map-editor.css';

// Fix Leaflet marker icons issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const LandmarkMapEditor = ({ onSave, onCancel, existingLandmarks = [], editingLandmark = null, isEditMode = false }) => {
  const [newLandmark, setNewLandmark] = useState(
    isEditMode && editingLandmark 
      ? {
          id: editingLandmark.id,
          name: editingLandmark.name || '',
          category: editingLandmark.category || 'Recreation',
          address: editingLandmark.address || '',
          coordinates: editingLandmark.coordinates || null
        }
      : {
          name: '',
          category: 'Recreation',
          address: '',
          coordinates: null
        }
  );
  const [mapCenter] = useState([10.6750, 122.9600]); // Bacolod city center
  
  // Bacolod city bounds to limit map area
  const bacolodBounds = [
    [10.4050, 122.9150], // Southwest corner
    [10.8900, 123.1100]  // Northeast corner
  ];

  const categories = ['Recreation', 'Schools', 'Hospitals', 'Malls', 'Restaurants', 'Other'];

  // Create custom icon
  const createLandmarkMarker = (isSelected = false) => {
    return L.divIcon({
      html: `<svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"><path d="M 20 0 C 12 0 5 7 5 16 C 5 28 20 50 20 50 C 20 50 35 28 35 16 C 35 7 28 0 20 0 Z" fill="#2196F3" stroke="white" stroke-width="2"/><circle cx="20" cy="16" r="5" fill="white"/></svg>`,
      className: 'custom-landmark-marker',
      iconSize: [40, 50],
      iconAnchor: [20, 50],
    });
  };

  // Add landmark by clicking map
  const handleMapClick = (e) => {
    if (!newLandmark.name.trim()) {
      alert('Please enter a landmark name first');
      return;
    }

    setNewLandmark(prev => ({
      ...prev,
      coordinates: [e.latlng.lat, e.latlng.lng]
    }));
  };

  // Map events component
  function MapEvents() {
    useMapEvents({
      click: handleMapClick,
    });
    return null;
  }

  // Handle save
  const handleSave = () => {
    if (!newLandmark.name.trim()) {
      alert('Please enter a landmark name');
      return;
    }
    if (!newLandmark.coordinates) {
      alert('Please click on the map to set the landmark location');
      return;
    }
    if (!newLandmark.category) {
      alert('Please select a category');
      return;
    }

    onSave({
      id: newLandmark.id || Date.now(),
      name: newLandmark.name,
      category: newLandmark.category,
      address: newLandmark.address || 'Bacolod',
      coordinates: newLandmark.coordinates,
      description: ''
    });

    // Reset form
    setNewLandmark({
      name: '',
      category: 'Recreation',
      address: '',
      coordinates: null
    });
  };

  const getButtonLabel = () => {
    if (isEditMode) {
      return 'Update Landmark';
    }
    return 'Add Landmark';
  };

  return (
    <div className="landmark-map-editor">
      <div className="editor-container">
        <div className="editor-map-section">
          <h3>{isEditMode ? 'Edit Landmark Location' : 'Add New Landmark'}</h3>
          <div style={{ height: '400px', width: '100%', border: '2px solid #ddd' }}>
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

              {/* Render existing landmarks - hide others when editing */}
              {existingLandmarks
                .filter(landmark => {
                  // If in edit mode, only show the landmark being edited
                  if (isEditMode && editingLandmark) {
                    return landmark.id === editingLandmark.id;
                  }
                  // If in add mode, show all landmarks
                  return true;
                })
                .map(landmark => {
                  if (!landmark.coordinates || !Array.isArray(landmark.coordinates) || landmark.coordinates.length !== 2) {
                    return null;
                  }
                  return (
                    <Marker
                      key={landmark.id}
                      position={landmark.coordinates}
                      icon={createLandmarkMarker(false)}
                    >
                      <Popup>
                        <strong>{landmark.name}</strong>
                        <br />
                        {landmark.category}
                    </Popup>
                  </Marker>
                );
              })}

              {/* New landmark being added */}
              {newLandmark.coordinates && (
                <Marker
                  position={newLandmark.coordinates}
                  icon={createLandmarkMarker(true)}
                >
                  <Popup>
                    <strong>{newLandmark.name}</strong>
                    <br />
                    {newLandmark.category}
                    <br />
                    <small>{newLandmark.coordinates[0].toFixed(4)}, {newLandmark.coordinates[1].toFixed(4)}</small>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        </div>

        <div className="editor-controls-section">
          <div className="landmark-form">
            <h4>Landmark Details</h4>
            
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                placeholder="e.g., SM City Bacolod"
                value={newLandmark.name}
                onChange={(e) => setNewLandmark(prev => ({ ...prev, name: e.target.value }))}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Category *</label>
              <select
                value={newLandmark.category}
                onChange={(e) => setNewLandmark(prev => ({ ...prev, category: e.target.value }))}
                className="form-select"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                placeholder="e.g., Gatuslao St, Bacolod"
                value={newLandmark.address}
                onChange={(e) => setNewLandmark(prev => ({ ...prev, address: e.target.value }))}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Location *</label>
              {newLandmark.coordinates ? (
                <div className="coordinates-display">
                  <strong>📍 {newLandmark.coordinates[0].toFixed(6)}, {newLandmark.coordinates[1].toFixed(6)}</strong>
                  <button
                    type="button"
                    className="clear-coords-btn"
                    onClick={() => setNewLandmark(prev => ({ ...prev, coordinates: null }))}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <p className="help-text">Click on the map to set the landmark location</p>
              )}
            </div>
          </div>

          <div className="editor-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="save-btn"
              onClick={handleSave}
              disabled={!newLandmark.name.trim() || !newLandmark.coordinates}
            >
              {getButtonLabel()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandmarkMapEditor;
