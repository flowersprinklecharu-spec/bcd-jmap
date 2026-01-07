import React, { useState, useEffect, useContext } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Navbar moved to App.js (top-level)
import { saveLandmark, deleteLandmark, normalizeDocData } from '../firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AdminContext } from '../contexts/AdminContext';
import LandmarkMapEditor from './LandmarkMapEditor';
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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

const DeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const NavigationIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"></path>
  </svg>
);

// Calculate distance using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Get closest distance from user to route's coordinates
const getClosestDistanceToRoute = (userLat, userLon, routeCoordinates) => {
  if (!routeCoordinates || !Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
    return Infinity;
  }
  
  let closestDistance = Infinity;
  routeCoordinates.forEach(coord => {
    if (Array.isArray(coord) && coord.length === 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
      const distance = calculateDistance(userLat, userLon, coord[0], coord[1]);
      closestDistance = Math.min(closestDistance, distance);
    }
  });
  
  return closestDistance;
};

// Suggest jeepneys based on: 1) goes to landmark 2) near user's location
const getSuggestedJeepneys = (routes, userLat, userLon, landmarkName, maxProximityDistance = 3.0) => {
  if (!routes || !Array.isArray(routes) || !landmarkName) {
    return [];
  }
  
  // Filter routes that have the landmark as a major stop
  const routesWithLandmark = routes.filter(route => {
    if (!route.majorStops || !Array.isArray(route.majorStops)) return false;
    
    return route.majorStops.some(stop => {
      const stopName = typeof stop === 'string' ? stop : stop.name;
      return stopName && stopName.toLowerCase() === landmarkName.toLowerCase();
    });
  });
  
  // Filter by proximity to user and sort by distance
  const nearbyJeepneys = routesWithLandmark
    .map(route => {
      const distance = getClosestDistanceToRoute(userLat, userLon, route.coordinates);
      return { ...route, userDistance: distance };
    })
    .filter(route => route.userDistance <= maxProximityDistance)
    .sort((a, b) => a.userDistance - b.userDistance);
  
  // If no nearby routes found within proximity, return all routes that go to the landmark
  if (nearbyJeepneys.length === 0) {
    return routesWithLandmark.map(route => {
      const distance = getClosestDistanceToRoute(userLat, userLon, route.coordinates);
      return { ...route, userDistance: distance };
    }).sort((a, b) => a.userDistance - b.userDistance);
  }
  
  return nearbyJeepneys;
}

// Category to emoji mapping
const categoryEmojis = {
  'Schools': '🎓',
  'Hospitals': '🏥',
  'Malls': '🛍️',
  'Restaurants': '🍽️',
  'Recreation': '🎮',
  'Other': '📍'
};

const Landmarks = ({ onNavigate, onRequestLogin, onAdminEditingChange }) => {
  const { isAdmin } = useContext(AdminContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLandmark, setSelectedLandmark] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLandmark, setEditingLandmark] = useState(null);
  const [editMode, setEditMode] = useState('view');
  const [landmarks, setLandmarks] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [suggestedRoutes, setSuggestedRoutes] = useState([]);
  const [showMapEditor, setShowMapEditor] = useState(false);
  const [routes, setRoutes] = useState([]);

  const categories = ['All', 'Schools', 'Hospitals', 'Malls', 'Restaurants', 'Recreation', 'Other'];

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

  // Load routes from Firestore
  useEffect(() => {
    try {
      const routesCol = collection(db, 'routes');
      const routesQuery = query(routesCol);
      const unsub = onSnapshot(routesQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => normalizeDocData(doc));
        setRoutes(data);
      }, (err) => {
        console.error('Routes error', err);
      });

      return () => unsub && unsub();
    } catch (err) {
      console.warn('Routes Firestore unavailable', err);
    }
  }, []);

  // Suggest jeepneys when landmark selected
  useEffect(() => {
    if (selectedLandmark && userLocation && routes.length > 0) {
      const suggestedJeepneys = getSuggestedJeepneys(
        routes,
        userLocation.lat,
        userLocation.lon,
        selectedLandmark.name
      );
      console.log('🔍 Suggested jeepneys for landmark:', selectedLandmark.name, {
        landmarkName: selectedLandmark.name,
        routesCount: routes.length,
        suggestedCount: suggestedJeepneys.length,
        suggested: suggestedJeepneys,
        allRoutes: routes.map(r => ({ id: r.id, number: r.number, name: r.name, majorStops: r.majorStops }))
      });
      setSuggestedRoutes(suggestedJeepneys);
    } else {
      setSuggestedRoutes([]);
    }
  }, [selectedLandmark, userLocation, routes]);

  // Notify parent about editing state
  useEffect(() => {
    if (onAdminEditingChange) {
      onAdminEditingChange(showEditModal || showMapEditor);
    }
  }, [showEditModal, showMapEditor, onAdminEditingChange]);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (selectedLandmark) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [selectedLandmark]);

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
  };

  const handleMapEditorSave = (newLandmark) => {
    saveLandmark(newLandmark).then(() => {
      const isEditMode = editingLandmark && editingLandmark.id;
      alert(isEditMode ? '✅ Landmark updated successfully!' : '✅ Landmark added successfully!');
      setShowMapEditor(false);
      setEditingLandmark(null);
    }).catch(err => {
      console.error('Error saving landmark:', err);
      alert('❌ Failed to save landmark. Please try again.');
    });
  };

  // Custom icons
  const createCustomIcon = (color) => {
    return L.divIcon({
      html: `<svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"><path d="M 20 0 C 12 0 5 7 5 16 C 5 28 20 50 20 50 C 20 50 35 28 35 16 C 35 7 28 0 20 0 Z" fill="#2196F3" stroke="white" stroke-width="2"/><circle cx="20" cy="16" r="5" fill="white"/></svg>`,
      className: 'custom-marker',
      iconSize: [40, 50],
      iconAnchor: [20, 50],
    });
  };

  const userLocationIcon = L.divIcon({
    html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);"></div>`,
    className: 'user-location-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  const handleAddLandmark = () => {
    setEditingLandmark(null); // Clear any existing landmark data
    setEditMode('add');
    setShowMapEditor(true); // Open map editor for adding
  };

  const handleEditLandmark = (landmark) => {
    const copy = { ...landmark };
    if (!copy.coordinates || !Array.isArray(copy.coordinates) || copy.coordinates.length !== 2) {
      copy.coordinates = [10.6750, 122.9500];
    }
    setEditingLandmark(copy);
    setEditMode('edit');
    setShowMapEditor(true); // Open map editor for editing
  };

  const handleInputChange = (field, value) => {
    setEditingLandmark(prev => ({
      ...prev,
      [field]: value
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
      {/* Navbar is rendered by App.js */}
      <div className="landmarks-container">
        <div className="landmarks-hero">
          <div className="landmarks-header-row">
            <h1 className="landmarks-title">Popular Landmarks in Bacolod</h1>
          </div>
          
          <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', alignItems: 'center' }}>
            <div className="search-box" style={{ flex: 1, maxWidth: '800px' }}>
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
            
            {isAdmin && (
              <button className="admin-add-btn" onClick={handleAddLandmark}>
                <AddIcon />
                Add Landmark
              </button>
            )}
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
                  {categoryEmojis[landmark.category] || '📍'}
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
                      title="Edit landmark details and location"
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
                style={{ background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)' }}
              >
                📍
              </div>
              <div>
                <h2 className="modal-title">{selectedLandmark.name}</h2>
                <p className="modal-subtitle">{selectedLandmark.address}</p>
              </div>
            </div>

            <div className="modal-body">
              <div className="modal-info-grid">
                <div className="info-box">
                  <h4 className="info-label">Category</h4>
                  <p className="info-value">{selectedLandmark.category || 'N/A'}</p>
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
                      icon={createCustomIcon()}
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
              <h3 className="section-title">Suggested Jeepneys</h3>
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
            </div>

            {/* Admin edit/delete removed from public modal */}
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

      {showMapEditor && isAdmin && (
        <div className="map-editor-modal-overlay" onClick={() => setShowMapEditor(false)}>
          <div className="map-editor-modal-content" onClick={(e) => e.stopPropagation()}>
            <LandmarkMapEditor
              onSave={handleMapEditorSave}
              onCancel={() => {
                setShowMapEditor(false);
                setEditingLandmark(null);
              }}
              existingLandmarks={landmarks}
              editingLandmark={editingLandmark}
              isEditMode={editMode === 'edit'}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Landmarks;