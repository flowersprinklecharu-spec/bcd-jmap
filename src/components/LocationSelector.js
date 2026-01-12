import React, { useState, useEffect } from 'react';
import './location-selector.css';

// Location pin icon
const LocationIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path>
  </svg>
);

const LocationSelector = ({ landmarks, onLocationSelect, selectedLocation }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Get unique locations from landmarks
  const locations = landmarks.map(lm => ({
    id: lm.id,
    name: lm.name,
    category: lm.category,
    coordinates: lm.coordinates
  }));

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredLocations(locations.slice(0, 8)); // Show first 8 by default
    } else {
      const filtered = locations.filter(loc =>
        loc.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredLocations(filtered.slice(0, 8));
    }
  }, [searchTerm, locations]);

  const handleSelect = (location) => {
    setSearchTerm(location.name);
    setIsOpen(false);
    onLocationSelect(location);
  };

  return (
    <div className="location-selector">
      <label className="location-label">
        <LocationIcon /> Your Location
      </label>
      <div className="location-input-wrapper">
        <input
          type="text"
          placeholder="Select your location in Bacolod..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="location-input"
        />
        {isOpen && filteredLocations.length > 0 && (
          <div className="location-dropdown">
            {filteredLocations.map((location) => (
              <div
                key={location.id}
                className="location-option"
                onMouseDown={() => handleSelect(location)}
              >
                <div className="location-option-name">{location.name}</div>
                <div className="location-option-category">{location.category}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationSelector;
