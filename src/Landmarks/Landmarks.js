import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Navbar from '../Navbar/Navbar';
import { saveLandmark, deleteLandmark, normalizeDocData } from '../firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import './landmarks.css';

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// SVG Icons
const SearchIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path>
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
  </svg>
);

const AddIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path>
  </svg>
);

const EditIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>
  </svg>
);

const DeleteIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
  </svg>
);

const NavigationIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"></path>
  </svg>
);

// Route data with paths
const routesData = [
  {
    id: 1,
    number: '1',
    name: 'Banago-Libertad Loop',
    color: '#FF5722',
    path: [[10.6950, 122.9450], [10.6850, 122.9550], [10.6750, 122.9500]]
  },
  {
    id: 2,
    number: '2',
    name: 'Bata-Libertad Loop',
    color: '#2196F3',
    path: [[10.6850, 122.9600], [10.6750, 122.9500]]
  },
  {
    id: 3,
    number: '3',
    name: 'Northbound Terminal-Libertad Loop',
    color: '#4CAF50',
    path: [[10.7000, 122.9500], [10.6750, 122.9500]]
  },
];

// Calculate distance
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Find nearby routes
const findNearbyRoutes = (lat, lon, maxDistance = 0.5) => {
  if (typeof lat !== 'number' || typeof lon !== 'number') return [];
  
  const nearbyRoutes = [];
  routesData.forEach(route => {
    if (!route.path || !Array.isArray(route.path)) return;
    
    const isNear = route.path.some(point => {
      if (!Array.isArray(point) || point.length !== 2) return false;
      const distance = calculateDistance(lat, lon, point[0], point[1]);
      return distance <= maxDistance;
    });
    
    if (isNear) nearbyRoutes.push(route);
  });
  return nearbyRoutes;
};

// Suggest routes
const suggestRoutes = (userLat, userLon, landmarkLat, landmarkLon) => {
  if (typeof userLat !== 'number' || typeof userLon !== 'number' ||
      typeof landmarkLat !== 'number' || typeof landmarkLon !== 'number') {
    return [];
  }
  
  const userRoutes = findNearbyRoutes(userLat, userLon);
  const landmarkRoutes = findNearbyRoutes(landmarkLat, landmarkLon);
  
  const commonRoutes = userRoutes.filter(userRoute =>
    landmarkRoutes.some(landmarkRoute => landmarkRoute.id === userRoute.id)
  );
  
  return commonRoutes.length > 0 ? commonRoutes : landmarkRoutes;
};

const Landmarks = ({ onNavigate, isAdmin: initialIsAdmin, onAdminToggle, onRequestLogin }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLandmark, setSelectedLandmark] = useState(null);
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin || false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLandmark, setEditingLandmark] = useState(null);
  const [editMode, setEditMode] = useState('view');
  const [landmarks, setLandmarks] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [suggestedRoutes, setSuggestedRoutes] = useState([]);
  const [distance, setDistance] = useState(null);

  const categories = ['All', 'Schools', 'Hospitals', 'Malls', 'Restaurants', 'Recreation'];

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.log('Location denied:', error);
          setUserLocation({ lat: 10.6750, lon: 122.9500 });
        }
      );
    } else {
      setUserLocation({ lat: 10.6750, lon: 122.9500 });
    }
  }, []);

  // Load landmarks
  useEffect(() => {
    try {
      const col = collection(db, 'landmarks');
      const q = query(col);
      const unsub = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => {
          const normalized = normalizeDocData(doc);
          // Ensure valid coordinates
          if (!normalized.coordinates || !Array.isArray(normalized.coordinates) || normalized.coordinates.length !== 2) {
            normalized.coordinates = [10.6750, 122.9500];
          }
          // Ensure id exists
          if (!normalized.id) {
            normalized.id = doc.id;
          }
          return normalized;
        });
        setLandmarks(data);
      }, (err) => {
        console.error('Landmarks error', err);
      });

      return () => unsub && unsub();
    } catch (err) {
      console.warn('Firestore unavailable', err);
    }
  }, []);

  // Calculate routes when landmark selected
  useEffect(() => {
    if (selectedLandmark && userLocation) {
      const coords = selectedLandmark.coordinates || [10.6750, 122.9500];
      
      if (Array.isArray(coords) && coords.length === 2 && 
          typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        const dist = calculateDistance(
          userLocation.lat,
          userLocation.lon,
          coords[0],
          coords[1]
        );
        setDistance(dist);

        const routes = suggestRoutes(
          userLocation.lat,
          userLocation.lon,
          coords[0],
          coords[1]
        );
        setSuggestedRoutes(routes);
      }
    }
  }, [selectedLandmark, userLocation]);

  const filteredLandmarks = landmarks.filter(landmark => {
    const matchesSearch = (landmark.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (landmark.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || landmark.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openModal = (landmark) => {
    setSelectedLandmark(landmark);
  };

  const closeModal = () => {
    setSelectedLandmark(null);
    setSuggestedRoutes([]);
    setDistance(null);
  };

  // Custom icons
  const createCustomIcon = (color, letter) => {
    return L.divIcon({
      html: `<div style="background-color: ${color}; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${letter}</div>`,
      className: 'custom-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });
  };

  const userLocationIcon = L.divIcon({
    html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);"></div>`,
    className: 'user-location-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  const handleAddLandmark = () => {
    setEditingLandmark({
      id: Date.now(),
      name: '',
      category: 'Schools',
      icon: 'L',
      iconColor: '#2196F3',
      description: '',
      coordinates: [10.6750, 122.9500],
      address: '',
      operatingHours: '',
      nearestStop: ''
    });
    setEditMode('add');
    setShowEditModal(true);
  };

  const handleEditLandmark = (landmark) => {
    const copy = { ...landmark };
    if (!copy.coordinates || !Array.isArray(copy.coordinates) || copy.coordinates.length !== 2) {
      copy.coordinates = [10.6750, 122.9500];
    }
    setEditingLandmark(copy);
    setEditMode('edit');
    setShowEditModal(true);
  };

  const handleInputChange = (field, value) => {
    setEditingLandmark(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCoordinateChange = (index, value) => {
    const coords = editingLandmark.coordinates || [10.6750, 122.9500];
    const newCoords = [...coords];
    newCoords[index] = parseFloat(value) || 0;
    setEditingLandmark(prev => ({
      ...prev,
      coordinates: newCoords
    }));
  };

  const handleSaveLandmark = async () => {
    if (!editingLandmark.name.trim()) {
      alert('❌ Name required');
      return;
    }

    if (!editingLandmark.coordinates || !Array.isArray(editingLandmark.coordinates) || editingLandmark.coordinates.length !== 2) {
      editingLandmark.coordinates = [10.6750, 122.9500];
    }

    try {
      await saveLandmark(editingLandmark);
      alert('✅ Saved!');
      setShowEditModal(false);
      setEditingLandmark(null);
      setEditMode('view');
    } catch (err) {
      console.error(err);
      alert('❌ Failed: ' + err.message);
    }
  };

  const handleDeleteLandmark = async (landmarkId, landmarkName) => {
    if (window.confirm(`Delete "${landmarkName}"?`)) {
      try {
        await deleteLandmark(landmarkId);
        setSelectedLandmark(null);
        alert('✅ Deleted!');
      } catch (err) {
        console.error(err);
        alert('❌ Failed: ' + err.message);
      }
    }
  };

  return (
    <div className="landmarks-page">
      <Navbar 
        isAdmin={isAdmin} 
        onAdminToggle={onAdminToggle || (() => setIsAdmin(!isAdmin))}
        onNavigate={onNavigate}
        currentPage="landmarks"
      />

      <div className="landmarks-container">
        <div className="landmarks-hero">
          <div className="landmarks-header-row">
            <h1 className="landmarks-title">Popular Landmarks in Bacolod</h1>
            {isAdmin && (
              <button className="admin-add-btn" onClick={handleAddLandmark}>
                <AddIcon />
                Add New Landmark
              </button>
            )}
          </div>
          
          <div className="search-box">
            <div className="search-icon">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search landmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="category-filter">
          {categories.map(category => (
            <button
              key={category}
              className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="landmarks-grid">
          {filteredLandmarks.map(landmark => (
            <div key={landmark.id} className="landmark-card">
              <div className="landmark-header">
                <div 
                  className="landmark-icon"
                  style={{ backgroundColor: landmark.iconColor || '#2196F3' }}
                >
                  {landmark.icon || 'L'}
                </div>
                <div className="landmark-info">
                  <h3 className="landmark-name">{landmark.name}</h3>
                  <p className="landmark-description">{landmark.description}</p>
                </div>
              </div>
              <div className="landmark-actions">
                <button 
                  className="show-map-btn"
                  onClick={() => openModal(landmark)}
                >
                  Show on Map
                </button>
                {isAdmin && (
                  <>
                    <button 
                      className="admin-edit-btn"
                      onClick={() => handleEditLandmark(landmark)}
                    >
                      <EditIcon />
                    </button>
                    <button 
                      className="admin-delete-btn"
                      onClick={() => handleDeleteLandmark(landmark.id, landmark.name)}
                    >
                      <DeleteIcon />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredLandmarks.length === 0 && (
          <div className="no-results">
            <p>No landmarks found.</p>
          </div>
        )}
      </div>

      {/* Map Modal */}
      {selectedLandmark && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              <CloseIcon />
            </button>

            <div className="modal-header">
              <div 
                className="modal-landmark-icon"
                style={{ backgroundColor: selectedLandmark.iconColor || '#2196F3' }}
              >
                {selectedLandmark.icon || 'L'}
              </div>
              <div>
                <h2 className="modal-title">{selectedLandmark.name}</h2>
                <p className="modal-subtitle">{selectedLandmark.address}</p>
              </div>
            </div>

            <div className="modal-info-grid">
              <div className="info-box">
                <h4 className="info-label">Operating Hours</h4>
                <p className="info-value">{selectedLandmark.operatingHours || 'N/A'}</p>
              </div>
              <div className="info-box">
                <h4 className="info-label">Nearest Stop</h4>
                <p className="info-value">{selectedLandmark.nearestStop || 'N/A'}</p>
              </div>
              <div className="info-box">
                <h4 className="info-label">Distance</h4>
                <p className="info-value">
                  {distance ? `${distance.toFixed(2)} km` : 'Calculating...'}
                </p>
              </div>
            </div>

            <div className="modal-section">
              <h3 className="section-title">
                <NavigationIcon /> Interactive Map
              </h3>
              <div className="map-view-container">
                {userLocation && 
                 selectedLandmark.coordinates && 
                 Array.isArray(selectedLandmark.coordinates) && 
                 selectedLandmark.coordinates.length === 2 ? (
                  <MapContainer
                    center={selectedLandmark.coordinates}
                    zoom={14}
                    style={{ height: '100%', width: '100%', borderRadius: '8px' }}
                  >
                    <TileLayer
                      attribution='&copy; OpenStreetMap'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    <Marker 
                      position={[userLocation.lat, userLocation.lon]}
                      icon={userLocationIcon}
                    >
                      <Popup>Your Location</Popup>
                    </Marker>

                    <Circle
                      center={[userLocation.lat, userLocation.lon]}
                      radius={100}
                      pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1 }}
                    />

                    <Marker 
                      position={selectedLandmark.coordinates}
                      icon={createCustomIcon(selectedLandmark.iconColor || '#2196F3', selectedLandmark.icon || 'L')}
                    >
                      <Popup>
                        <strong>{selectedLandmark.name}</strong><br/>
                        {selectedLandmark.address}
                      </Popup>
                    </Marker>

                    {suggestedRoutes.map(route => {
                      if (route.path && Array.isArray(route.path) && route.path.length > 1) {
                        return (
                          <Polyline
                            key={route.id}
                            positions={route.path}
                            pathOptions={{ color: route.color, weight: 4, opacity: 0.7 }}
                          />
                        );
                      }
                      return null;
                    })}

                    <Polyline
                      positions={[
                        [userLocation.lat, userLocation.lon],
                        selectedLandmark.coordinates
                      ]}
                      pathOptions={{ 
                        color: '#64748b', 
                        weight: 2, 
                        opacity: 0.5,
                        dashArray: '5, 10'
                      }}
                    />
                  </MapContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
                    <p>Map unavailable</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-section">
              <h3 className="section-title">Suggested Routes</h3>
              {suggestedRoutes.length > 0 ? (
                <div className="stops-list">
                  {suggestedRoutes.map(route => (
                    <div key={route.id} className="stop-item route-suggestion">
                      <div 
                        className="stop-number"
                        style={{ backgroundColor: route.color }}
                      >
                        {route.number}
                      </div>
                      <div className="route-suggestion-info">
                        <span className="stop-name">{route.name}</span>
                        <span className="route-fare">Fare: ₱11.00 - ₱15.00</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-routes-found">
                  <p>⚠️ No direct routes found.</p>
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="modal-admin-actions">
                <button 
                  className="modal-edit-btn"
                  onClick={() => {
                    closeModal();
                    handleEditLandmark(selectedLandmark);
                  }}
                >
                  <EditIcon /> Edit
                </button>
                <button 
                  className="modal-delete-btn"
                  onClick={() => handleDeleteLandmark(selectedLandmark.id, selectedLandmark.name)}
                >
                  <DeleteIcon /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingLandmark && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowEditModal(false)}>
              <CloseIcon />
            </button>

            <h2 className="modal-title">
              {editMode === 'add' ? 'Add Landmark' : 'Edit Landmark'}
            </h2>

            <div className="edit-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    value={editingLandmark.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    value={editingLandmark.category || 'Schools'}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="form-input"
                  >
                    <option value="Schools">Schools</option>
                    <option value="Hospitals">Hospitals</option>
                    <option value="Malls">Malls</option>
                    <option value="Restaurants">Restaurants</option>
                    <option value="Recreation">Recreation</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Icon</label>
                  <input
                    type="text"
                    maxLength="1"
                    value={editingLandmark.icon || ''}
                    onChange={(e) => handleInputChange('icon', e.target.value.toUpperCase())}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Color</label>
                  <input
                    type="color"
                    value={editingLandmark.iconColor || '#2196F3'}
                    onChange={(e) => handleInputChange('iconColor', e.target.value)}
                    className="form-input-color"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  value={editingLandmark.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="form-textarea"
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  type="text"
                  value={editingLandmark.address || ''}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={(editingLandmark.coordinates && editingLandmark.coordinates[0]) || 10.6750}
                    onChange={(e) => handleCoordinateChange(0, e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={(editingLandmark.coordinates && editingLandmark.coordinates[1]) || 122.9500}
                    onChange={(e) => handleCoordinateChange(1, e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Hours</label>
                  <input
                    type="text"
                    value={editingLandmark.operatingHours || ''}
                    onChange={(e) => handleInputChange('operatingHours', e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nearest Stop</label>
                  <input
                    type="text"
                    value={editingLandmark.nearestStop || ''}
                    onChange={(e) => handleInputChange('nearestStop', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button className="cancel-btn" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button className="save-btn" onClick={handleSaveLandmark}>
                  {editMode === 'add' ? 'Add' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Landmarks;