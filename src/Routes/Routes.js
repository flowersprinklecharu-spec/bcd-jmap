import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
// Navbar moved to App.js (top-level)
import RouteMapEditor from './RouteMapEditor';
import LeafletMap from '../Map/LeafletMap';
import { saveRoute, deleteRoute, normalizeDocData } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { AdminContext } from '../contexts/AdminContext';
import { getNextRouteNumber, getRouteColor } from '../utils/routeUtils';
import './routes.css';

// SVG Icons - Memoized components
const SearchIcon = React.memo(() => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path>
  </svg>
));

const CloseIcon = React.memo(() => (
  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
  </svg>
));

const EditIcon = React.memo(() => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>
  </svg>
));

const DeleteIcon = React.memo(() => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
  </svg>
));

const AddIcon = React.memo(() => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path>
  </svg>
));

const MapIcon = React.memo(() => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"></path>
  </svg>
));

// Utility function to sort routes by number
const sortRoutesByNumber = (routes) => {
  return [...routes].sort((a, b) => {
    const numA = parseInt(a.number) || 0;
    const numB = parseInt(b.number) || 0;
    return numA - numB;
  });
};

// Initial routes data - Empty by default (routes will be added manually via admin interface)
const initialRoutesData = [];

const Routes = ({ onNavigate, onRequestLogin }) => {
  const { isAdmin } = useContext(AdminContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routes, setRoutes] = useState(initialRoutesData);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('view');
  const [editingRoute, setEditingRoute] = useState(null);
  const [showMapEditor, setShowMapEditor] = useState(false);
  const [highlightedRoute, setHighlightedRoute] = useState(null); // For map highlighting
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // Track unsaved changes
  const [landmarks, setLandmarks] = useState([]); // For map display

  // Memoized filtered and sorted routes
  const filteredRoutes = useMemo(() => {
    return sortRoutesByNumber(
      routes.filter(route =>
        route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        route.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        route.number.includes(searchQuery)
      )
    );
  }, [routes, searchQuery]);

  // Memoized modal handlers
  const openModal = useCallback((route, mode = 'view') => {
    setSelectedRoute(route);
    setModalMode(mode);
    if (mode === 'edit') {
      setEditingRoute({ ...route });
      setShowMapEditor(false); // Start with form view for edit mode
    } else if (mode === 'add') {
      // Auto-assign next route number and color
      const nextNumber = getNextRouteNumber(routes);
      const autoColor = getRouteColor(nextNumber);
      
      console.log('📝 Auto-assigning route - Next number:', nextNumber, 'Color:', autoColor, 'Existing routes:', routes);
      
      setEditingRoute({
        id: Date.now(),
        number: nextNumber.toString(),
        name: '',
        description: '',
        fare: '₱11.00 - ₱15.00',
        color: autoColor,
        operatingHours: '5:00 AM - 9:00 PM',
        frequency: 'Every 5-10 mins',
        majorStops: [],
        coordinates: [] // Array of [lat, lng] points for route path
      });
      setShowMapEditor(true); // Immediately open map editor for add mode
    }
    setShowModal(true);
  }, [routes]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setSelectedRoute(null);
    setEditingRoute(null);
    setModalMode('view');
    setHasUnsavedChanges(false); // Clear unsaved changes flag
    setShowMapEditor(false);
  }, []);

  // Safe close that warns about unsaved changes
  const safeCloseModal = useCallback(() => {
    if (hasUnsavedChanges && editingRoute && (modalMode === 'add' || modalMode === 'edit')) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
        closeModal();
      }
    } else {
      closeModal();
    }
  }, [hasUnsavedChanges, editingRoute, modalMode, closeModal]);

  const handleAddRoute = useCallback(() => {
    openModal(null, 'add');
  }, [openModal]);

  const handleEditRoute = useCallback((route) => {
    openModal(route, 'edit');
  }, [openModal]);

  const handleDeleteRoute = useCallback(async (routeId) => {
    if (window.confirm('Are you sure you want to delete this route?')) {
      try {
        await deleteRoute(routeId);
        alert('✅ Route deleted successfully!');
      } catch (err) {
        console.error(err);
        alert('❌ Failed to delete route: ' + err.message);
      }
    }
  }, []);

  const handleSaveRoute = useCallback(async () => {
    try {
      if (modalMode === 'add') {
        await saveRoute(editingRoute);
        alert('✅ Route added successfully!');
      } else if (modalMode === 'edit') {
        await saveRoute(editingRoute);
        alert('✅ Route updated successfully!');
      }
      // Clear draft and unsaved changes on successful save
      localStorage.removeItem('routeDraft');
      setHasUnsavedChanges(false);
      closeModal();
    } catch (err) {
      console.error(err);
      alert('❌ Failed to save route: ' + err.message);
    }
  }, [modalMode, editingRoute, closeModal]);

  useEffect(() => {
    try {
      const routesCol = collection(db, 'routes');
      const routesQuery = query(routesCol);
      const unsubRoutes = onSnapshot(routesQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => normalizeDocData(doc));
        setRoutes(sortRoutesByNumber(data));
      }, (err) => {
        console.error('Routes listener error', err);
      });

      const landmarksCol = collection(db, 'landmarks');
      const landmarksQuery = query(landmarksCol);
      const unsubLandmarks = onSnapshot(landmarksQuery, (snapshot) => {
        const lm = snapshot.docs.map(doc => {
          const normalized = normalizeDocData(doc);
          // Ensure valid coordinates
          if (!normalized.coordinates || !Array.isArray(normalized.coordinates) || normalized.coordinates.length !== 2) {
            normalized.coordinates = null;
          }
          return { id: doc.id, ...normalized };
        });
        setLandmarks(lm.filter(l => l.coordinates !== null));
      }, (err) => {
        console.error('Landmarks listener error', err);
      });

      return () => {
        unsubRoutes && unsubRoutes();
        unsubLandmarks && unsubLandmarks();
      };
    } catch (err) {
      console.warn('Firestore not available for routes', err);
    }
  }, []);

  // Auto-save draft to localStorage whenever editingRoute changes
  useEffect(() => {
    if (editingRoute && (modalMode === 'add' || modalMode === 'edit')) {
      setHasUnsavedChanges(true);
      // Save to localStorage with a debounce (save after 1 second of no changes)
      const timer = setTimeout(() => {
        localStorage.setItem('routeDraft', JSON.stringify(editingRoute));
        console.log('💾 Route draft auto-saved');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [editingRoute, modalMode]);

  // Warn before closing/refreshing if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && editingRoute && (modalMode === 'add' || modalMode === 'edit')) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, editingRoute, modalMode]);

  const handleInputChange = useCallback((field, value) => {
    setEditingRoute(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleMapEditorSave = useCallback((newStops) => {
    // Preserve existing majorStops and append new ones (avoid duplicates)
    const existingStops = editingRoute.majorStops || [];
    const newStopNames = newStops.map(stop => stop.name);
    const uniqueNewStops = newStopNames.filter(name => !existingStops.includes(name));
    const mergedStops = [...existingStops, ...uniqueNewStops];
    
    // Update editing route with new stops
    setEditingRoute(prev => ({
      ...prev,
      majorStops: mergedStops,
      stops: [...(prev.stops || []), ...newStops]
    }));
    
    setShowMapEditor(false);
    alert(`✅ Added ${uniqueNewStops.length} new stops!`);
  }, [editingRoute]);

  const handleStopChange = useCallback((index, value) => {
    setEditingRoute(prev => {
      const newStops = [...prev.majorStops];
      newStops[index] = value;
      return { ...prev, majorStops: newStops };
    });
  }, []);

  const addStop = useCallback(() => {
    setEditingRoute(prev => ({
      ...prev,
      majorStops: [...prev.majorStops, '']
    }));
  }, []);

  const removeStop = useCallback((index) => {
    setEditingRoute(prev => ({
      ...prev,
      majorStops: prev.majorStops.filter((_, i) => i !== index)
    }));
  }, []);

  return (
    <div className="routes-page">
      {/* Navbar is rendered by App.js */}
      <div className="routes-container">
        <div className="routes-hero">
          <div className="routes-header-row">
            <h1 className="routes-title">Jeepney Routes in Bacolod City</h1>
            {isAdmin && (
              <button className="admin-add-btn" onClick={handleAddRoute}>
                <AddIcon />
                Add New Route
              </button>
            )}
          </div>
          <p className="routes-subtitle">Local Public Transport Route Plan (LPTRP) - New and Rationalized Routes</p>
          
          <div className="search-box">
            <div className="search-icon">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search routes, landmarks, or destinations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {/* Map Display Section */}
        {highlightedRoute && highlightedRoute.coordinates && highlightedRoute.coordinates.length > 0 && (
          <div className="route-map-preview">
            <div className="map-preview-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span 
                  style={{ 
                    backgroundColor: highlightedRoute.color, 
                    color: '#fff', 
                    padding: '4px 12px', 
                    borderRadius: '4px',
                    fontWeight: 'bold'
                  }}
                >
                  Route {highlightedRoute.number}
                </span>
                {highlightedRoute.name}
              </h3>
              <button 
                onClick={() => setHighlightedRoute(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0 8px',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>
            <LeafletMap
              routes={routes}
              selectedRoute={highlightedRoute}
              landmarks={landmarks}
              highlightedStops={[]}
              destination=""
              suggestedRoutes={[]}
            />
          </div>
        )}

        <div className="routes-grid">
          {filteredRoutes.map((route) => (
            <div 
              key={route.id} 
              className={`route-card ${highlightedRoute?.id === route.id ? 'route-card-active' : ''}`}
              onClick={() => setHighlightedRoute(route)}
              style={{ cursor: 'pointer' }}
            >
              <div className="route-header">
                <div 
                  className="route-number"
                  style={{ backgroundColor: route.color }}
                >
                  {route.number}
                </div>
                <div className="route-info">
                  <h3 className="route-name">{route.name}</h3>
                  <p className="route-description">{route.description}</p>
                </div>
              </div>

              <div className="route-footer">
                <div className="route-fare">Fare: {route.fare}</div>
                <div className="route-actions">
                  <button 
                    className="view-details-btn"
                    onClick={() => openModal(route, 'view')}
                  >
                    View Details
                  </button>
                  {isAdmin && (
                    <>
                      <button 
                        className="admin-edit-btn"
                        onClick={() => handleEditRoute(route)}
                      >
                        <EditIcon />
                      </button>
                      <button 
                        className="admin-delete-btn"
                        onClick={() => handleDeleteRoute(route.id)}
                      >
                        <DeleteIcon />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredRoutes.length === 0 && (
          <div className="no-results">
            <p>No routes found matching your search.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className={`modal-overlay ${showMapEditor ? 'map-editor-active' : ''}`} onClick={safeCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={safeCloseModal}>
              <CloseIcon />
            </button>

            {modalMode === 'view' && selectedRoute && (
              <>
                <div className="modal-header">
                  <div 
                    className="modal-route-number"
                    style={{ backgroundColor: selectedRoute.color }}
                  >
                    {selectedRoute.number}
                  </div>
                  <div>
                    <h2 className="modal-title">{selectedRoute.name}</h2>
                    <p className="modal-subtitle">Complete Route Loop</p>
                  </div>
                </div>

                <div className="modal-info-grid">
                  <div className="info-box">
                    <h4 className="info-label">Fare</h4>
                    <p className="info-value">{selectedRoute.fare}</p>
                  </div>
                  <div className="info-box">
                    <h4 className="info-label">Operating Hours</h4>
                    <p className="info-value">{selectedRoute.operatingHours}</p>
                  </div>
                  <div className="info-box">
                    <h4 className="info-label">Frequency</h4>
                    <p className="info-value">{selectedRoute.frequency}</p>
                  </div>
                </div>

                <div className="modal-section">
                  <h3 className="section-title">Route Description</h3>
                  <p className="section-text">{selectedRoute.description}</p>
                </div>

                <div className="modal-section">
                  <h3 className="section-title">Major Stops</h3>
                  <div className="stops-list">
                    {selectedRoute.majorStops.map((stop, index) => (
                      <div key={index} className="stop-item">
                        <div 
                          className="stop-number"
                          style={{ backgroundColor: selectedRoute.color }}
                        >
                          {index + 1}
                        </div>
                        <span className="stop-name">{stop}</span>
                      </div>
                    ))}
                  </div>
                </div>


              </>
            )}

            {(modalMode === 'add' || modalMode === 'edit') && editingRoute && (
              <>
                {console.log('🔍 Rendering form - editingRoute:', editingRoute, 'modalMode:', modalMode)}
                <div className="modal-header">
                  <h2 className="modal-title">
                    {modalMode === 'add' ? 'Add New Route' : 'Edit Route'}
                  </h2>
                </div>

                {/* Auto-Assignment Preview for Add Mode */}
                {modalMode === 'add' && (
                  <div style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderBottom: '1px solid #e0e0e0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#333'
                    }}>
                      <span>Auto-assigned:</span>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 12px',
                        backgroundColor: editingRoute.color,
                        color: '#fff',
                        borderRadius: '4px',
                        fontWeight: 'bold'
                      }}>
                        Route {editingRoute.number}
                      </div>
                    </div>
                  </div>
                )}

                <div className="edit-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Route Number</label>
                      <input
                        type="text"
                        value={editingRoute?.number || ''}
                        onChange={(e) => handleInputChange('number', e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Route Color</label>
                      <input
                        type="color"
                        value={editingRoute?.color || '#FF5722'}
                        onChange={(e) => handleInputChange('color', e.target.value)}
                        className="form-input-color"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Route Name</label>
                    <input
                      type="text"
                      value={editingRoute.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      value={editingRoute.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="form-textarea"
                      rows="3"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Fare Range</label>
                      <input
                        type="text"
                        value={editingRoute.fare}
                        onChange={(e) => handleInputChange('fare', e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Frequency</label>
                      <input
                        type="text"
                        value={editingRoute.frequency}
                        onChange={(e) => handleInputChange('frequency', e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Operating Hours</label>
                    <input
                      type="text"
                      value={editingRoute.operatingHours}
                      onChange={(e) => handleInputChange('operatingHours', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <div className="stops-section-header">
                      <label className="form-label">Major Stops</label>
                      <button
                        type="button"
                        className="map-editor-toggle-btn"
                        onClick={() => setShowMapEditor(!showMapEditor)}
                      >
                        <MapIcon />
                        {showMapEditor ? 'Hide Map' : 'Edit with Map'}
                      </button>
                    </div>
                    
                    {!showMapEditor && modalMode === 'edit' && editingRoute.majorStops.length > 0 && (
                      <div className="existing-stops-section">
                        <h5 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#333' }}>
                          Existing Stops ({editingRoute.majorStops.length})
                        </h5>
                        <div className="existing-stops-list">
                          {editingRoute.majorStops.map((stop, index) => (
                            <div key={index} className="existing-stop-item">
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                flex: 1,
                                padding: '10px',
                                backgroundColor: '#f5f5f5',
                                borderRadius: '6px'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '28px',
                                  height: '28px',
                                  backgroundColor: editingRoute.color,
                                  color: '#fff',
                                  borderRadius: '50%',
                                  fontWeight: 'bold',
                                  fontSize: '13px'
                                }}>
                                  {index + 1}
                                </div>
                                <span style={{ flex: 1, color: '#333', fontWeight: '500' }}>{stop}</span>
                                {editingRoute.majorStops.length > 1 && (
                                  <button
                                    type="button"
                                    className="remove-stop-btn"
                                    onClick={() => removeStop(index)}
                                    style={{
                                      padding: '6px 10px',
                                      backgroundColor: '#ff4444',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '13px',
                                      fontWeight: '600'
                                    }}
                                  >
                                    <DeleteIcon /> Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {showMapEditor && (
                      <div className="map-editor-container">
                        <RouteMapEditor
                          route={editingRoute}
                          onSave={handleMapEditorSave}
                          onCancel={() => setShowMapEditor(false)}
                          isNewRoute={modalMode === 'add'}
                        />
                      </div>
                    )}
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={safeCloseModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="save-btn"
                      onClick={handleSaveRoute}
                    >
                      {modalMode === 'add' ? 'Add Route' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Routes;