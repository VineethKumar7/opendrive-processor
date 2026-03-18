import { useAppStore } from '@/store/app-store';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Octagon, TrafficCone, Gauge, PersonStanding, Ban, AlertTriangle } from 'lucide-react';
import { useState, useMemo } from 'react';

const signalInfo: Record<string, { icon: typeof Octagon; label: string; color: string }> = {
  '206': { icon: Octagon, label: 'STOP Sign', color: 'text-destructive' },
  '1000001': { icon: TrafficCone, label: 'Traffic Light', color: 'text-accent' },
  '1000002': { icon: TrafficCone, label: 'Traffic Light', color: 'text-accent' },
  '205': { icon: AlertTriangle, label: 'Yield Sign', color: 'text-accent' },
  '274': { icon: Gauge, label: 'Speed Limit', color: 'text-primary' },
  '350': { icon: PersonStanding, label: 'Pedestrian Crossing', color: 'text-selected' },
  '267': { icon: Ban, label: 'No Entry', color: 'text-destructive' },
};

export default function TrafficSigns() {
  const { currentMap } = useAppStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const signals = useMemo(() => {
    if (!currentMap) return [];
    return currentMap.signals.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.roadId.includes(search);
      const matchType = filterType === 'all' || s.type === filterType;
      return matchSearch && matchType;
    });
  }, [currentMap, search, filterType]);

  const typeCounts = useMemo(() => {
    if (!currentMap) return {};
    const counts: Record<string, number> = {};
    currentMap.signals.forEach(s => {
      const info = signalInfo[s.type];
      const label = info?.label ?? 'Other';
      counts[label] = (counts[label] || 0) + 1;
    });
    return counts;
  }, [currentMap]);

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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Traffic Signs</h1>
        <p className="text-muted-foreground text-sm">{currentMap.name}.xodr · {currentMap.signals.length} signals</p>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search signs..."
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-card border border-border rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All Types</option>
          <option value="206">STOP</option>
          <option value="1000001">Traffic Light</option>
          <option value="205">Yield</option>
          <option value="274">Speed Limit</option>
          <option value="350">Pedestrian</option>
          <option value="267">No Entry</option>
        </select>
      </div>

      {/* Sign List */}
      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {signals.map(sig => {
          const info = signalInfo[sig.type] ?? { icon: AlertTriangle, label: 'Unknown', color: 'text-muted-foreground' };
          const Icon = info.icon;
          return (
            <div key={sig.id} className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${info.color}`} />
                <div>
                  <div className="text-sm font-medium">{sig.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    Road #{sig.roadId}, s={sig.s.toFixed(1)}m
                  </div>
                </div>
              </div>
              <button className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <MapPin className="w-3.5 h-3.5" /> Locate on Map
              </button>
            </div>
          );
        })}
        {signals.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">No signals found</div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-sm text-muted-foreground mb-3">Summary: {currentMap.signals.length} signs total</div>
        <div className="flex flex-wrap gap-4">
          {Object.entries(typeCounts).map(([label, count]) => (
            <div key={label} className="text-xs">
              <span className="text-muted-foreground">{label}:</span>{' '}
              <span className="font-mono font-medium">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <button className="text-sm px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
        📥 Export Sign List (CSV)
      </button>
    </div>
  );
}
