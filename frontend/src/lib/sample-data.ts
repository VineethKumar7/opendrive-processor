// Sample OpenDRIVE data for demo purposes
import type { OpenDRIVEMap } from '@/types/opendrive';

export function generateSampleMap(): OpenDRIVEMap {
  const roads = [];
  const junctions = [];
  const signals = [];

  // Create a grid-like road network
  const gridSize = 4;
  const spacing = 200;
  let roadId = 1;
  let junctionId = 1;
  let signalId = 1;

  // Horizontal roads
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize - 1; col++) {
      const x = col * spacing;
      const y = row * spacing;
      roads.push({
        id: String(roadId),
        name: `Horizontal Road ${roadId}`,
        length: spacing,
        junctionId: '-1',
        type: row === 0 || row === gridSize - 1 ? 'motorway' : 'town',
        geometry: [{ s: 0, x, y, hdg: 0, length: spacing, type: 'line' as const }],
        lanes: [{
          s: 0,
          lanes: [
            { id: -1, type: 'driving', width: 3.5, direction: 'forward' as const },
            { id: -2, type: 'driving', width: 3.5, direction: 'forward' as const },
            { id: 1, type: 'driving', width: 3.5, direction: 'backward' as const },
            { id: 2, type: 'driving', width: 3.5, direction: 'backward' as const },
          ]
        }],
        speedLimit: row === 0 || row === gridSize - 1 ? 80 : 50,
        predecessorId: col > 0 ? String(roadId - 1) : null,
        successorId: col < gridSize - 2 ? String(roadId + 1) : null,
      });
      roadId++;
    }
  }

  // Vertical roads
  for (let col = 0; col < gridSize; col++) {
    for (let row = 0; row < gridSize - 1; row++) {
      const x = col * spacing;
      const y = row * spacing;
      roads.push({
        id: String(roadId),
        name: `Vertical Road ${roadId}`,
        length: spacing,
        junctionId: '-1',
        type: 'town',
        geometry: [{ s: 0, x, y, hdg: Math.PI / 2, length: spacing, type: 'line' as const }],
        lanes: [{
          s: 0,
          lanes: [
            { id: -1, type: 'driving', width: 3.5, direction: 'forward' as const },
            { id: 1, type: 'driving', width: 3.5, direction: 'backward' as const },
          ]
        }],
        speedLimit: 50,
        predecessorId: null,
        successorId: null,
      });
      roadId++;
    }
  }

  // Add some curved roads
  const curveRoads = [
    { x: 100, y: -100, hdg: -0.3, length: 150, curvature: 0.01 },
    { x: 500, y: 100, hdg: 0.5, length: 180, curvature: -0.008 },
    { x: -50, y: 300, hdg: 0.8, length: 120, curvature: 0.015 },
  ];
  curveRoads.forEach(cr => {
    roads.push({
      id: String(roadId),
      name: `Curved Road ${roadId}`,
      length: cr.length,
      junctionId: '-1',
      type: 'town',
      geometry: [{ s: 0, x: cr.x, y: cr.y, hdg: cr.hdg, length: cr.length, type: 'arc' as const, curvature: cr.curvature }],
      lanes: [{
        s: 0,
        lanes: [
          { id: -1, type: 'driving', width: 3.5, direction: 'forward' as const },
          { id: 1, type: 'driving', width: 3.5, direction: 'backward' as const },
        ]
      }],
      speedLimit: 30,
      predecessorId: null,
      successorId: null,
    });
    roadId++;
  });

  // Junctions at intersections
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if ((row > 0 || col > 0) && (row < gridSize - 1 || col < gridSize - 1)) {
        junctions.push({
          id: String(junctionId),
          name: `Junction ${junctionId}`,
          connections: [
            { id: '1', incomingRoad: String(Math.max(1, junctionId)), connectingRoad: String(Math.min(roadId - 1, junctionId + 1)), contactPoint: 'start' },
            { id: '2', incomingRoad: String(Math.min(roadId - 1, junctionId + 2)), connectingRoad: String(Math.max(1, junctionId - 1)), contactPoint: 'end' },
          ],
          position: { x: col * spacing, y: row * spacing },
        });
        junctionId++;
      }
    }
  }

  // Signals
  const signalTypes = [
    { type: '206', subtype: '', name: 'STOP Sign' },
    { type: '1000001', subtype: '', name: 'Traffic Light' },
    { type: '205', subtype: '', name: 'Yield Sign' },
    { type: '274', subtype: '50', name: 'Speed Limit 50' },
    { type: '274', subtype: '80', name: 'Speed Limit 80' },
    { type: '350', subtype: '', name: 'Pedestrian Crossing' },
    { type: '267', subtype: '', name: 'No Entry' },
    { type: '1000002', subtype: '', name: 'Traffic Light' },
  ];

  signalTypes.forEach((st, i) => {
    const road = roads[i % roads.length];
    const geom = road.geometry[0];
    const s = road.length * 0.3 + i * 10;
    signals.push({
      id: String(signalId),
      name: st.name,
      type: st.type,
      subtype: st.subtype,
      roadId: road.id,
      s: Math.min(s, road.length),
      t: 2,
      value: st.subtype ? parseInt(st.subtype) : 0,
      text: st.name,
      position: {
        x: geom.x + Math.cos(geom.hdg) * Math.min(s, road.length),
        y: geom.y + Math.sin(geom.hdg) * Math.min(s, road.length),
      },
    });
    signalId++;
  });

  return {
    id: 'sample-town01',
    name: 'Town01',
    roads,
    junctions,
    signals,
    header: {
      revMajor: 1,
      revMinor: 6,
      name: 'Town01',
      date: new Date().toISOString().split('T')[0],
      north: gridSize * spacing,
      south: -100,
      east: gridSize * spacing + 200,
      west: -100,
    },
    loadedAt: new Date(),
  };
}
