import { useAppStore } from '@/store/app-store';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Download } from 'lucide-react';

export default function ExportPage() {
  const { currentMap, routes } = useAppStore();
  const navigate = useNavigate();
  const [mapExportOptions, setMapExportOptions] = useState({
    roads: true, signs: true, junctions: true, meshes: false,
  });
  const [mapFormat, setMapFormat] = useState('json');
  const [routeFormat, setRouteFormat] = useState('json');
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set());

  const handleExportMap = () => {
    if (!currentMap) return;
    const data: any = {};
    if (mapExportOptions.roads) data.roads = currentMap.roads;
    if (mapExportOptions.signs) data.signals = currentMap.signals;
    if (mapExportOptions.junctions) data.junctions = currentMap.junctions;
    data.header = currentMap.header;

    let content: string;
    let ext: string;
    if (mapFormat === 'csv') {
      content = 'id,name,length,type,speedLimit\n' +
        currentMap.roads.map(r => `${r.id},${r.name},${r.length},${r.type},${r.speedLimit ?? ''}`).join('\n');
      ext = 'csv';
    } else if (mapFormat === 'geojson') {
      content = JSON.stringify({
        type: 'FeatureCollection',
        features: currentMap.roads.map(r => ({
          type: 'Feature',
          properties: { id: r.id, name: r.name, length: r.length, type: r.type },
          geometry: {
            type: 'LineString',
            coordinates: r.geometry.map(g => [g.x, g.y]),
          },
        })),
      }, null, 2);
      ext = 'geojson';
    } else {
      content = JSON.stringify(data, null, 2);
      ext = 'json';
    }

    downloadFile(content, `${currentMap.name}_export.${ext}`);
  };

  const handleExportRoutes = () => {
    const selected = routes.filter(r => selectedRoutes.has(r.id));
    const content = JSON.stringify(selected, null, 2);
    downloadFile(content, `routes_export.${routeFormat === 'json' ? 'json' : 'json'}`);
  };

  if (!currentMap) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No map loaded</p>
          <button onClick={() => navigate('/')} className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground">Go to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
        <p className="text-muted-foreground text-sm">Export map data and routes for external tools</p>
      </div>

      {/* Export Map Data */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-medium">Export Map Data</h2>
        <p className="text-xs text-muted-foreground">Current Map: <span className="font-mono">{currentMap.name}.xodr</span></p>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">What to export:</p>
          {Object.entries(mapExportOptions).map(([key, val]) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={val} onChange={() => setMapExportOptions(o => ({ ...o, [key]: !o[key as keyof typeof o] }))}
                className="rounded border-border bg-secondary accent-primary" />
              <span className="capitalize">{key === 'meshes' ? '3D Meshes (large)' : key}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Format:</p>
          {['json', 'geojson', 'csv'].map(f => (
            <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="mapFormat" checked={mapFormat === f} onChange={() => setMapFormat(f)}
                className="accent-primary" />
              <span className="uppercase text-xs font-mono">{f}</span>
              <span className="text-xs text-muted-foreground">
                {f === 'json' ? '(for web apps)' : f === 'geojson' ? '(for mapping tools)' : '(spreadsheet)'}
              </span>
            </label>
          ))}
        </div>

        <button onClick={handleExportMap} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
          <Download className="w-4 h-4" /> Export Map Data
        </button>
      </div>

      {/* Export Routes */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-medium">Export Routes</h2>
        {routes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No routes to export. Create routes in the Route Planner.</p>
        ) : (
          <>
            <div className="space-y-2">
              {routes.map(r => (
                <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={selectedRoutes.has(r.id)}
                    onChange={() => setSelectedRoutes(prev => {
                      const next = new Set(prev);
                      next.has(r.id) ? next.delete(r.id) : next.add(r.id);
                      return next;
                    })}
                    className="rounded border-border bg-secondary accent-primary" />
                  <span>{r.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">({(r.totalDistance / 1000).toFixed(1)} km)</span>
                </label>
              ))}
            </div>
            <button onClick={handleExportRoutes} disabled={selectedRoutes.size === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-40">
              <Download className="w-4 h-4" /> Export Routes
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
