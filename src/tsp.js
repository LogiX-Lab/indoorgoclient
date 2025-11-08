// Simple TSP solver using nearest neighbor heuristic
export function solveTSP(points, options = {}) {
  const { floorPenalty = 0.02, returnToStart = false } = options;
  
  if (points.length <= 1) {
    return { orderedIdx: [0], length: 0 };
  }
  
  // Calculate distance between two points
  function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const floorDiff = Math.abs((p1.floor || 0) - (p2.floor || 0));
    return Math.sqrt(dx * dx + dy * dy) + floorDiff * floorPenalty;
  }
  
  // Nearest neighbor algorithm
  const visited = new Set();
  const path = [0]; // Start with first point
  visited.add(0);
  let totalLength = 0;
  
  let current = 0;
  while (visited.size < points.length) {
    let nearest = -1;
    let minDist = Infinity;
    
    for (let i = 0; i < points.length; i++) {
      if (!visited.has(i)) {
        const dist = distance(points[current], points[i]);
        if (dist < minDist) {
          minDist = dist;
          nearest = i;
        }
      }
    }
    
    if (nearest !== -1) {
      path.push(nearest);
      visited.add(nearest);
      totalLength += minDist;
      current = nearest;
    }
  }
  
  // Optionally return to start
  if (returnToStart && path.length > 1) {
    totalLength += distance(points[current], points[0]);
  }
  
  return {
    orderedIdx: path,
    length: totalLength
  };
}