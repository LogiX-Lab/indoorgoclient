// Simple TSP solver for client-side route computation
export function solveTSP(points, options = {}) {
  const { floorPenalty = 0.02, returnToStart = true } = options;
  
  if (points.length <= 1) {
    return { orderedIdx: [0], length: 0 };
  }
  
  // Calculate distance matrix
  const n = points.length;
  const dist = Array(n).fill().map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const floorDiff = Math.abs((points[i].floor || 0) - (points[j].floor || 0));
        dist[i][j] = Math.sqrt(dx * dx + dy * dy) + floorDiff * floorPenalty;
      }
    }
  }
  
  // Simple nearest neighbor heuristic for small sets
  if (n <= 10) {
    return nearestNeighbor(dist, returnToStart);
  }
  
  // For larger sets, use 2-opt improvement
  let best = nearestNeighbor(dist, returnToStart);
  return twoOpt(dist, best.orderedIdx, returnToStart);
}

function nearestNeighbor(dist, returnToStart) {
  const n = dist.length;
  const visited = new Array(n).fill(false);
  const tour = [0];
  visited[0] = true;
  let totalLength = 0;
  
  let current = 0;
  for (let i = 1; i < n; i++) {
    let nearest = -1;
    let nearestDist = Infinity;
    
    for (let j = 0; j < n; j++) {
      if (!visited[j] && dist[current][j] < nearestDist) {
        nearest = j;
        nearestDist = dist[current][j];
      }
    }
    
    tour.push(nearest);
    visited[nearest] = true;
    totalLength += nearestDist;
    current = nearest;
  }
  
  if (returnToStart) {
    totalLength += dist[current][0];
  }
  
  return { orderedIdx: tour, length: totalLength };
}

function twoOpt(dist, tour, returnToStart) {
  const n = tour.length;
  let improved = true;
  let bestTour = [...tour];
  let bestLength = calculateTourLength(dist, bestTour, returnToStart);
  
  while (improved) {
    improved = false;
    
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const newTour = [...bestTour];
        // Reverse the segment between i and j
        for (let k = 0; k <= j - i; k++) {
          newTour[i + k] = bestTour[j - k];
        }
        
        const newLength = calculateTourLength(dist, newTour, returnToStart);
        if (newLength < bestLength) {
          bestTour = newTour;
          bestLength = newLength;
          improved = true;
        }
      }
    }
  }
  
  return { orderedIdx: bestTour, length: bestLength };
}

function calculateTourLength(dist, tour, returnToStart) {
  let length = 0;
  for (let i = 0; i < tour.length - 1; i++) {
    length += dist[tour[i]][tour[i + 1]];
  }
  if (returnToStart) {
    length += dist[tour[tour.length - 1]][tour[0]];
  }
  return length;
}