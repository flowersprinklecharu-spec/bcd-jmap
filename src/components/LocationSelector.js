import React, { useState, useEffect, useMemo } from 'react';
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
  const [searchTerm, setSearchTerm] = useState(selectedLocation ? selectedLocation.name : '');

  // Get unique locations from landmarks (memoized)
  const locations = useMemo(() => landmarks.map(lm => ({
    id: lm.id,
    name: lm.name,
    category: lm.category,
    coordinates: lm.coordinates
  })), [landmarks]);

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

  // Only update searchTerm if selectedLocation changes and is different from the current searchTerm (prevents infinite loop)
  // Deep equality check for selectedLocation
  // Robust deep equality check using JSON.stringify
  function isSameLocation(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  useEffect(() => {
    // Debug log to see what triggers the effect
    console.log('[LocationSelector] useEffect triggered:', {
      selectedLocation,
      searchTerm,
      selectedLocationString: JSON.stringify(selectedLocation),
      searchTermString: JSON.stringify({ name: searchTerm })
    });
    // TEMP: Disable setSearchTerm to break the loop and observe logs
    // if (
    //   selectedLocation &&
    //   typeof selectedLocation.name === 'string' &&
    //   selectedLocation.name.length > 0 &&
    //   !isSameLocation(selectedLocation, { name: searchTerm })
    // ) {
    //   console.log('[LocationSelector] setSearchTerm called:', selectedLocation.name);
    //   setSearchTerm(selectedLocation.name);
    // }
    // Do NOT update searchTerm if selectedLocation is null or matches current searchTerm
    // This prevents an infinite update loop
  }, [selectedLocation]);

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
        {searchTerm && (
          <button
            type="button"
            className="clear-input-btn"
            aria-label="Clear location input"
            onClick={() => {
              setSearchTerm('');
              onLocationSelect(null);
            }}
          >
            ×
          </button>
        )}
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
