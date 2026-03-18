// OpenDRIVE data types

export interface OpenDRIVEMap {
  id: string;
  name: string;
  roads: Road[];
  junctions: Junction[];
  signals: Signal[];
  header: MapHeader;
  loadedAt: Date;
}

export interface MapHeader {
  revMajor: number;
  revMinor: number;
  name: string;
  date: string;
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface Road {
  id: string;
  name: string;
  length: number;
  junctionId: string;
  type: string;
  geometry: RoadGeometry[];
  lanes: LaneSection[];
  speedLimit: number | null;
  predecessorId: string | null;
  successorId: string | null;
}

export interface RoadGeometry {
  s: number;
  x: number;
  y: number;
  hdg: number;
  length: number;
  type: 'line' | 'arc' | 'spiral' | 'poly3' | 'paramPoly3';
  curvature?: number;
}

export interface LaneSection {
  s: number;
  lanes: Lane[];
}

export interface Lane {
  id: number;
  type: string;
  width: number;
  direction: 'forward' | 'backward';
}

export interface Junction {
  id: string;
  name: string;
  connections: JunctionConnection[];
  position?: { x: number; y: number };
}

export interface JunctionConnection {
  id: string;
  incomingRoad: string;
  connectingRoad: string;
  contactPoint: string;
}

export interface Signal {
  id: string;
  name: string;
  type: string;
  subtype: string;
  roadId: string;
  s: number;
  t: number;
  value: number;
  text: string;
  position?: { x: number; y: number };
}

export interface Route {
  id: string;
  name: string;
  mapId: string;
  waypoints: Waypoint[];
  totalDistance: number;
  estimatedTime: number;
  roadsUsed: string[];
  createdAt: Date;
}

export interface Waypoint {
  id: string;
  type: 'start' | 'waypoint' | 'end';
  roadId: string;
  s: number;
  position: { x: number; y: number };
}

export interface MapStats {
  totalRoads: number;
  totalLanes: number;
  totalJunctions: number;
  totalSigns: number;
  totalRoadLength: number;
  mapBounds: { width: number; height: number };
  roadTypes: Record<string, number>;
  laneTypes: Record<string, number>;
  junctionComplexity: { simple: number; standard: number; complex: number };
  signalized: number;
  unsignalized: number;
  validationIssues: ValidationIssue[];
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  roadId?: string;
}
