import { useAppStore } from '@/store/app-store';
import { useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { Waypoint } from '@/types/opendrive';

export default function RoutePlanner() {
  const { currentMap, addRoute } = useAppStore();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [routeName, setRouteName] = useState('');
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [isPlacing, setIsPlacing] = useState(false);

  useEffect(() => {
    if (!currentMap) return;
    const allX = currentMap.roads.flatMap(r => r.geometry.map(g => g.x));
    const allY = currentMap.roads.flatMap(r => r.geometry.map(g => g.y));
    if (allX.length > 0) {
      const canvas = canvasRef.current;
      if (canvas) {
        const cx = (Math.min(...allX) + Math.max(...allX)) / 2;
        const cy = (Math.min(...allY) + Math.max(...allY)) / 2;
        setPan({ x: canvas.width / 2 - cx, y: canvas.height / 2 + cy });
        const range = Math.max(Math.max(...allX) - Math.min(...allX), Math.max(...allY) - Math.min(...allY), 100);
        setZoom(Math.min(canvas.width, canvas.height) / (range * 1.5));
      }
    }
  }, [currentMap]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentMap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#141820';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, -zoom);

    // Draw roads
    currentMap.roads.forEach(road => {
      road.geometry.forEach(geom => {
        const totalLanes = road.lanes[0]?.lanes.length ?? 2;
        const roadWidth = totalLanes * 3.5;
        const ex = geom.x + Math.cos(geom.hdg) * geom.length;
        const ey = geom.y + Math.sin(geom.hdg) * geom.length;
        ctx.beginPath();
        ctx.moveTo(geom.x, geom.y);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = roadWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
      });
    });

    // Draw route line
    if (waypoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(waypoints[0].position.x, waypoints[0].position.y);
      waypoints.slice(1).forEach(wp => {
        ctx.lineTo(wp.position.x, wp.position.y);
      });
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 4 / zoom;
      ctx.setLineDash([8 / zoom, 4 / zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw waypoints
    waypoints.forEach((wp, i) => {
      ctx.save();
      ctx.translate(wp.position.x, wp.position.y);
      ctx.scale(1, -1);
      const r = 8 / zoom;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = wp.type === 'start' ? '#10B981' : wp.type === 'end' ? '#EF4444' : '#3B82F6';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${10 / zoom}px Inter`;
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), 0, 4 / zoom);
      ctx.restore();
    });

    ctx.restore();
  }, [currentMap, pan, zoom, waypoints]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth ?? 600;
      canvas.height = canvas.parentElement?.clientHeight ?? 500;
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  useEffect(() => { draw(); }, [draw]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!isPlacing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = -(e.clientY - rect.top - pan.y) / zoom;

    // Find closest road
    let closestRoadId = '';
    let closestS = 0;
    let minDist = Infinity;
    currentMap?.roads.forEach(road => {
      road.geometry.forEach(g => {
        const dx = mx - g.x;
        const dy = my - g.y;
        const along = dx * Math.cos(g.hdg) + dy * Math.sin(g.hdg);
        const clamped = Math.max(0, Math.min(g.length, along));
        const px = g.x + Math.cos(g.hdg) * clamped;
        const py = g.y + Math.sin(g.hdg) * clamped;
        const dist = Math.hypot(mx - px, my - py);
        if (dist < minDist) {
          minDist = dist;
          closestRoadId = road.id;
          closestS = clamped;
        }
      });
    });

    if (minDist < 30 / zoom) {
      const road = currentMap?.roads.find(r => r.id === closestRoadId);
      if (road && road.geometry[0]) {
        const g = road.geometry[0];
        const snapX = g.x + Math.cos(g.hdg) * closestS;
        const snapY = g.y + Math.sin(g.hdg) * closestS;
        const type = waypoints.length === 0 ? 'start' : 'waypoint';
        setWaypoints(prev => [...prev, {
          id: crypto.randomUUID(),
          type,
          roadId: closestRoadId,
          s: closestS,
          position: { x: snapX, y: snapY },
        }]);
      }
    }
  };

  const handleSaveRoute = () => {
    if (waypoints.length < 2 || !currentMap) return;
    // Mark last waypoint as end
    const finalWaypoints = waypoints.map((wp, i) => ({
      ...wp,
      type: i === 0 ? 'start' as const : i === waypoints.length - 1 ? 'end' as const : 'waypoint' as const,
    }));

    let totalDist = 0;
    for (let i = 1; i < finalWaypoints.length; i++) {
      const a = finalWaypoints[i - 1].position;
      const b = finalWaypoints[i].position;
      totalDist += Math.hypot(b.x - a.x, b.y - a.y);
    }

    addRoute({
      id: crypto.randomUUID(),
      name: routeName || `Route_${Date.now()}`,
      mapId: currentMap.name,
      waypoints: finalWaypoints,
      totalDistance: totalDist,
      estimatedTime: totalDist / 13.9, // ~50 km/h
      roadsUsed: [...new Set(finalWaypoints.map(wp => wp.roadId))],
      createdAt: new Date(),
    });
    setWaypoints([]);
    setRouteName('');
    setIsPlacing(false);
  };

  if (!currentMap) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No map loaded</p>
          <button onClick={() => navigate('/')} className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const totalDist = waypoints.reduce((sum, wp, i) => {
    if (i === 0) return 0;
    const prev = waypoints[i - 1];
    return sum + Math.hypot(wp.position.x - prev.position.x, wp.position.y - prev.position.y);
  }, 0);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Map */}
      <div className="flex-1 relative">
        {isPlacing && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-route/90 text-primary-foreground rounded-full px-4 py-1.5 text-xs font-medium">
            Click on roads to add waypoints
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`w-full h-full ${isDragging ? 'cursor-grabbing' : isPlacing ? 'cursor-crosshair' : 'cursor-grab'}`}
          onMouseDown={e => { if (!isPlacing) { setIsDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); } }}
          onMouseMove={e => { if (isDragging) setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onWheel={e => { e.preventDefault(); setZoom(z => Math.max(0.01, Math.min(50, z * (e.deltaY > 0 ? 0.9 : 1.1)))); }}
          onClick={handleCanvasClick}
        />
      </div>

      {/* Route Builder */}
      <div className="w-72 bg-card border-l border-border flex-shrink-0 overflow-y-auto p-4 space-y-5">
        <h2 className="text-sm font-semibold">Route Builder</h2>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Route Name</label>
          <input
            value={routeName}
            onChange={e => setRouteName(e.target.value)}
            placeholder="Highway_Test_01"
            className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Waypoints */}
        <div className="space-y-2">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider">Waypoints</h3>
          {waypoints.length === 0 ? (
            <p className="text-xs text-muted-foreground">No waypoints yet. Click "Add Waypoint" then click on the map.</p>
          ) : (
            <div className="space-y-2">
              {waypoints.map((wp, i) => (
                <div key={wp.id} className="flex items-center gap-2 p-2 bg-secondary/50 rounded text-xs">
                  <div className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-route' : 'bg-primary'}`} />
                  <div className="flex-1">
                    <div className="font-medium">{i === 0 ? 'Start' : `Waypoint ${i}`}</div>
                    <div className="text-muted-foreground font-mono">Road #{wp.roadId}, s={wp.s.toFixed(0)}</div>
                  </div>
                  <button
                    onClick={() => setWaypoints(prev => prev.filter(w => w.id !== wp.id))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setIsPlacing(!isPlacing)}
            className={`w-full text-sm py-2 rounded-md transition-colors ${
              isPlacing ? 'bg-route text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {isPlacing ? '📍 Placing... (click map)' : '+ Add Waypoint'}
          </button>
        </div>

        {/* Route Stats */}
        {waypoints.length > 1 && (
          <div className="space-y-2">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider">Route Stats</h3>
            <div className="bg-secondary/50 rounded p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Distance</span>
                <span className="font-mono">{(totalDist / 1000).toFixed(2)} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Time</span>
                <span className="font-mono">{(totalDist / 13.9 / 60).toFixed(1)} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Waypoints</span>
                <span className="font-mono">{waypoints.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Roads</span>
                <span className="font-mono">{new Set(waypoints.map(w => w.roadId)).size}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-2 border-t border-border">
          <button
            onClick={handleSaveRoute}
            disabled={waypoints.length < 2}
            className="w-full text-sm py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            💾 Save Route
          </button>
          <button
            onClick={() => { setWaypoints([]); setIsPlacing(false); }}
            className="w-full text-sm py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Clear Route
          </button>
        </div>
      </div>
    </div>
  );
}
