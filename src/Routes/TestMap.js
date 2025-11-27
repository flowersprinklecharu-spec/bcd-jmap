import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const TestMap = () => {
  return (
    <div style={{ height: '400px', width: '100%', border: '2px solid red' }}>
      <MapContainer 
        center={[10.6750, 122.9600]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
      </MapContainer>
    </div>
  );
};

export default TestMap;