import React, { useState, useCallback, useEffect } from 'react';
import Navbar from '../Navbar/Navbar';
import RouteMapEditor from '../Routes/RouteMapEditor';
import TestMap from '../Routes/TestMap';
import { saveRoute, normalizeDocData } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import './route-editor.css';

const BackIcon = React.memo(() => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path>
  </svg>
));

const RouteEditor = ({ onNavigate, routeId, isAdmin, onAdminToggle, onRequestLogin }) => {
  const [route, setRoute] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!routeId) {
      setLoading(false);
      return;
    }

    try {
      const docRef = doc(db, 'routes', String(routeId));
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = normalizeDocData(docSnap);
          setRoute(data);
        }
        setLoading(false);
      }, (err) => {
        console.error('Error loading route:', err);
        setLoading(false);
      });

      return () => unsubscribe && unsubscribe();
    } catch (err) {
      console.error('Error loading route:', err);
      setLoading(false);
    }
  }, [routeId]);

  const handleSaveStops = useCallback(async (stopsData) => {
    if (!route) return;

    try {
      setIsSaving(true);
      
      // Preserve existing majorStops and append new ones (avoid duplicates)
      const existingStops = route.majorStops || [];
      const newStopNames = stopsData.map(stop => stop.name);
      const uniqueNewStops = newStopNames.filter(name => !existingStops.includes(name));
      const mergedStops = [...existingStops, ...uniqueNewStops];
      
      // Prepare updated route
      const updatedRoute = {
        ...route,
        majorStops: mergedStops,
        stops: [...(route.stops || []), ...stopsData] // Append new stop coordinates
      };

      // Save to Firestore
      await saveRoute(updatedRoute);
      
      alert(`✅ Added ${uniqueNewStops.length} new stops to route!`);
      
      // Navigate back to routes
      onNavigate('routes');
    } catch (err) {
      console.error(err);
      alert('❌ Failed to save stops: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }, [route, onNavigate]);

  if (!route) {
    return (
      <div className="route-editor-page">
        <Navbar 
          onNavigate={onNavigate} 
          isAdmin={isAdmin}
          onAdminToggle={onAdminToggle}
          onRequestLogin={onRequestLogin}
        />
        <div className="editor-container-page">
          <p>{loading ? 'Loading route...' : 'Route not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="route-editor-page">
      <Navbar 
        onNavigate={onNavigate} 
        isAdmin={isAdmin}
        onAdminToggle={onAdminToggle}
        onRequestLogin={onRequestLogin}
      />

      <div className="editor-container-page">
        <div className="editor-header">
          <button 
            className="back-button"
            onClick={() => onNavigate('routes')}
            title="Back to routes"
          >
            <BackIcon />
            Back to Routes
          </button>
          <div className="route-title-section">
            <div 
              className="route-circle"
              style={{ backgroundColor: route.color }}
            >
              {route.number}
            </div>
            <div>
              <h1 className="editor-title">{route.name}</h1>
              <p className="editor-subtitle">Edit route stops with map</p>
            </div>
          </div>
        </div>

        <div className="editor-content">
          <RouteMapEditor
            route={route}
            onSave={handleSaveStops}
            onCancel={() => onNavigate('routes')}
          />
        </div>

        {isSaving && (
          <div className="saving-overlay">
            <div className="saving-spinner">Saving...</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteEditor;
