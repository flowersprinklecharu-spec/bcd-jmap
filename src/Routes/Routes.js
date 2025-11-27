import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from '../Navbar/Navbar';
import RouteMapEditor from './RouteMapEditor';
import { saveRoute, deleteRoute, normalizeDocData } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
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

// Initial routes data - All 24 LPTRP Routes in order
const initialRoutesData = [
  {
    id: 1,
    number: '1',
    name: 'Banago-Libertad Loop',
    description: 'Travels from Banago to Libertad via downtown Bacolod, passing through major landmarks including Bacolod Public Plaza and SM City.',
    fare: '₱11.00 - ₱15.00',
    color: '#FF5722',
    operatingHours: '5:00 AM - 9:00 PM',
    frequency: 'Every 5-10 mins',
    majorStops: [
      'Banago Elem. School',
      'Pure Banago',
      'Bacolod North Terminal',
      'Burgos St.',
      'Bacolod Public Plaza',
      'SM City Bacolod',
      'Lacson St.',
      'Libertad Terminal'
    ]
  },
  {
    id: 2,
    number: '2',
    name: 'Bata-Libertad Loop',
    description: 'Connects Bata area to Libertad, passing through Lacson Street and downtown Bacolod.',
    fare: '₱11.00 - ₱15.00',
    color: '#2196F3',
    operatingHours: '5:00 AM - 9:00 PM',
    frequency: 'Every 5-10 mins',
    majorStops: [
      'Bata',
      'Marapara Heights',
      'Bacolod Queen of Mercy',
      'Lacson St.',
      'City Plaza',
      'Libertad Terminal'
    ]
  },
  {
    id: 3,
    number: '3',
    name: 'Northbound Terminal-Libertad Loop',
    description: 'Links the Northbound Terminal to Libertad area via city center.',
    fare: '₱11.00 - ₱15.00',
    color: '#4CAF50',
    operatingHours: '5:30 AM - 8:30 PM',
    frequency: 'Every 10-15 mins',
    majorStops: [
      'Northbound Terminal',
      'Araneta St.',
      'City Hall',
      'Lacson St.',
      'Public Plaza',
      'Libertad Terminal'
    ]
  },
  {
    id: 4,
    number: '4',
    name: 'Pepsi-Bata-Bacolod Government Center Loop',
    description: 'Connects Pepsi area to Bata and Bacolod Government Center via downtown.',
    fare: '₱11.00 - ₱15.00',
    color: '#E91E63',
    operatingHours: '5:00 AM - 9:00 PM',
    frequency: 'Every 8-12 mins',
    majorStops: [
      'Pepsi Terminal',
      'Mandalagan',
      'Government Center',
      'City Plaza',
      'Bata Terminal'
    ]
  },
  {
    id: 5,
    number: '5',
    name: 'Shopping-Northbound Terminal Loop',
    description: 'Links Shopping area to the Northbound Terminal via major commercial districts.',
    fare: '₱11.00 - ₱15.00',
    color: '#FFEB3B',
    operatingHours: '5:00 AM - 9:00 PM',
    frequency: 'Every 7-10 mins',
    majorStops: [
      'Shopping Area',
      'SM City',
      'Robinsons Place',
      'City Plaza',
      'Northbound Terminal'
    ]
  },
  {
    id: 6,
    number: '6',
    name: 'Shopping-Libertad Via La Salle Loop',
    description: 'Connects Shopping area to Libertad passing through La Salle University.',
    fare: '₱11.00 - ₱15.00',
    color: '#00BCD4',
    operatingHours: '5:00 AM - 9:00 PM',
    frequency: 'Every 5-8 mins',
    majorStops: [
      'Shopping Area',
      'La Salle University',
      "Doctor's Hospital",
      'Lacson St.',
      'City Center',
      'Libertad Terminal'
    ]
  },
  {
    id: 7,
    number: '7',
    name: 'Shopping-Libertad Via San Agustin Loop',
    description: 'Routes from Shopping to Libertad via San Agustin area.',
    fare: '₱11.00 - ₱15.00',
    color: '#673AB7',
    operatingHours: '5:00 AM - 9:00 PM',
    frequency: 'Every 8-12 mins',
    majorStops: [
      'Shopping Area',
      'San Agustin',
      'Mayfair Plaza',
      'City Plaza',
      'Libertad Terminal'
    ]
  },
  {
    id: 8,
    number: '8',
    name: 'Eroreco-Central Market Loop',
    description: 'Connects Eroreco subdivision to Central Market area.',
    fare: '₱11.00 - ₱15.00',
    color: '#FF9800',
    operatingHours: '5:30 AM - 8:30 PM',
    frequency: 'Every 10-15 mins',
    majorStops: [
      'Eroreco Subd.',
      'Valley of Peace',
      'Triangle Island Plaza',
      'Central Market',
      'City Plaza'
    ]
  },
  {
    id: 9,
    number: '9',
    name: 'Punta Taytay-Fr. Ferrero St. Loop',
    description: 'Services Punta Taytay area to downtown via Fr. Ferrero Street.',
    fare: '₱11.00 - ₱15.00',
    color: '#F44336',
    operatingHours: '5:00 AM - 9:00 PM',
    frequency: 'Every 12-15 mins',
    majorStops: [
      'Punta Taytay',
      'Banaga Tomaro',
      'Burgos St.',
      'Central Market',
      'City Plaza'
    ]
  },
  {
    id: 10,
    number: '10',
    name: 'Tangub-South Capitol Rd Loop',
    description: 'Connects Tangub to downtown via South Capitol Road.',
    fare: '₱11.00 - ₱15.00',
    color: '#8BC34A',
    operatingHours: '5:30 AM - 8:30 PM',
    frequency: 'Every 10-12 mins',
    majorStops: [
      'Tangub',
      'South Capitol',
      'Ayala Mall Capitol Central',
      'Central Market',
      'City Plaza'
    ]
  },
  {
    id: 11,
    number: '11',
    name: 'Airport Subd-South Capitol Rd Loop',
    description: 'Services Airport Subdivision to South Capitol Road area.',
    fare: '₱11.00 - ₱15.00',
    color: '#9C27B0',
    operatingHours: '5:30 AM - 8:30 PM',
    frequency: 'Every 15-20 mins',
    majorStops: [
      'Airport Subd.',
      'South Capitol',
      'Central Market',
      'City Plaza'
    ]
  },
  {
    id: 12,
    number: '12',
    name: 'Taculing-Central Market Loop',
    description: 'Connects Taculing area to Central Market and downtown.',
    fare: '₱11.00 - ₱15.00',
    color: '#795548',
    operatingHours: '5:00 AM - 9:00 PM',
    frequency: 'Every 10-12 mins',
    majorStops: [
      'Taculing',
      'BBB Checkpoint',
      'BREDCO Port',
      'Central Market',
      'City Plaza'
    ]
  },
  {
    id: 13,
    number: '13',
    name: 'Alijis (RPHS)-Central Market Loop',
    description: 'Services Alijis area including RPHS to Central Market.',
    fare: '₱11.00 - ₱15.00',
    color: '#00BCD4',
    operatingHours: '5:00 AM - 9:00 PM',
    frequency: 'Every 12-15 mins',
    majorStops: [
      'Alijis RPHS',
      'Banago',
      'Central Market',
      'City Plaza'
    ]
  },
  {
    id: 14,
    number: '14',
    name: 'Handumanan-Libertad Via Mansilingan Loop',
    description: 'Connects Handumanan to Libertad via Mansilingan area.',
    fare: '₱11.00 - ₱15.00',
    color: '#4CAF50',
    operatingHours: '5:30 AM - 8:30 PM',
    frequency: 'Every 15-20 mins',
    majorStops: [
      'Handumanan',
      'Mansilingan',
      'Central Market',
      'City Plaza',
      'Libertad Terminal'
    ]
  },
  {
    id: 15,
    number: '15',
    name: 'Paglaum Village-Libertad Loop',
    description: 'Services Paglaum Village area to Libertad downtown.',
    fare: '₱11.00 - ₱15.00',
    color: '#E91E63',
    operatingHours: '5:30 AM - 8:30 PM',
    frequency: 'Every 15-20 mins',
    majorStops: [
      'Paglaum Village',
      'Don Antonio Jayme ES',
      'Vista Alegre',
      'Central Market',
      'Libertad Terminal'
    ]
  },
  {
    id: 16,
    number: '16',
    name: 'Mansilingan-Central Market Via City Heights Loop',
    description: 'Connects Mansilingan to Central Market via City Heights.',
    fare: '₱11.00 - ₱15.00',
    color: '#9E9E9E',
    operatingHours: '5:00 AM - 9:00 PM',
    frequency: 'Every 10-12 mins',
    majorStops: [
      'Mansilingan',
      'City Heights',
      'Central Market',
      'City Plaza'
    ]
  },
  {
    id: 17,
    number: '17',
    name: 'Fortune Town/Estefania-Central Market Loop',
    description: 'Services Fortune Town and Estefania to Central Market.',
    fare: '₱11.00 - ₱15.00',
    color: '#FFC107',
    operatingHours: '5:00 AM - 9:00 PM',
    frequency: 'Every 12-15 mins',
    majorStops: [
      'Fortune Town',
      'Estefania',
      'Central Market',
      'City Plaza'
    ]
  },
  {
    id: 18,
    number: '18',
    name: 'Granada-Burgos',
    description: 'Connects Granada area to Burgos Street downtown.',
    fare: '₱11.00 - ₱15.00',
    color: '#FF5722',
    operatingHours: '5:30 AM - 8:30 PM',
    frequency: 'Every 15-20 mins',
    majorStops: [
      'Granada',
      'SM Bacolod South Wing',
      'Central Market',
      'Burgos St.'
    ]
  },
  {
    id: 19,
    number: '19',
    name: 'Alangilan-Burgos',
    description: 'Services Alangilan area to Burgos Street.',
    fare: '₱11.00 - ₱15.00',
    color: '#9C27B0',
    operatingHours: '5:30 AM - 8:30 PM',
    frequency: 'Every 15-20 mins',
    majorStops: [
      'Alangilan',
      "Yulo's Park",
      'Central Market',
      'Burgos St.'
    ]
  },
  {
    id: 20,
    number: '20',
    name: 'San Dionisio-Market Loop',
    description: 'Connects San Dionisio to Market area.',
    fare: '₱11.00 - ₱15.00',
    color: '#00BCD4',
    operatingHours: '5:00 AM - 9:00 PM',
    frequency: 'Every 15-20 mins',
    majorStops: [
      'San Dionisio',
      'Bacolod South Terminal',
      'Public Market',
      'Central Market'
    ]
  },
  {
    id: 21,
    number: '21',
    name: 'PHHC (Homesite)-Central Market Loop',
    description: 'Services PHHC Homesite to Central Market.',
    fare: '₱11.00 - ₱15.00',
    color: '#3F51B5',
    operatingHours: '5:30 AM - 8:30 PM',
    frequency: 'Every 15-20 mins',
    majorStops: [
      'PHHC Homesite',
      'Montevista/Homesite PHHC',
      'Public Market',
      'Central Market'
    ]
  },
  {
    id: 22,
    number: '22',
    name: 'Doña Juliana-Central Market Loop',
    description: 'Connects Doña Juliana area to Central Market.',
    fare: '₱11.00 - ₱15.00',
    color: '#FFC107',
    operatingHours: '5:00 AM - 9:00 PM',
    frequency: 'Every 15-20 mins',
    majorStops: [
      'Doña Juliana',
      'Upper East',
      'Gonzaga Street',
      'Central Market'
    ]
  },
  {
    id: 23,
    number: '23',
    name: 'Bredco Port-Northbound Terminal Via San Juan Loop',
    description: 'Connects Bredco Port to Northbound Terminal via San Juan.',
    fare: '₱11.00 - ₱15.00',
    color: '#00BCD4',
    operatingHours: '5:00 AM - 9:00 PM',
    frequency: 'Every 12-15 mins',
    majorStops: [
      'BREDCO Port',
      'Baliwag City Bacolod',
      'San Juan',
      'Central Market',
      'Northbound Terminal'
    ]
  },
  {
    id: 24,
    number: '24',
    name: 'Pahanocoy (CEGASCO)-BGC Via Circumferential Rd. Loop',
    description: 'Services Pahanocoy CEGASCO to BGC via Circumferential Road.',
    fare: '₱11.00 - ₱15.00',
    color: '#E91E63',
    operatingHours: '5:30 AM - 8:30 PM',
    frequency: 'Every 20-25 mins',
    majorStops: [
      'Pahanocoy CEGASCO',
      'Banago (Mandalagan)',
      'Circumferential Road',
      'BGC',
      'Central Market'
    ]
  }
];

const Routes = ({ onNavigate, isAdmin: initialIsAdmin, onAdminToggle, onRequestLogin }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin || false);
  const [routes, setRoutes] = useState(initialRoutesData);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('view');
  const [editingRoute, setEditingRoute] = useState(null);
  const [showMapEditor, setShowMapEditor] = useState(false);

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
    } else if (mode === 'add') {
      setEditingRoute({
        id: Date.now(),
        number: '',
        name: '',
        description: '',
        fare: '₱11.00 - ₱15.00',
        color: '#FF5722',
        operatingHours: '5:00 AM - 9:00 PM',
        frequency: 'Every 5-10 mins',
        majorStops: ['']
      });
    }
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setSelectedRoute(null);
    setEditingRoute(null);
    setModalMode('view');
  }, []);

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
      closeModal();
    } catch (err) {
      console.error(err);
      alert('❌ Failed to save route: ' + err.message);
    }
  }, [modalMode, editingRoute, closeModal]);

  useEffect(() => {
    try {
      const col = collection(db, 'routes');
      const q = query(col);
      const unsub = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => normalizeDocData(doc));
        setRoutes(sortRoutesByNumber(data));
      }, (err) => {
        console.error('Routes listener error', err);
      });

      return () => unsub && unsub();
    } catch (err) {
      console.warn('Firestore not available for routes', err);
    }
  }, []);

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
      <Navbar 
        isAdmin={isAdmin} 
        onAdminToggle={onAdminToggle || (() => setIsAdmin(!isAdmin))}
        onNavigate={onNavigate}
        onRequestLogin={onRequestLogin}
        currentPage="routes"
      />

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

        <div className="routes-grid">
          {filteredRoutes.map((route) => (
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
        <div className={`modal-overlay ${showMapEditor ? 'map-editor-active' : ''}`} onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
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
                <div className="modal-header">
                  <h2 className="modal-title">
                    {modalMode === 'add' ? 'Add New Route' : 'Edit Route'}
                  </h2>
                </div>

                <div className="edit-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Route Number</label>
                      <input
                        type="text"
                        value={editingRoute.number}
                        onChange={(e) => handleInputChange('number', e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Route Color</label>
                      <input
                        type="color"
                        value={editingRoute.color}
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
                    
                    {showMapEditor ? (
                      <div className="map-editor-container">
                        <RouteMapEditor
                          route={editingRoute}
                          onSave={handleMapEditorSave}
                          onCancel={() => setShowMapEditor(false)}
                        />
                      </div>
                    ) : (
                      <>
                        {editingRoute.majorStops.map((stop, index) => (
                          <div key={index} className="stop-input-group">
                            <input
                              type="text"
                              value={stop}
                              onChange={(e) => handleStopChange(index, e.target.value)}
                              className="form-input"
                              placeholder={`Stop ${index + 1}`}
                            />
                            {editingRoute.majorStops.length > 1 && (
                              <button
                                type="button"
                                className="remove-stop-btn"
                                onClick={() => removeStop(index)}
                              >
                                <DeleteIcon />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          className="add-stop-btn"
                          onClick={addStop}
                        >
                          <AddIcon />
                          Add Stop
                        </button>
                      </>
                    )}
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={closeModal}
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