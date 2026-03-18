import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { OpenDRIVEMap, Road, Signal, Route } from '@/types/opendrive';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ============ Types ============

interface MapInfo {
  id: string;
  name: string;
  version: string;
  date: string;
  road_count: number;
  junction_count: number;
  total_length: number;
  total_lanes: number;
  total_signals: number;
  filepath: string;
}

interface RoadInfo {
  id: string;
  name: string;
  length: number;
  junction_id: string | null;
  geometry_points: Array<{ x: number; y: number; z: number }>;
  lane_sections: Array<{
    s: number;
    left_lanes: Array<{ id: number; type: string }>;
    right_lanes: Array<{ id: number; type: string }>;
  }>;
  signals: Array<{
    id: string;
    s: number;
    t: number;
    name: string;
    type: string;
    value: number;
  }>;
}

interface SignalInfo {
  id: string;
  road_id: string;
  s: number;
  t: number;
  x: number;
  y: number;
  name: string;
  type: string;
  subtype?: string;
  value: number;
  dynamic?: boolean;
}

interface RouteRequest {
  map_id: string;
  start_x: number;
  start_y: number;
  goal_x: number;
  goal_y: number;
  prefer_highways?: boolean;
  avoid_u_turns?: boolean;
}

interface RouteResponse {
  valid: boolean;
  waypoints: Array<{ x: number; y: number; z: number }>;
  road_ids: string[];
  total_length: number;
  estimated_time: number;
  error_message?: string;
}

// ============ API Functions ============

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============ Query Hooks ============

/**
 * Fetch API status
 */
export function useApiStatus() {
  return useQuery({
    queryKey: ['api-status'],
    queryFn: () => fetchApi<{ name: string; version: string; native_library: boolean }>('/'),
    staleTime: 60000,
  });
}

/**
 * List all available maps
 */
export function useMaps() {
  return useQuery({
    queryKey: ['maps'],
    queryFn: () => fetchApi<MapInfo[]>('/maps'),
  });
}

/**
 * Get specific map info
 */
export function useMap(mapId: string | null) {
  return useQuery({
    queryKey: ['map', mapId],
    queryFn: () => fetchApi<MapInfo>(`/maps/${mapId}`),
    enabled: !!mapId,
  });
}

/**
 * Get roads with geometry for a map
 */
export function useRoads(mapId: string | null, resolution = 5) {
  return useQuery({
    queryKey: ['roads', mapId, resolution],
    queryFn: () => fetchApi<RoadInfo[]>(`/maps/${mapId}/roads?resolution=${resolution}`),
    enabled: !!mapId,
    staleTime: 300000, // Cache for 5 minutes
  });
}

/**
 * Get signals for a map
 */
export function useSignals(mapId: string | null) {
  return useQuery({
    queryKey: ['signals', mapId],
    queryFn: () => fetchApi<SignalInfo[]>(`/maps/${mapId}/signals`),
    enabled: !!mapId,
  });
}

/**
 * Get junctions for a map
 */
export function useJunctions(mapId: string | null) {
  return useQuery({
    queryKey: ['junctions', mapId],
    queryFn: () => fetchApi<any[]>(`/maps/${mapId}/junctions`),
    enabled: !!mapId,
  });
}

// ============ Mutation Hooks ============

/**
 * Upload a new map
 */
export function useUploadMap() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API_BASE}/maps/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(error.detail);
      }
      
      return response.json() as Promise<MapInfo>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
    },
  });
}

/**
 * Delete a map
 */
export function useDeleteMap() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (mapId: string) => 
      fetchApi<{ status: string }>(`/maps/${mapId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
    },
  });
}

/**
 * Plan a route
 */
export function usePlanRoute() {
  return useMutation({
    mutationFn: (request: RouteRequest) =>
      fetchApi<RouteResponse>(`/maps/${request.map_id}/route`, {
        method: 'POST',
        body: JSON.stringify(request),
      }),
  });
}

// ============ Transform Helpers ============

/**
 * Transform API road data to frontend Road type
 */
export function transformRoad(apiRoad: RoadInfo): Road {
  return {
    id: apiRoad.id,
    name: apiRoad.name,
    length: apiRoad.length,
    junctionId: apiRoad.junction_id || '-1',
    type: 'unknown',
    geometry: apiRoad.geometry_points.map((pt, i, arr) => ({
      s: (i / (arr.length - 1)) * apiRoad.length,
      x: pt.x,
      y: pt.y,
      hdg: 0,
      length: apiRoad.length / arr.length,
      type: 'line' as const,
    })),
    lanes: apiRoad.lane_sections.map(ls => ({
      s: ls.s,
      lanes: [
        ...ls.left_lanes.map(l => ({
          id: l.id,
          type: l.type,
          width: 3.5,
          direction: 'forward' as const,
        })),
        ...ls.right_lanes.map(l => ({
          id: l.id,
          type: l.type,
          width: 3.5,
          direction: 'backward' as const,
        })),
      ],
    })),
    speedLimit: null,
    predecessorId: null,
    successorId: null,
  };
}

/**
 * Transform API signal data to frontend Signal type
 */
export function transformSignal(apiSignal: SignalInfo): Signal {
  return {
    id: apiSignal.id,
    name: apiSignal.name,
    type: apiSignal.type,
    subtype: apiSignal.subtype || '',
    roadId: apiSignal.road_id,
    s: apiSignal.s,
    t: apiSignal.t,
    value: apiSignal.value,
    text: '',
    position: { x: apiSignal.x, y: apiSignal.y },
  };
}
