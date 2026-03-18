import { useAppStore } from '@/store/app-store';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export default function Analysis() {
  const { currentMap, getMapStats } = useAppStore();
  const navigate = useNavigate();

  const stats = useMemo(() => currentMap ? getMapStats(currentMap) : null, [currentMap, getMapStats]);

  if (!currentMap || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No map loaded</p>
          <button onClick={() => navigate('/')} className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground">Go to Dashboard</button>
        </div>
      </div>
    );
  }

  const maxRoadType = Math.max(...Object.values(stats.roadTypes), 1);
  const maxLaneType = Math.max(...Object.values(stats.laneTypes), 1);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analysis</h1>
        <p className="text-muted-foreground text-sm">{currentMap.name}.xodr · Map statistics and validation</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Roads', value: stats.totalRoads },
          { label: 'Lanes', value: stats.totalLanes },
          { label: 'Junctions', value: stats.totalJunctions },
          { label: 'Signs', value: stats.totalSigns },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="font-mono text-2xl font-semibold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-1">
        <div className="text-xs text-muted-foreground">Total Road Length: <span className="font-mono text-foreground">{(stats.totalRoadLength / 1000).toFixed(1)} km</span></div>
        <div className="text-xs text-muted-foreground">Map Bounds: <span className="font-mono text-foreground">{(stats.mapBounds.width / 1000).toFixed(1)} km × {(stats.mapBounds.height / 1000).toFixed(1)} km</span></div>
      </div>

      {/* Road & Lane Types */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Road Types</h3>
          {Object.entries(stats.roadTypes).map(([type, count]) => (
            <div key={type} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="capitalize">{type}</span>
                <span className="font-mono text-muted-foreground">{((count / stats.totalRoads) * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(count / maxRoadType) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lane Types</h3>
          {Object.entries(stats.laneTypes).map(([type, count]) => (
            <div key={type} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="capitalize">{type}</span>
                <span className="font-mono text-muted-foreground">{((count / stats.totalLanes) * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-lane-right rounded-full transition-all" style={{ width: `${(count / maxLaneType) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Junction Complexity */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Junction Complexity</h3>
        {[
          { label: 'Simple (3-way)', value: stats.junctionComplexity.simple },
          { label: 'Standard (4-way)', value: stats.junctionComplexity.standard },
          { label: 'Complex (5+ way)', value: stats.junctionComplexity.complex },
        ].map(j => (
          <div key={j.label} className="flex items-center gap-3 text-xs">
            <span className="w-32 text-muted-foreground">{j.label}</span>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: `${stats.totalJunctions ? (j.value / stats.totalJunctions) * 100 : 0}%` }} />
            </div>
            <span className="font-mono w-8 text-right">{j.value}</span>
          </div>
        ))}
        <div className="text-xs text-muted-foreground mt-2">
          Signalized: <span className="font-mono text-foreground">{stats.signalized}</span> · Unsignalized: <span className="font-mono text-foreground">{stats.unsignalized}</span>
        </div>
      </div>

      {/* Validation */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Validation</h3>
        {stats.validationIssues.map((issue, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            {issue.type === 'info' && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
            {issue.type === 'warning' && <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />}
            {issue.type === 'error' && <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />}
            <span className={issue.type === 'info' ? 'text-success' : issue.type === 'warning' ? 'text-warning' : 'text-destructive'}>
              {issue.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
