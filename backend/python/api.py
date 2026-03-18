#!/usr/bin/env python3
"""
FastAPI Backend for OpenDRIVE Road Network Processor

Provides REST API for parsing, visualizing, and route planning on OpenDRIVE maps.
"""

import os
import json
import tempfile
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Try to import the C++ bindings, fall back to pure Python if not available
try:
    import opendrive_core as odr
    NATIVE_AVAILABLE = True
except ImportError:
    NATIVE_AVAILABLE = False
    print("Warning: Native C++ library not found, using pure Python fallback")

app = FastAPI(
    title="OpenDRIVE Road Network Processor API",
    description="Parse, visualize, and route plan on OpenDRIVE HD maps",
    version="1.0.0"
)

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data directories
DATA_DIR = Path(__file__).parent.parent.parent / "data"
MAPS_DIR = DATA_DIR / "maps"
MAPS_DIR.mkdir(parents=True, exist_ok=True)

# In-memory cache for loaded maps
loaded_maps = {}


# ============ Models ============

class MapInfo(BaseModel):
    id: str
    name: str
    version: str
    date: str
    road_count: int
    junction_count: int
    total_length: float
    total_lanes: int
    total_signals: int
    filepath: str


class RoadInfo(BaseModel):
    id: str
    name: str
    length: float
    junction_id: Optional[str]
    geometry_points: List[dict]
    lane_sections: List[dict]
    signals: List[dict]


class RouteRequest(BaseModel):
    map_id: str
    start_x: float
    start_y: float
    goal_x: float
    goal_y: float
    prefer_highways: bool = False
    avoid_u_turns: bool = True


class RouteResponse(BaseModel):
    valid: bool
    waypoints: List[dict]
    road_ids: List[str]
    total_length: float
    estimated_time: float
    error_message: Optional[str] = None


class LaneGeometry(BaseModel):
    road_id: str
    lane_id: int
    boundary_points: List[dict]
    center_points: List[dict]


# ============ Pure Python Fallback Parser ============

class PythonOpenDriveParser:
    """Fallback parser when C++ library is not available."""
    
    def __init__(self):
        try:
            import xml.etree.ElementTree as ET
            self.ET = ET
        except ImportError:
            raise ImportError("xml.etree.ElementTree required for fallback parser")
    
    def parse_file(self, filepath: str) -> dict:
        tree = self.ET.parse(filepath)
        root = tree.getroot()
        
        # Parse header
        header = root.find('header')
        map_data = {
            'name': header.get('name', '') if header is not None else '',
            'version': f"{header.get('revMajor', '1')}.{header.get('revMinor', '0')}" if header else '1.0',
            'date': header.get('date', '') if header is not None else '',
            'roads': [],
            'junctions': []
        }
        
        # Parse roads
        for road_elem in root.findall('road'):
            road = self._parse_road(road_elem)
            map_data['roads'].append(road)
        
        # Parse junctions
        for junc_elem in root.findall('junction'):
            junction = {
                'id': junc_elem.get('id', ''),
                'name': junc_elem.get('name', ''),
                'connections': []
            }
            for conn_elem in junc_elem.findall('connection'):
                junction['connections'].append({
                    'id': conn_elem.get('id', ''),
                    'incoming_road': conn_elem.get('incomingRoad', ''),
                    'connecting_road': conn_elem.get('connectingRoad', '')
                })
            map_data['junctions'].append(junction)
        
        return map_data
    
    def _parse_road(self, elem) -> dict:
        road = {
            'id': elem.get('id', ''),
            'name': elem.get('name', ''),
            'length': float(elem.get('length', 0)),
            'junction_id': elem.get('junction', '-1'),
            'geometry': [],
            'lane_sections': [],
            'signals': []
        }
        
        # Parse planView geometry
        plan_view = elem.find('planView')
        if plan_view is not None:
            for geom_elem in plan_view.findall('geometry'):
                geom = {
                    's': float(geom_elem.get('s', 0)),
                    'x': float(geom_elem.get('x', 0)),
                    'y': float(geom_elem.get('y', 0)),
                    'hdg': float(geom_elem.get('hdg', 0)),
                    'length': float(geom_elem.get('length', 0)),
                    'type': 'line'
                }
                
                if geom_elem.find('arc') is not None:
                    geom['type'] = 'arc'
                    geom['curvature'] = float(geom_elem.find('arc').get('curvature', 0))
                elif geom_elem.find('spiral') is not None:
                    geom['type'] = 'spiral'
                
                road['geometry'].append(geom)
        
        # Parse lanes
        lanes_elem = elem.find('lanes')
        if lanes_elem is not None:
            for section_elem in lanes_elem.findall('laneSection'):
                section = {
                    's': float(section_elem.get('s', 0)),
                    'left_lanes': [],
                    'right_lanes': []
                }
                
                left = section_elem.find('left')
                if left is not None:
                    for lane_elem in left.findall('lane'):
                        section['left_lanes'].append(self._parse_lane(lane_elem))
                
                right = section_elem.find('right')
                if right is not None:
                    for lane_elem in right.findall('lane'):
                        section['right_lanes'].append(self._parse_lane(lane_elem))
                
                road['lane_sections'].append(section)
        
        # Parse signals
        signals_elem = elem.find('signals')
        if signals_elem is not None:
            for sig_elem in signals_elem.findall('signal'):
                road['signals'].append({
                    'id': sig_elem.get('id', ''),
                    's': float(sig_elem.get('s', 0)),
                    't': float(sig_elem.get('t', 0)),
                    'name': sig_elem.get('name', ''),
                    'type': sig_elem.get('type', ''),
                    'value': float(sig_elem.get('value', 0))
                })
        
        return road
    
    def _parse_lane(self, elem) -> dict:
        lane = {
            'id': int(elem.get('id', 0)),
            'type': elem.get('type', 'none'),
            'widths': []
        }
        
        for width_elem in elem.findall('width'):
            lane['widths'].append({
                's_offset': float(width_elem.get('sOffset', 0)),
                'a': float(width_elem.get('a', 0)),
                'b': float(width_elem.get('b', 0)),
                'c': float(width_elem.get('c', 0)),
                'd': float(width_elem.get('d', 0))
            })
        
        return lane
    
    def sample_road_geometry(self, road: dict, resolution: float = 5.0) -> List[dict]:
        """Sample points along road reference line."""
        import math
        points = []
        
        for geom in road['geometry']:
            num_samples = max(2, int(geom['length'] / resolution) + 1)
            
            for i in range(num_samples):
                ds = i * geom['length'] / (num_samples - 1) if num_samples > 1 else 0
                
                if geom['type'] == 'line':
                    x = geom['x'] + ds * math.cos(geom['hdg'])
                    y = geom['y'] + ds * math.sin(geom['hdg'])
                elif geom['type'] == 'arc' and 'curvature' in geom:
                    curv = geom['curvature']
                    if abs(curv) > 1e-10:
                        radius = 1.0 / curv
                        angle = ds * curv
                        local_x = radius * math.sin(angle)
                        local_y = radius * (1.0 - math.cos(angle))
                        cos_h = math.cos(geom['hdg'])
                        sin_h = math.sin(geom['hdg'])
                        x = geom['x'] + local_x * cos_h - local_y * sin_h
                        y = geom['y'] + local_x * sin_h + local_y * cos_h
                    else:
                        x = geom['x'] + ds * math.cos(geom['hdg'])
                        y = geom['y'] + ds * math.sin(geom['hdg'])
                else:
                    # Default to line for unsupported types
                    x = geom['x'] + ds * math.cos(geom['hdg'])
                    y = geom['y'] + ds * math.sin(geom['hdg'])
                
                points.append({'x': x, 'y': y, 'z': 0})
        
        return points


# Global parser instance
if NATIVE_AVAILABLE:
    parser = odr.Parser()
else:
    parser = PythonOpenDriveParser()


# ============ Helper Functions ============

def load_map(map_id: str):
    """Load map from cache or file."""
    if map_id in loaded_maps:
        return loaded_maps[map_id]
    
    filepath = MAPS_DIR / f"{map_id}.xodr"
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"Map {map_id} not found")
    
    if NATIVE_AVAILABLE:
        map_data = parser.parse_file(str(filepath))
    else:
        map_data = parser.parse_file(str(filepath))
    
    loaded_maps[map_id] = map_data
    return map_data


def map_to_info(map_id: str, map_data, filepath: str) -> MapInfo:
    """Convert map data to MapInfo response."""
    if NATIVE_AVAILABLE:
        return MapInfo(
            id=map_id,
            name=map_data.name or map_id,
            version=map_data.version,
            date=map_data.date,
            road_count=len(map_data.roads),
            junction_count=len(map_data.junctions),
            total_length=float(map_data.total_road_length()),
            total_lanes=int(map_data.total_lane_count()),
            total_signals=int(map_data.total_signal_count()),
            filepath=filepath
        )
    else:
        total_lanes = sum(
            len(s['left_lanes']) + len(s['right_lanes'])
            for r in map_data['roads']
            for s in r['lane_sections']
        )
        total_signals = sum(len(r['signals']) for r in map_data['roads'])
        
        return MapInfo(
            id=map_id,
            name=map_data['name'] or map_id,
            version=map_data['version'],
            date=map_data['date'],
            road_count=len(map_data['roads']),
            junction_count=len(map_data['junctions']),
            total_length=sum(r['length'] for r in map_data['roads']),
            total_lanes=total_lanes,
            total_signals=total_signals,
            filepath=filepath
        )


# ============ API Endpoints ============

@app.get("/")
async def root():
    return {
        "name": "OpenDRIVE Road Network Processor API",
        "version": "1.0.0",
        "native_library": NATIVE_AVAILABLE
    }


@app.get("/maps", response_model=List[MapInfo])
async def list_maps():
    """List all available maps."""
    maps = []
    for filepath in MAPS_DIR.glob("*.xodr"):
        map_id = filepath.stem
        try:
            map_data = load_map(map_id)
            maps.append(map_to_info(map_id, map_data, str(filepath)))
        except Exception as e:
            print(f"Error loading {map_id}: {e}")
    return maps


@app.post("/maps/upload", response_model=MapInfo)
async def upload_map(file: UploadFile = File(...)):
    """Upload a new OpenDRIVE map."""
    if not file.filename.endswith('.xodr'):
        raise HTTPException(status_code=400, detail="File must be .xodr format")
    
    map_id = Path(file.filename).stem
    filepath = MAPS_DIR / file.filename
    
    # Save file
    content = await file.read()
    with open(filepath, 'wb') as f:
        f.write(content)
    
    # Parse and validate
    try:
        if NATIVE_AVAILABLE:
            map_data = parser.parse_file(str(filepath))
            issues = parser.validate(map_data)
            if any('Error' in issue for issue in issues):
                filepath.unlink()
                raise HTTPException(status_code=400, detail=f"Validation errors: {issues}")
        else:
            map_data = parser.parse_file(str(filepath))
        
        loaded_maps[map_id] = map_data
        return map_to_info(map_id, map_data, str(filepath))
        
    except Exception as e:
        if filepath.exists():
            filepath.unlink()
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/maps/{map_id}", response_model=MapInfo)
async def get_map(map_id: str):
    """Get map information."""
    map_data = load_map(map_id)
    filepath = MAPS_DIR / f"{map_id}.xodr"
    return map_to_info(map_id, map_data, str(filepath))


@app.delete("/maps/{map_id}")
async def delete_map(map_id: str):
    """Delete a map."""
    filepath = MAPS_DIR / f"{map_id}.xodr"
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Map not found")
    
    filepath.unlink()
    if map_id in loaded_maps:
        del loaded_maps[map_id]
    
    return {"status": "deleted", "map_id": map_id}


@app.get("/maps/{map_id}/roads", response_model=List[RoadInfo])
async def get_roads(
    map_id: str,
    resolution: float = Query(5.0, description="Geometry sampling resolution in meters")
):
    """Get all roads with geometry."""
    map_data = load_map(map_id)
    roads = []
    
    if NATIVE_AVAILABLE:
        for road in map_data.roads:
            points = odr.GeometryCalculator.sample_road(road, resolution)
            
            roads.append(RoadInfo(
                id=road.id,
                name=road.name,
                length=road.length,
                junction_id=road.junction_id if road.junction_id != "-1" else None,
                geometry_points=[{'x': p.x, 'y': p.y, 'z': p.z} for p in points],
                lane_sections=[{
                    's': ls.s,
                    'left_lanes': [{'id': l.id, 'type': str(l.type)} for l in ls.left_lanes],
                    'right_lanes': [{'id': l.id, 'type': str(l.type)} for l in ls.right_lanes]
                } for ls in road.lane_sections],
                signals=[{
                    'id': s.id, 's': s.s, 't': s.t,
                    'name': s.name, 'type': s.type, 'value': s.value
                } for s in road.signals]
            ))
    else:
        for road in map_data['roads']:
            points = parser.sample_road_geometry(road, resolution)
            
            roads.append(RoadInfo(
                id=road['id'],
                name=road['name'],
                length=road['length'],
                junction_id=road['junction_id'] if road['junction_id'] != '-1' else None,
                geometry_points=points,
                lane_sections=[{
                    's': ls['s'],
                    'left_lanes': [{'id': l['id'], 'type': l['type']} for l in ls['left_lanes']],
                    'right_lanes': [{'id': l['id'], 'type': l['type']} for l in ls['right_lanes']]
                } for ls in road['lane_sections']],
                signals=road['signals']
            ))
    
    return roads


@app.get("/maps/{map_id}/lanes/{road_id}", response_model=List[LaneGeometry])
async def get_lane_geometry(
    map_id: str,
    road_id: str,
    resolution: float = Query(2.0, description="Sampling resolution")
):
    """Get lane geometry for a specific road."""
    map_data = load_map(map_id)
    lanes = []
    
    if NATIVE_AVAILABLE:
        road = map_data.get_road(road_id)
        if not road:
            raise HTTPException(status_code=404, detail=f"Road {road_id} not found")
        
        # Get all lane IDs
        lane_ids = set()
        for section in road.lane_sections:
            for lane in section.left_lanes:
                lane_ids.add(lane.id)
            for lane in section.right_lanes:
                lane_ids.add(lane.id)
        
        for lane_id in lane_ids:
            boundary = odr.GeometryCalculator.sample_lane_boundary(road, lane_id, resolution)
            center = odr.GeometryCalculator.sample_lane_center(road, lane_id, resolution)
            
            lanes.append(LaneGeometry(
                road_id=road_id,
                lane_id=lane_id,
                boundary_points=[{'x': p.x, 'y': p.y, 'z': p.z} for p in boundary],
                center_points=[{'x': p.x, 'y': p.y, 'z': p.z} for p in center]
            ))
    else:
        # Pure Python: simplified lane geometry
        road = next((r for r in map_data['roads'] if r['id'] == road_id), None)
        if not road:
            raise HTTPException(status_code=404, detail=f"Road {road_id} not found")
        
        # Get reference line
        ref_points = parser.sample_road_geometry(road, resolution)
        
        # For each lane section, offset the reference line
        for section in road['lane_sections']:
            for lane in section['left_lanes'] + section['right_lanes']:
                lanes.append(LaneGeometry(
                    road_id=road_id,
                    lane_id=lane['id'],
                    boundary_points=ref_points,  # Simplified
                    center_points=ref_points
                ))
    
    return lanes


@app.post("/maps/{map_id}/route", response_model=RouteResponse)
async def plan_route(map_id: str, request: RouteRequest):
    """Plan a route between two points."""
    map_data = load_map(map_id)
    
    if not NATIVE_AVAILABLE:
        raise HTTPException(
            status_code=501, 
            detail="Route planning requires native C++ library"
        )
    
    try:
        planner = odr.RoutePlanner(map_data, 10.0)
        
        start = odr.Point2D(request.start_x, request.start_y)
        goal = odr.Point2D(request.goal_x, request.goal_y)
        
        options = odr.RoutePlannerOptions()
        options.prefer_highways = request.prefer_highways
        options.avoid_u_turns = request.avoid_u_turns
        
        route = planner.plan_route(start, goal, options)
        
        return RouteResponse(
            valid=route.valid,
            waypoints=[{'x': p.x, 'y': p.y, 'z': p.z} for p in route.waypoints],
            road_ids=route.road_ids,
            total_length=route.total_length,
            estimated_time=route.estimated_time,
            error_message=route.error_message if not route.valid else None
        )
        
    except Exception as e:
        return RouteResponse(
            valid=False,
            waypoints=[],
            road_ids=[],
            total_length=0,
            estimated_time=0,
            error_message=str(e)
        )


@app.get("/maps/{map_id}/signals")
async def get_signals(map_id: str):
    """Get all traffic signals in the map."""
    map_data = load_map(map_id)
    signals = []
    
    if NATIVE_AVAILABLE:
        for road in map_data.roads:
            for signal in road.signals:
                pose = road.get_pose_at(signal.s)
                signals.append({
                    'id': signal.id,
                    'road_id': road.id,
                    's': signal.s,
                    't': signal.t,
                    'x': pose.position.x,
                    'y': pose.position.y,
                    'name': signal.name,
                    'type': signal.type,
                    'subtype': signal.subtype,
                    'value': signal.value,
                    'dynamic': signal.dynamic
                })
    else:
        for road in map_data['roads']:
            for signal in road['signals']:
                signals.append({
                    'id': signal['id'],
                    'road_id': road['id'],
                    's': signal['s'],
                    't': signal['t'],
                    'name': signal['name'],
                    'type': signal['type'],
                    'value': signal['value']
                })
    
    return signals


@app.get("/maps/{map_id}/junctions")
async def get_junctions(map_id: str):
    """Get all junctions in the map."""
    map_data = load_map(map_id)
    
    if NATIVE_AVAILABLE:
        return [{
            'id': j.id,
            'name': j.name,
            'connections': [{
                'id': c.id,
                'incoming_road': c.incoming_road,
                'connecting_road': c.connecting_road
            } for c in j.connections]
        } for j in map_data.junctions]
    else:
        return map_data['junctions']


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
