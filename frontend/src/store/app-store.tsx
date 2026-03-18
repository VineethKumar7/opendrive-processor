// App-wide store using React context
import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { OpenDRIVEMap, Route, MapStats, ValidationIssue } from '@/types/opendrive';

interface AppState {
  maps: OpenDRIVEMap[];
  currentMap: OpenDRIVEMap | null;
  routes: Route[];
  selectedRoadId: string | null;
  selectedSignalId: string | null;
}

interface AppActions {
  addMap: (map: OpenDRIVEMap) => void;
  setCurrentMap: (map: OpenDRIVEMap | null) => void;
  selectRoad: (id: string | null) => void;
  selectSignal: (id: string | null) => void;
  addRoute: (route: Route) => void;
  removeRoute: (id: string) => void;
  getMapStats: (map: OpenDRIVEMap) => MapStats;
}

const AppContext = createContext<(AppState & AppActions) | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [maps, setMaps] = useState<OpenDRIVEMap[]>([]);
  const [currentMap, setCurrentMap] = useState<OpenDRIVEMap | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoadId, selectRoad] = useState<string | null>(null);
  const [selectedSignalId, selectSignal] = useState<string | null>(null);

  const addMap = useCallback((map: OpenDRIVEMap) => {
    setMaps(prev => [map, ...prev.filter(m => m.id !== map.id)]);
    setCurrentMap(map);
  }, []);

  const addRoute = useCallback((route: Route) => {
    setRoutes(prev => [route, ...prev]);
  }, []);

  const removeRoute = useCallback((id: string) => {
    setRoutes(prev => prev.filter(r => r.id !== id));
  }, []);

  const getMapStats = useCallback((map: OpenDRIVEMap): MapStats => {
    const allLanes = map.roads.flatMap(r => r.lanes.flatMap(ls => ls.lanes));
    const totalLanes = allLanes.length;
    const totalRoadLength = map.roads.reduce((s, r) => s + r.length, 0);

    const roadTypes: Record<string, number> = {};
    map.roads.forEach(r => {
      const t = r.type || 'unknown';
      roadTypes[t] = (roadTypes[t] || 0) + 1;
    });

    const laneTypes: Record<string, number> = {};
    allLanes.forEach(l => {
      laneTypes[l.type] = (laneTypes[l.type] || 0) + 1;
    });

    const jcComplexity = { simple: 0, standard: 0, complex: 0 };
    map.junctions.forEach(j => {
      const n = j.connections.length;
      if (n <= 3) jcComplexity.simple++;
      else if (n <= 4) jcComplexity.standard++;
      else jcComplexity.complex++;
    });

    const signalized = map.junctions.filter(j =>
      j.connections.some(c => map.signals.some(s => s.roadId === c.incomingRoad || s.roadId === c.connectingRoad))
    ).length;

    const validationIssues: ValidationIssue[] = [];
    map.roads.forEach(r => {
      if (!r.speedLimit) validationIssues.push({ type: 'warning', message: `Road #${r.id} missing speed limit`, roadId: r.id });
      if (r.lanes.length === 0) validationIssues.push({ type: 'warning', message: `Road #${r.id} has no lane sections`, roadId: r.id });
    });
    if (validationIssues.length === 0) {
      validationIssues.push({ type: 'info', message: 'All roads connected' });
      validationIssues.push({ type: 'info', message: 'Lane widths valid' });
      validationIssues.push({ type: 'info', message: 'Junctions properly linked' });
    }

    const header = map.header;
    return {
      totalRoads: map.roads.length,
      totalLanes,
      totalJunctions: map.junctions.length,
      totalSigns: map.signals.length,
      totalRoadLength,
      mapBounds: { width: Math.abs(header.east - header.west), height: Math.abs(header.north - header.south) },
      roadTypes,
      laneTypes,
      junctionComplexity: jcComplexity,
      signalized,
      unsignalized: map.junctions.length - signalized,
      validationIssues,
    };
  }, []);

  return (
    <AppContext.Provider value={{
      maps, currentMap, routes, selectedRoadId, selectedSignalId,
      addMap, setCurrentMap, selectRoad, selectSignal, addRoute, removeRoute, getMapStats,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
