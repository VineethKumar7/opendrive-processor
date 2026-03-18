import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { useNavigate } from 'react-router-dom';
import type { OpenDRIVEMap, Road } from '@/types/opendrive';
import RoadInspector from '@/components/RoadInspector';
import { Layers, ZoomIn, ZoomOut, Search, Ruler, MapPin, Route, Eye, EyeOff } from 'lucide-react';

interface LayerState {
  roads: boolean;
  lanes: boolean;
  signs: boolean;
  junctions: boolean;
  grid: boolean;
  labels: boolean;
}

export default function MapViewer() {
  const { currentMap, selectedRoadId, selectRoad } = useAppStore();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [layers, setLayers] = useState<LayerState>({
    roads: true, lanes: true, signs: true, junctions: true, grid: false, labels: false,
  });
  const [showLayers, setShowLayers] = useState(true);

  useEffect(() => {
    if (!currentMap) return;
    // Auto-center on load
    const allX = currentMap.roads.flatMap(r => r.geometry.map(g => g.x));
    const allY = currentMap.roads.flatMap(r => r.geometry.map(g => g.y));
    if (allX.length > 0) {
      const cx = (Math.min(...allX) + Math.max(...allX)) / 2;
      const cy = (Math.min(...allY) + Math.max(...allY)) / 2;
      const canvas = canvasRef.current;
      if (canvas) {
        const rangeX = Math.max(...allX) - Math.min(...allX);
        const rangeY = Math.max(...allY) - Math.min(...allY);
        const range = Math.max(rangeX, rangeY, 100);
        const newZoom = Math.min(canvas.width, canvas.height) / (range * 1.5);
        setZoom(newZoom);
        setPan({ x: canvas.width / 2 - cx * newZoom, y: canvas.height / 2 + cy * newZoom });
      }
    }
  }, [currentMap]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentMap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = '#141820';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, -zoom); // flip Y for map coords

    // Grid
    if (layers.grid) {
      const gridSize = 100;
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5 / zoom;
      const startX = Math.floor(-pan.x / zoom / gridSize) * gridSize - gridSize;
      const endX = startX + w / zoom + gridSize * 2;
      const startY = Math.floor(pan.y / zoom / gridSize) * gridSize - gridSize;
      const endY = startY + h / zoom + gridSize * 2;
      for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
      }
      for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
      }
    }

    // Junctions
    if (layers.junctions) {
      currentMap.junctions.forEach(j => {
        if (!j.position) return;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.5 / zoom;
        ctx.beginPath();
        ctx.arc(j.position.x, j.position.y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    // Roads
    if (layers.roads) {
      currentMap.roads.forEach(road => {
        const isSelected = road.id === selectedRoadId;
        drawRoad(ctx, road, zoom, isSelected, layers.lanes);
      });
    }

    // Signals
    if (layers.signs) {
      currentMap.signals.forEach(sig => {
        if (!sig.position) return;
        const isStop = sig.type === '206';
        const isLight = sig.type === '1000001' || sig.type === '1000002';
        const isSpeed = sig.type === '274';

        ctx.save();
        ctx.translate(sig.position.x, sig.position.y);
        ctx.scale(1, -1); // un-flip text

        const r = 6 / zoom;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = isStop ? '#EF4444' : isLight ? '#F59E0B' : isSpeed ? '#3B82F6' : '#8B5CF6';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1 / zoom;
        ctx.stroke();

        if (layers.labels) {
          ctx.fillStyle = '#fff';
          ctx.font = `${10 / zoom}px Inter`;
          ctx.textAlign = 'center';
          ctx.fillText(sig.name, 0, -r - 4 / zoom);
        }
        ctx.restore();
      });
    }

    // Labels
    if (layers.labels) {
      ctx.save();
      currentMap.roads.forEach(road => {
        if (road.geometry.length === 0) return;
        const g = road.geometry[0];
        const mx = g.x + Math.cos(g.hdg) * g.length / 2;
        const my = g.y + Math.sin(g.hdg) * g.length / 2;
        ctx.save();
        ctx.translate(mx, my);
        ctx.scale(1, -1);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `${9 / zoom}px JetBrains Mono`;
        ctx.textAlign = 'center';
        ctx.fillText(`#${road.id}`, 0, 0);
        ctx.restore();
      });
      ctx.restore();
    }

    ctx.restore();

    // Status bar
    ctx.fillStyle = 'rgba(20, 24, 32, 0.9)';
    ctx.fillRect(0, h - 28, w, 28);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px JetBrains Mono';
    ctx.fillText(
      `${currentMap.roads.length} roads | ${currentMap.roads.flatMap(r => r.lanes.flatMap(l => l.lanes)).length} lanes | ${currentMap.signals.length} signs | Zoom: ${(zoom * 100).toFixed(0)}%`,
      12, h - 9
    );
  }, [currentMap, pan, zoom, selectedRoadId, layers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth ?? 800;
      canvas.height = canvas.parentElement?.clientHeight ?? 600;
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.01, Math.min(50, z * factor)));
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!currentMap || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    // Convert to map coords
    const mx = (cx - pan.x) / zoom;
    const my = -(cy - pan.y) / zoom;

    // Find closest road
    let closest: string | null = null;
    let minDist = 20 / zoom;
    currentMap.roads.forEach(road => {
      road.geometry.forEach(g => {
        // Check distance to road line
        const dx = mx - g.x;
        const dy = my - g.y;
        const along = dx * Math.cos(g.hdg) + dy * Math.sin(g.hdg);
        if (along < 0 || along > g.length) return;
        const perp = Math.abs(-dx * Math.sin(g.hdg) + dy * Math.cos(g.hdg));
        if (perp < minDist) {
          minDist = perp;
          closest = road.id;
        }
      });
    });
    selectRoad(closest);
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

  const selectedRoad = currentMap.roads.find(r => r.id === selectedRoadId);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Layer panel */}
      {showLayers && (
        <div className="w-48 bg-card border-r border-border p-4 space-y-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Layers</h3>
            <button onClick={() => setShowLayers(false)} className="text-muted-foreground hover:text-foreground">
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </div>
          {(Object.keys(layers) as (keyof LayerState)[]).map(key => (
            <label key={key} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={() => setLayers(l => ({ ...l, [key]: !l[key] }))}
                className="rounded border-border bg-secondary accent-primary"
              />
              <span className="text-sm capitalize group-hover:text-foreground text-secondary-foreground">{key}</span>
            </label>
          ))}

          <div className="border-t border-border pt-4 space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Zoom</h3>
            <div className="flex gap-2">
              <button onClick={() => setZoom(z => Math.min(50, z * 1.3))} className="p-1.5 rounded bg-secondary hover:bg-secondary/80">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={() => setZoom(z => Math.max(0.01, z * 0.7))} className="p-1.5 rounded bg-secondary hover:bg-secondary/80">
                <ZoomOut className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-muted-foreground font-mono">{(zoom * 100).toFixed(0)}%</div>
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tools</h3>
            <div className="space-y-1">
              {[
                { icon: Search, label: 'Find' },
                { icon: Ruler, label: 'Measure' },
                { icon: MapPin, label: 'Mark' },
                { icon: Route, label: 'Route' },
              ].map(tool => (
                <button key={tool.label} className="flex items-center gap-2 w-full p-2 rounded text-sm hover:bg-secondary/80 text-secondary-foreground">
                  <tool.icon className="w-4 h-4" />
                  {tool.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative">
        {!showLayers && (
          <button
            onClick={() => setShowLayers(true)}
            className="absolute top-3 left-3 z-10 p-2 bg-card/90 rounded border border-border hover:bg-secondary"
          >
            <Layers className="w-4 h-4" />
          </button>
        )}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-card/90 rounded border border-border px-3 py-1.5">
          <span className="text-xs font-mono text-muted-foreground">{currentMap.name}.xodr</span>
        </div>
        <canvas
          ref={canvasRef}
          className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onClick={handleClick}
        />
      </div>

      {/* Inspector */}
      {selectedRoad && (
        <RoadInspector road={selectedRoad} onClose={() => selectRoad(null)} />
      )}
    </div>
  );
}

function drawRoad(ctx: CanvasRenderingContext2D, road: Road, zoom: number, isSelected: boolean, showLanes: boolean) {
  road.geometry.forEach(geom => {
    const totalLanes = road.lanes[0]?.lanes.length ?? 2;
    const roadWidth = totalLanes * 3.5;

    if (geom.type === 'arc' && geom.curvature) {
      const radius = 1 / Math.abs(geom.curvature);
      const sign = geom.curvature > 0 ? 1 : -1;
      const centerX = geom.x - sign * radius * Math.sin(geom.hdg);
      const centerY = geom.y + sign * radius * Math.cos(geom.hdg);
      const startAngle = Math.atan2(geom.y - centerY, geom.x - centerX);
      const arcLength = geom.length * geom.curvature;

      // Road surface
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + arcLength, geom.curvature < 0);
      ctx.strokeStyle = isSelected ? '#8B5CF6' : '#4B5563';
      ctx.lineWidth = roadWidth;
      ctx.stroke();

      // Center line
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + arcLength, geom.curvature < 0);
      ctx.strokeStyle = isSelected ? '#A78BFA' : '#FCD34D';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.stroke();
      ctx.setLineDash([]);

    } else {
      // Line
      const ex = geom.x + Math.cos(geom.hdg) * geom.length;
      const ey = geom.y + Math.sin(geom.hdg) * geom.length;

      // Road surface
      ctx.beginPath();
      ctx.moveTo(geom.x, geom.y);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = isSelected ? '#8B5CF6' : '#4B5563';
      ctx.lineWidth = roadWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Lane markings
      if (showLanes && road.lanes[0]) {
        const perpX = -Math.sin(geom.hdg);
        const perpY = Math.cos(geom.hdg);
        let offset = -roadWidth / 2;

        road.lanes[0].lanes.forEach((lane) => {
          offset += lane.width;
          if (offset < roadWidth / 2 - 0.1) {
            const isCenterLine = Math.abs(offset) < 0.5;
            ctx.beginPath();
            ctx.moveTo(geom.x + perpX * offset, geom.y + perpY * offset);
            ctx.lineTo(ex + perpX * offset, ey + perpY * offset);
            ctx.strokeStyle = isCenterLine
              ? (isSelected ? '#A78BFA' : '#FCD34D')
              : 'rgba(255,255,255,0.2)';
            ctx.lineWidth = isCenterLine ? 1.5 / zoom : 0.5 / zoom;
            ctx.setLineDash(isCenterLine ? [] : [4 / zoom, 3 / zoom]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });
      }

      // Road edge
      ctx.beginPath();
      ctx.moveTo(geom.x, geom.y);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = isSelected ? '#A78BFA' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = roadWidth + 2 / zoom;
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'destination-over';
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  });
}
