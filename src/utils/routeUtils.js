// Route colors and auto-numbering utilities
export const ROUTE_COLORS = [
  '#E74C3C', // 1. Red
  '#3498DB', // 2. Blue  
  '#2ECC71', // 3. Green
  '#F39C12', // 4. Orange
  '#9B59B6', // 5. Purple
  '#1ABC9C', // 6. Teal
  '#E91E63', // 7. Pink
  '#8D6E63', // 8. Brown
  '#FF5722', // 9. Deep Orange
  '#607D8B', // 10. Blue Grey
  '#795548', // 11. Brown
  '#FF9800', // 12. Amber
  '#4CAF50', // 13. Light Green
  '#00BCD4', // 14. Cyan
  '#673AB7', // 15. Deep Purple
  '#009688', // 16. Teal
  '#FFC107', // 17. Yellow
  '#8BC34A', // 18. Light Green
  '#03A9F4', // 19. Light Blue
  '#E91E63', // 20. Pink
  '#FF6B35', // 21. Orange Red
  '#6A4C93', // 22. Purple
  '#52B788', // 23. Green
  '#F72585', // 24. Magenta
];

// Get color for a route number
export const getRouteColor = (routeNumber) => {
  if (!routeNumber) return ROUTE_COLORS[0];
  const colorIndex = (routeNumber - 1) % ROUTE_COLORS.length;
  return ROUTE_COLORS[colorIndex];
};

// Get next available route number from existing routes
export const getNextRouteNumber = (existingRoutes) => {
  if (!existingRoutes || existingRoutes.length === 0) {
    return 1;
  }

  // Get all existing route numbers
  const existingNumbers = existingRoutes
    .map(route => route.number || route.routeNumber || route.id)
    .filter(num => num && !isNaN(num))
    .map(num => parseInt(num))
    .sort((a, b) => a - b);

  // Find the first gap or return next sequential number
  for (let i = 1; i <= existingNumbers.length + 1; i++) {
    if (!existingNumbers.includes(i)) {
      return i;
    }
  }

  return existingNumbers.length + 1;
};

// Get route display info (number and color)
export const getRouteDisplayInfo = (routeNumber) => {
  return {
    number: routeNumber,
    color: getRouteColor(routeNumber),
    displayName: `Route ${routeNumber}`
  };
};