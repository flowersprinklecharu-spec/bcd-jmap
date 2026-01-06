import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
// Navbar moved to App.js (top-level)
import RouteMapEditor from './RouteMapEditor';
import LeafletMap from '../Map/LeafletMap';
import { saveRoute, deleteRoute, normalizeDocData } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { AdminContext } from '../contexts/AdminContext';
import { getNextRouteNumber, getRouteColor } from '../utils/routeUtils';
import { geocodeAddress } from '../utils/geocodingService';
import { findNearbyRoutes, formatDistance } from '../utils/routeMatchingService';
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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
));

const DeleteIcon = React.memo(() => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
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

const Routes = ({ onNavigate, onRequestLogin, onAdminEditingChange }) => {
  const { isAdmin } = useContext(AdminContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routes, setRoutes] = useState(initialRoutesData);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('view');
  const [editingRoute, setEditingRoute] = useState(null);
  const [showMapEditor, setShowMapEditor] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // Track unsaved changes
  const [landmarks, setLandmarks] = useState([]); // For map display
  const [editingStopIndex, setEditingStopIndex] = useState(null); // For inline stop name editing
  const [editingStopName, setEditingStopName] = useState(''); // Temporary storage for edited stop name
  const [editingStopLocation, setEditingStopLocation] = useState(null); // For location edit modal
  const [toastMessage, setToastMessage] = useState(''); // For toast notifications
  const [highlightedStopIndex, setHighlightedStopIndex] = useState(null); // For animation
  const [confirmCloseModal, setConfirmCloseModal] = useState(false); // Confirmation for closing modal
  const [nearbyRoutesFromGeocoding, setNearbyRoutesFromGeocoding] = useState([]); // Routes found via geocoding
  const [showNearbyRoutesSection, setShowNearbyRoutesSection] = useState(false); // Whether to show nearby routes
  const [addPointInput, setAddPointInput] = useState(''); // For Add Point input field
  const [shouldTriggerCreatePath, setShouldTriggerCreatePath] = useState(false); // Trigger path creation from form button

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
    try {
      if (!route && mode === 'view') {
        console.warn('Cannot open modal: no route provided for view mode');
        return;
      }
      
      // Normalize route object to ensure all properties exist
      const normalizedRoute = route ? {
        id: route.id,
        number: route.number || 'N/A',
        name: route.name || 'Unknown Route',
        description: route.description || '',
        fare: route.fare || 'N/A',
        color: route.color || '#FF5722',
        operatingHours: route.operatingHours || 'N/A',
        frequency: route.frequency || 'N/A',
        majorStops: Array.isArray(route.majorStops) ? route.majorStops : [],
        coordinates: Array.isArray(route.coordinates) ? route.coordinates : []
      } : null;
      
      setSelectedRoute(normalizedRoute);
      setModalMode(mode);
      if (mode === 'edit' && normalizedRoute) {
        console.log('📋 openModal - route being set for edit:', {
          routeId: normalizedRoute?.id,
          number: normalizedRoute?.number,
          hasCoordinates: !!normalizedRoute?.coordinates,
          coordinatesLength: normalizedRoute?.coordinates?.length || 0,
          coordinates: normalizedRoute?.coordinates
        });
        setEditingRoute(normalizedRoute);
        setShowMapEditor(false); // Start with form, user clicks "Edit with Map" to see map
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
          coordinates: []
        });
        setShowMapEditor(false); // Start with form for add mode
      }
      setShowModal(true);
    } catch (err) {
      console.error('Error opening modal:', err);
    }
  }, [routes]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setSelectedRoute(null);
    setEditingRoute(null);
    setModalMode('view');
    setHasUnsavedChanges(false); // Clear unsaved changes flag
    setShowMapEditor(false);
    setEditingStopIndex(null);
    setEditingStopName('');
    setEditingStopLocation(null);
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
    console.log('✏️ Edit route clicked:', {
      routeId: route.id,
      number: route.number,
      coordinatesLength: route.coordinates?.length || 0,
      coordinatesType: typeof route.coordinates,
      coordinates: route.coordinates,
      allRouteKeys: Object.keys(route)
    });
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
      // Log the exact data being saved for debugging
      console.log('🔍 DEBUG: handleSaveRoute called');
      console.log('  Mode:', modalMode);
      console.log('  editingRoute.id:', editingRoute?.id);
      console.log('  editingRoute.number:', editingRoute?.number);
      console.log('  editingRoute.name:', editingRoute?.name);
      console.log('  editingRoute.majorStops:', editingRoute?.majorStops);
      console.log('  editingRoute.majorStops length:', editingRoute?.majorStops?.length);
      console.log('  editingRoute.coordinates:', editingRoute?.coordinates);
      console.log('  editingRoute.coordinates length:', editingRoute?.coordinates?.length);
      console.log('  Full editingRoute object:', JSON.stringify(editingRoute, null, 2));
      
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
      console.error('❌ Error saving route:', err);
      alert('❌ Failed to save route: ' + err.message);
    }
  }, [modalMode, editingRoute, closeModal]);

  useEffect(() => {
    try {
      const routesCol = collection(db, 'routes');
      const routesQuery = query(routesCol);
      const unsubRoutes = onSnapshot(routesQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => {
          const normalized = normalizeDocData(doc);
          console.log('📦 Route loaded from Firestore:', {
            id: doc.id,
            number: normalized.number,
            hasCoordinates: !!normalized.coordinates,
            coordinatesLength: normalized.coordinates?.length || 0,
            coordinatesFormat: normalized.coordinates ? normalized.coordinates[0] : 'N/A',
            fullCoordinates: normalized.coordinates
          });
          const finalRoute = { id: doc.id, ...normalized };
          console.log('📍 Final route object to store in state:', {
            id: finalRoute.id,
            number: finalRoute.number,
            coordinatesInFinal: !!finalRoute.coordinates,
            coordinatesLength: finalRoute.coordinates?.length || 0,
            coordinates: finalRoute.coordinates
          });
          return finalRoute;
        });
        const sorted = sortRoutesByNumber(data);
        console.log('🎯 Routes stored in state:', {
          count: sorted.length,
          routesWithCoordinates: sorted.filter(r => r.coordinates?.length > 0).map(r => ({
            id: r.id,
            number: r.number,
            coordinatesLength: r.coordinates?.length
          }))
        });
        setRoutes(sorted);
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

  // Notify parent about editing state
  useEffect(() => {
    if (onAdminEditingChange) {
      onAdminEditingChange(showModal || showMapEditor);
    }
  }, [showModal, showMapEditor, onAdminEditingChange]);

  const handleInputChange = useCallback((field, value) => {
    setEditingRoute(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleMapEditorSave = useCallback((newStops) => {
    // Preserve existing majorStops and append new ones (avoid duplicates)
    const existingStops = editingRoute.majorStops || [];
    
    // Filter out duplicates based on stop name
    const existingStopNames = existingStops.map(stop => {
      if (typeof stop === 'string') return stop;
      if (typeof stop === 'object' && stop.name) return stop.name;
      return null;
    }).filter(Boolean);
    
    // Keep full stop objects with coordinates for new stops
    const uniqueNewStops = newStops.filter(newStop => !existingStopNames.includes(newStop.name));
    
    // Merge existing and new stops - preserve full objects with coordinates
    const mergedStops = [...existingStops, ...uniqueNewStops];
    
    // Update editing route with new stops (full objects, not just names)
    setEditingRoute(prev => ({
      ...prev,
      majorStops: mergedStops
    }));
    
    console.log('✅ Map Editor Save - Added stops:', uniqueNewStops);
    console.log('  Total majorStops now:', mergedStops.length);
    console.log('  majorStops data:', mergedStops);
    
    alert(`✅ Added ${uniqueNewStops.length} new stops!`);
  }, [editingRoute]);

  const handleSaveRouteCoordinates = useCallback((coordinates) => {
    // Replace coordinates (don't append) - the pathWaypoints from RouteMapEditor are the FULL path
    setEditingRoute(prev => ({
      ...prev,
      coordinates: coordinates
    }));
    
    setHasUnsavedChanges(true);
    alert(`✅ Path saved! Route line created between ${coordinates.length} waypoints. You can continue editing or click "Save Changes" to finalize.`);
  }, []);

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

  // Handle search with geocoding fallback
  const handleSearchWithGeocoding = useCallback(async (query) => {
    setSearchQuery(query);
    
    // If query is short or looks like a route number, don't geocode
    if (query.length < 3 || /^\d+$/.test(query)) {
      setShowNearbyRoutesSection(false);
      setNearbyRoutesFromGeocoding([]);
      return;
    }

    // Filter routes normally first
    const exactMatches = filteredRoutes;

    // If we found exact matches, don't need to geocode
    if (exactMatches.length > 0) {
      setShowNearbyRoutesSection(false);
      setNearbyRoutesFromGeocoding([]);
      return;
    }

    // No exact matches, try geocoding the search query
    console.log('🌍 No exact matches, attempting geocoding for:', query);
    const coords = await geocodeAddress(query);

    if (coords) {
      const nearbyRoutes = findNearbyRoutes(coords, routes, 0.5);
      if (nearbyRoutes.length > 0) {
        console.log(`✅ Found ${nearbyRoutes.length} routes near "${query}":`, nearbyRoutes);
        setNearbyRoutesFromGeocoding(nearbyRoutes);
        setShowNearbyRoutesSection(true);
      } else {
        setShowNearbyRoutesSection(false);
        setNearbyRoutesFromGeocoding([]);
      }
    } else {
      setShowNearbyRoutesSection(false);
      setNearbyRoutesFromGeocoding([]);
    }
  }, [filteredRoutes, routes]);

  // Handler for saving edited stop name (placeholder - can be enhanced later)
  const handleSaveStopName = useCallback((index) => {
    if (editingStopName.trim() && editingRoute) {
      const updatedStops = [...editingRoute.majorStops];
      updatedStops[index] = editingStopName;
      setEditingRoute(prev => ({
        ...prev,
        majorStops: updatedStops
      }));
      setEditingStopIndex(null);
      setEditingStopName('');
    }
  }, [editingStopName, editingRoute]);

  // Handler for canceling stop name edit
  const handleCancelStopEdit = useCallback(() => {
    setEditingStopIndex(null);
    setEditingStopName('');
  }, []);

  // Handler for editing existing stop name in map editor
  const handleEditStopName = useCallback((index, newName) => {
    if (newName.trim() && editingRoute) {
      const updatedStops = [...editingRoute.majorStops];
      const stop = updatedStops[index];
      if (typeof stop === 'string') {
        updatedStops[index] = newName;
      } else {
        updatedStops[index] = { ...stop, name: newName };
      }
      setEditingRoute(prev => ({
        ...prev,
        majorStops: updatedStops
      }));
      setToastMessage('Stop name updated! ✓');
      setTimeout(() => setToastMessage(''), 2000);
    }
  }, [editingRoute]);

  // Handler for removing existing stop in map editor
  const handleRemoveExistingStop = useCallback((index) => {
    if (editingRoute && editingRoute.majorStops.length > 1) {
      const updatedStops = editingRoute.majorStops.filter((_, i) => i !== index);
      setEditingRoute(prev => ({
        ...prev,
        majorStops: updatedStops
      }));
      setToastMessage('Stop removed! ✓');
      setTimeout(() => setToastMessage(''), 2000);
    }
  }, [editingRoute]);

  // Handler for editing existing stop location in map editor
  const handleEditStopLocationInMapEditor = useCallback((index, stopName) => {
    const stop = editingRoute.majorStops[index];
    const coords = (typeof stop === 'object' && stop.lat !== undefined) 
      ? [stop.lat, stop.lng]
      : [10.6750, 122.9500];
    
    setEditingStopLocation({
      index,
      name: stopName,
      coordinates: coords
    });
  }, [editingRoute]);

  // Handler for Add Stops button in form section
  const handleAddStopsFormButton = useCallback(() => {
    if (!addPointInput.trim()) {
      alert('Please enter a stop name');
      return;
    }

    // Get the current map location or use a default
    // For now, we'll just add the stop with the name and let the user place it on the map
    const newStop = {
      name: addPointInput.trim(),
      lat: 10.6750, // Default to Bacolod center
      lng: 122.9600
    };

    setEditingRoute(prev => ({
      ...prev,
      majorStops: [...(prev.majorStops || []), newStop]
    }));

    // Clear the input
    setAddPointInput('');
    setHasUnsavedChanges(true);
    setToastMessage(`✓ Stop "${newStop.name}" added!`);
    setTimeout(() => setToastMessage(''), 2000);
  }, [addPointInput]);

  // Handler for Create Path button in form section
  const handleCreatePathFormButton = useCallback(() => {
    if (!editingRoute || !editingRoute.majorStops || editingRoute.majorStops.length < 2) {
      alert('Please add at least 2 stops before creating a path');
      return;
    }

    // Trigger the RouteMapEditor's path creation by toggling the flag
    setShouldTriggerCreatePath(true);
  }, [editingRoute]);

  return (
    <div className="routes-page">
      {/* Navbar is rendered by App.js */}
      <div className="routes-container">
        <div className="routes-hero">
          <div className="routes-header-row">
            <h1 className="routes-title">Jeepney Routes in Bacolod City</h1>
          </div>
          <p className="routes-subtitle">Local Public Transport Route Plan (LPTRP) - New and Rationalized Routes</p>
          
          <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', alignItems: 'center' }}>
            <div className="search-box" style={{ flex: 1, maxWidth: '800px' }}>
              <div className="search-icon" style={{ pointerEvents: 'none' }}>
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder="Search routes, landmarks, or destinations..."
                value={searchQuery}
                onChange={(e) => handleSearchWithGeocoding(e.target.value)}
                className="search-input"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    handleSearchWithGeocoding('');
                  }
                }}
              />
            </div>
            
            {isAdmin && (
              <button className="admin-add-btn" onClick={handleAddRoute}>
                <AddIcon />
                Add New Route
              </button>
            )}
          </div>
        </div>

        {/* Nearby Routes Section (from Geocoding) */}
        {showNearbyRoutesSection && nearbyRoutesFromGeocoding.length > 0 && (
          <div style={{
            padding: '2rem',
            backgroundColor: '#f0f4ff',
            borderRadius: '8px',
            marginBottom: '2rem',
            border: '2px solid #3b82f6'
          }}>
            <h2 style={{ color: '#1e40af', marginTop: 0 }}>
              🛣️ Routes passing near "{searchQuery}"
            </h2>
            <div className="routes-grid">
              {nearbyRoutesFromGeocoding.map((route) => (
                <div key={route.id} className="route-card">
                  <div className="route-header">
                    <div 
                      className="route-number"
                      style={{ backgroundColor: route.color }}
                    >
                      {route.number}
                    </div>
                    <div className="route-info">
                      <h3 className="route-name">{route.name}</h3>
                      <p className="route-description" style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                        📍 {formatDistance(route.distanceKm)} away
                      </p>
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
          </div>
        )}

        <div className="routes-grid">
          {filteredRoutes.length > 0 ? (
            filteredRoutes.map((route) => (
              <div 
                key={route.id} 
                className="route-card"
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
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>No routes found matching your search.</p>
            </div>
          )}
        </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#4CAF50',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 3000,
          fontSize: '14px',
          fontWeight: '600'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Modal */}
      {showModal && (selectedRoute || editingRoute) && (
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
                    style={{ backgroundColor: selectedRoute?.color || '#FF5722' }}
                  >
                    {selectedRoute?.number || 'N/A'}
                  </div>
                  <div>
                    <h2 className="modal-title">{selectedRoute?.name || 'Route'}</h2>
                    <p className="modal-subtitle">Complete Route Loop</p>
                  </div>
                </div>

                <div className="modal-info-grid">
                  <div className="info-box">
                    <h4 className="info-label">Fare</h4>
                    <p className="info-value">{selectedRoute?.fare || 'N/A'}</p>
                  </div>
                  <div className="info-box">
                    <h4 className="info-label">Operating Hours</h4>
                    <p className="info-value">{selectedRoute?.operatingHours || 'N/A'}</p>
                  </div>
                  <div className="info-box">
                    <h4 className="info-label">Frequency</h4>
                    <p className="info-value">{selectedRoute?.frequency || 'N/A'}</p>
                  </div>
                </div>

                <div className="modal-section">
                  <h3 className="section-title">Route Description</h3>
                  <p className="section-text">{selectedRoute?.description || 'No description'}</p>
                </div>

                <div className="modal-section">
                  <div className="stops-list">
                    {selectedRoute.majorStops && Array.isArray(selectedRoute.majorStops) && selectedRoute.majorStops.length > 0 ? (
                      selectedRoute.majorStops.map((stop, index) => {
                        const stopName = typeof stop === 'string' ? stop : (stop?.name || 'Unknown Stop');
                        return (
                          <div key={index} className="stop-item">
                            <div 
                              className="stop-number"
                              style={{ backgroundColor: selectedRoute?.color || '#FF5722' }}
                            >
                              {index + 1}
                            </div>
                            <span className="stop-name">{stopName}</span>
                          </div>
                        );
                      })
                    ) : (
                      <p style={{ color: '#999', fontStyle: 'italic' }}>No major stops defined</p>
                    )}
                  </div>
                </div>


              </>
            )}

            {(modalMode === 'add' || modalMode === 'edit') && editingRoute && (
              <>
                {console.log('🔍 Rendering form + map - editingRoute:', editingRoute, 'modalMode:', modalMode)}
                <div className="modal-header">
                  <h2 className="modal-title">
                    {modalMode === 'add' ? 'Add New Route' : 'Edit Route'}
                  </h2>
                </div>

                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row', minHeight: 0, gap: '0' }}>
                  {/* Form Section on Left - Fixed width with scroll */}
                  <div style={{ 
                    padding: '12px 16px', 
                    backgroundColor: '#f9f9f9', 
                    borderRight: '2px solid #ddd', 
                    overflowY: 'auto',
                    flex: '0 0 380px',
                    minHeight: 0
                  }}>
                    {modalMode === 'add' && (
                      <div style={{
                        padding: '10px 0',
                        marginBottom: '15px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 12px',
                          background: 'linear-gradient(135deg, #4FA89E 0%, #D4B896 100%)',
                          color: '#fff',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          fontSize: '13px'
                        }}>
                          Route {editingRoute.number}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label className="form-label" style={{fontSize: '12px'}}>Route Number</label>
                        <input
                          type="text"
                          value={editingRoute?.number || ''}
                          onChange={(e) => handleInputChange('number', e.target.value)}
                          className="form-input"
                          style={{fontSize: '12px'}}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{fontSize: '12px'}}>Route Color</label>
                        <input
                          type="color"
                          value={editingRoute?.color || '#FF5722'}
                          onChange={(e) => handleInputChange('color', e.target.value)}
                          className="form-input-color"
                          style={{height: '38px'}}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label className="form-label" style={{fontSize: '12px'}}>Route Name</label>
                      <input
                        type="text"
                        value={editingRoute.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="form-input"
                        style={{fontSize: '12px'}}
                      />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label className="form-label" style={{fontSize: '12px'}}>Description</label>
                      <textarea
                        value={editingRoute.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        className="form-textarea"
                        rows="1"
                        style={{fontSize: '12px'}}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label className="form-label" style={{fontSize: '12px'}}>Fare Range</label>
                        <input
                          type="text"
                          value={editingRoute.fare}
                          onChange={(e) => handleInputChange('fare', e.target.value)}
                          className="form-input"
                          style={{fontSize: '12px'}}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{fontSize: '12px'}}>Frequency</label>
                        <input
                          type="text"
                          value={editingRoute.frequency}
                          onChange={(e) => handleInputChange('frequency', e.target.value)}
                          className="form-input"
                          style={{fontSize: '12px'}}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label className="form-label" style={{fontSize: '12px'}}>Operating Hours</label>
                      <input
                        type="text"
                        value={editingRoute.operatingHours}
                        onChange={(e) => handleInputChange('operatingHours', e.target.value)}
                        className="form-input"
                        style={{fontSize: '12px'}}
                      />
                    </div>

                    {editingRoute && Array.isArray(editingRoute.majorStops) && editingRoute.majorStops.length > 0 && (
                      <div>
                        <h5 style={{ marginTop: 0, marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#333' }}>
                          Stops ({editingRoute.majorStops.length})
                        </h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '6px' }}>
                          {editingRoute.majorStops.slice(0, 8).map((stop, index) => {
                            const stopName = typeof stop === 'string' ? stop : (stop && stop.name) ? stop.name : 'Unknown';
                            return (
                              <div key={index} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 6px',
                                backgroundColor: '#e8f5e9',
                                borderRadius: '3px',
                                fontSize: '11px'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '16px',
                                  height: '16px',
                                  backgroundColor: editingRoute.color,
                                  color: '#fff',
                                  borderRadius: '50%',
                                  fontWeight: 'bold',
                                  fontSize: '9px',
                                  flexShrink: 0
                                }}>
                                  {index + 1}
                                </div>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stopName}</span>
                              </div>
                            );
                          })}
                          {editingRoute.majorStops.length > 8 && (
                            <div style={{ fontSize: '11px', color: '#666', padding: '4px 6px' }}>
                              +{editingRoute.majorStops.length - 8} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Add Point Controls - Below Form Fields */}
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #ddd' }}>
                      <label className="form-label" style={{fontSize: '12px', marginBottom: '8px'}}>Add Point</label>
                      <input
                        type="text"
                        placeholder="Stop name (e.g., Lacson & Araneta)"
                        className="form-input"
                        style={{fontSize: '12px', marginBottom: '8px'}}
                        value={addPointInput}
                        onChange={(e) => setAddPointInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddStopsFormButton();
                          }
                        }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <button 
                          onClick={handleCreatePathFormButton}
                          style={{
                          padding: '6px 8px',
                          backgroundColor: '#6b8f6f',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          Create Path
                        </button>
                        <button 
                          onClick={handleAddStopsFormButton}
                          style={{
                          padding: '6px 8px',
                          backgroundColor: '#557a6b',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          Add Stops
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Map Section on Right - Flex to fill remaining space */}
                  <div style={{ flex: '1 1 auto', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <RouteMapEditor
                      key={`${editingRoute?.id}-${modalMode}`}
                      route={editingRoute}
                      onSave={handleMapEditorSave}
                      onSaveCoordinates={handleSaveRouteCoordinates}
                      onCancel={() => setShowMapEditor(false)}
                      isNewRoute={modalMode === 'add'}
                      onEditStopName={handleEditStopName}
                      onRemoveExistingStop={handleRemoveExistingStop}
                      onEditStopLocation={handleEditStopLocationInMapEditor}
                      shouldCreatePath={shouldTriggerCreatePath}
                      onCreatePathTriggered={() => setShouldTriggerCreatePath(false)}
                    />
                  </div>
                </div>

                {editingStopLocation && (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 2000
                  }}>
                    <div style={{
                      backgroundColor: '#fff',
                      borderRadius: '8px',
                      padding: '20px',
                      width: '90%',
                      maxWidth: '600px',
                      maxHeight: '90vh',
                      overflow: 'auto'
                    }}>
                      <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>
                        Edit Location: {editingStopLocation.name}
                      </h3>
                      <div style={{ height: '400px', marginBottom: '20px', borderRadius: '6px', overflow: 'hidden' }}>
                        <LeafletMap
                          editingStopLocation={editingStopLocation}
                          onLocationSelect={(coords) => {
                            const updatedStops = [...editingRoute.majorStops];
                            updatedStops[editingStopLocation.index] = {
                              name: editingStopLocation.name,
                              lat: coords[0],
                              lng: coords[1]
                            };
                            setEditingRoute(prev => ({
                              ...prev,
                              majorStops: updatedStops
                            }));
                            setToastMessage('Location saved! ✓');
                            setHighlightedStopIndex(editingStopLocation.index);
                            setTimeout(() => setToastMessage(''), 2000);
                            setTimeout(() => setHighlightedStopIndex(null), 1500);
                            setEditingStopLocation(null);
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingStopLocation(null)}
                        style={{
                          padding: '10px 20px',
                          backgroundColor: '#999',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Form Action Buttons - positioned at bottom */}
            {(modalMode === 'add' || modalMode === 'edit') && editingRoute && (
              <div className="form-actions-bottom">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setConfirmCloseModal(true)}
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
            )}

            {/* Confirmation Dialog for Closing Modal */}
            {confirmCloseModal && (
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
                zIndex: 2000
              }}>
                <div style={{
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  padding: '2rem',
                  maxWidth: '400px',
                  width: '90%',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
                }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>Discard Changes?</h3>
                  <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280', fontSize: '14px' }}>
                    Are you sure you want to close without saving? All unsaved changes will be lost.
                  </p>
                  <div style={{
                    display: 'flex',
                    gap: '1rem',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      type="button"
                      onClick={() => setConfirmCloseModal(false)}
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
                      Keep Editing
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmCloseModal(false);
                        safeCloseModal();
                      }}
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
                      Discard Changes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default Routes;