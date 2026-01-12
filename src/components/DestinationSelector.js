import React, { useState, useEffect, useMemo } from 'react';
import './destination-selector.css';

// Destination icon
const DestinationIcon = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5z"></path>
  </svg>
);

const DestinationSelector = ({ routes, landmarks, onDestinationSelect, selectedDestination }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredDestinations, setFilteredDestinations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Extract all unique destinations from routes and landmarks
  const destinations = useMemo(() => {
    const destSet = new Set();
    const destList = [];

    // Add all major stops from routes
    routes.forEach(route => {
      if (route.majorStops && Array.isArray(route.majorStops)) {
        route.majorStops.forEach(stop => {
          const stopName = typeof stop === 'string' ? stop : (stop?.name || '');
          if (stopName && !destSet.has(stopName)) {
            destSet.add(stopName);
            destList.push({
              id: `${route.id}-${stopName}`,
              name: stopName,
              type: 'stop',
              routeName: route.name
            });
          }
        });
      }
    });

    // Add all landmarks
    landmarks.forEach(lm => {
      if (!destSet.has(lm.name)) {
        destSet.add(lm.name);
        destList.push({
          id: `landmark-${lm.id}`,
          name: lm.name,
          type: 'landmark',
          category: lm.category
        });
      }
    });

    return destList.sort((a, b) => a.name.localeCompare(b.name));
  }, [routes, landmarks]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredDestinations(destinations.slice(0, 10)); // Show first 10 by default
    } else {
      const filtered = destinations.filter(dest =>
        dest.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredDestinations(filtered.slice(0, 10));
    }
  }, [searchTerm, destinations]);

  const handleSelect = (destination) => {
    setSearchTerm(destination.name);
    setIsOpen(false);
    onDestinationSelect(destination);
    // No auto-trigger - just update the selection
    // User will click "Find Stops" button to search
  };

  return (
    <div className="destination-selector">
      <label className="destination-label">
        <DestinationIcon /> Destination
      </label>
      <div className="destination-input-wrapper">
        <input
          type="text"
          placeholder="Where do you want to go?"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="destination-input"
        />
        {isOpen && filteredDestinations.length > 0 && (
          <div className="destination-dropdown">
            {filteredDestinations.map((destination) => (
              <div
                key={destination.id}
                className="destination-option"
                onMouseDown={() => handleSelect(destination)}
              >
                <div className="destination-option-name">{destination.name}</div>
                <div className="destination-option-meta">
                  {destination.type === 'stop' ? (
                    <span className="destination-route-name">{destination.routeName}</span>
                  ) : (
                    <span className="destination-category">{destination.category}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DestinationSelector;
