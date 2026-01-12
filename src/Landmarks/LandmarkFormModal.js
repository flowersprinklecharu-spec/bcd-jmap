import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import './landmark-form-modal.css';

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Close icon
const CloseIcon = () => (
  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
  </svg>
);

// Category to emoji mapping
const categoryEmojis = {
  'Schools': '🎓',
  'Hospitals': '🏥',
  'Malls': '🛍️',
  'Restaurants': '🍽️',
  'Recreation': '🎮',
  'Other': '📍'
};

// Interactive map component
const MapPlotter = ({ onLocationSelect, markerLocation, isPlotting }) => {
  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (isPlotting) {
          onLocationSelect([e.latlng.lat, e.latlng.lng]);
        }
      },
    });
    return null;
  };

  return (
    <MapContainer
      center={[10.6750, 122.9500]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      className={isPlotting ? 'plotting-mode' : ''}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <MapEvents />
      {markerLocation && (
        <Marker position={markerLocation} />
      )}
    </MapContainer>
  );
};

const LandmarkFormModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  editingLandmark = null, 
  isEditMode = false 
}) => {
  const categories = ['Schools', 'Hospitals', 'Malls', 'Restaurants', 'Recreation', 'Other'];

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Other');
  const [description, setDescription] = useState('');
  const [nearestStop, setNearestStop] = useState('');
  const [coordinates, setCoordinates] = useState(null);
  const [isPlotting, setIsPlotting] = useState(false);
  const [plotButtonState, setPlotButtonState] = useState('plot'); // 'plot', 'confirm', 'save'

  // Initialize form with editing data
  useEffect(() => {
    if (isEditMode && editingLandmark) {
      setName(editingLandmark.name || '');
      setCategory(editingLandmark.category || 'Other');
      setDescription(editingLandmark.description || '');
      setNearestStop(editingLandmark.nearestStop || '');
      setCoordinates(editingLandmark.coordinates || null);
      setPlotButtonState('save'); // In edit mode with existing location
    } else {
      // Reset for add mode
      setName('');
      setCategory('Other');
      setDescription('');
      setNearestStop('');
      setCoordinates(null);
      setIsPlotting(false);
      setPlotButtonState('plot');
    }
  }, [isEditMode, editingLandmark, isOpen]);

  const handlePlotClick = () => {
    if (plotButtonState === 'plot') {
      setIsPlotting(true);
      setPlotButtonState('confirm');
    } else if (plotButtonState === 'confirm') {
      if (!coordinates) {
        alert('Please click on the map to place the landmark');
        return;
      }
      setIsPlotting(false);
      setPlotButtonState('save');
    } else if (plotButtonState === 'save') {
      handleSave();
    }
  };

  const handleLocationSelect = (coords) => {
    setCoordinates(coords);
  };

  const handleSave = () => {
    // Validation
    if (!name.trim()) {
      alert('Please enter a landmark name');
      return;
    }
    if (!coordinates) {
      alert('Please select a location on the map');
      return;
    }

    const landmarkData = {
      ...(isEditMode && editingLandmark && { id: editingLandmark.id }),
      name: name.trim(),
      category,
      description: description.trim(),
      nearestStop: nearestStop.trim(),
      coordinates,
    };

    onSave(landmarkData);
  };

  const handleClose = () => {
    // Reset state
    setName('');
    setCategory('Other');
    setDescription('');
    setNearestStop('');
    setCoordinates(null);
    setIsPlotting(false);
    setPlotButtonState('plot');
    onClose();
  };

  if (!isOpen) return null;

  const buttonLabels = {
    plot: 'Plot Landmark',
    confirm: 'Confirm Location',
    save: 'Save Landmark'
  };

  return (
    <div className="landmark-form-modal-overlay" onClick={handleClose}>
      <div className="landmark-form-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="landmark-modal-close" onClick={handleClose} title="Close">
          <CloseIcon />
        </button>

        {/* Title */}
        <h2 className="landmark-modal-title">
          {isEditMode ? 'Edit Landmark' : 'Add New Landmark'}
        </h2>

        <div className="landmark-modal-container">
          {/* Left Column - Form */}
          <div className="landmark-form-column">
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter landmark name"
                disabled={isPlotting}
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isPlotting}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {categoryEmojis[cat]} {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter landmark description (optional)"
                rows="3"
                disabled={isPlotting}
              />
            </div>

            <div className="form-group">
              <label>Nearest Stop</label>
              <input
                type="text"
                value={nearestStop}
                onChange={(e) => setNearestStop(e.target.value)}
                placeholder="Enter nearest jeepney stop"
                disabled={isPlotting}
              />
            </div>

            {coordinates && (
              <div className="coordinates-display">
                <p><strong>Location:</strong></p>
                <p>Latitude: {coordinates[0].toFixed(6)}</p>
                <p>Longitude: {coordinates[1].toFixed(6)}</p>
              </div>
            )}

            <div className="form-actions">
              <button
                className="plot-btn"
                onClick={handlePlotClick}
              >
                {buttonLabels[plotButtonState]}
              </button>
              <button
                className="cancel-btn"
                onClick={handleClose}
                disabled={isPlotting}
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Right Column - Map */}
          <div className="landmark-map-column">
            <div className="map-container">
              <MapPlotter
                onLocationSelect={handleLocationSelect}
                markerLocation={coordinates}
                isPlotting={isPlotting}
              />
              {isPlotting && (
                <div className="plotting-instruction">
                  Click on the map to place the landmark
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandmarkFormModal;
