import { useAppStore } from '@/store/app-store';
import { useNavigate } from 'react-router-dom';
import { parseOpenDRIVE } from '@/lib/opendrive-parser';
import { generateSampleMap } from '@/lib/sample-data';
import { Map, Route as RouteIcon, FileText, Upload, Globe, BarChart3, FolderOpen } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { maps, routes, addMap, setCurrentMap } = useAppStore();
  const navigate = useNavigate();

  const totalRoads = maps.reduce((s, m) => s + m.roads.length, 0);

  const handleFileUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xodr,.xml';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const map = parseOpenDRIVE(text, file.name);
        addMap(map);
        navigate('/viewer');
      } catch (err) {
        console.error('Parse error:', err);
      }
    };
    input.click();
  };

  const handleLoadSample = () => {
    const sample = generateSampleMap();
    addMap(sample);
    navigate('/viewer');
  };

  const handleOpenMap = (map: typeof maps[0]) => {
    setCurrentMap(map);
    navigate('/viewer');
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } }),
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Manage your HD maps and simulation routes</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Maps Loaded', value: maps.length, icon: Map, color: 'text-primary' },
          { label: 'Roads Parsed', value: totalRoads, icon: FileText, color: 'text-accent' },
          { label: 'Routes Planned', value: routes.length, icon: RouteIcon, color: 'text-route' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="bg-card border border-border rounded-lg p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className="font-mono text-3xl font-semibold">{stat.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Open .xodr File', icon: FolderOpen, onClick: handleFileUpload },
            { label: 'Load Sample Map', icon: Globe, onClick: handleLoadSample },
            { label: 'New Route Plan', icon: RouteIcon, onClick: () => navigate('/route-planner') },
            { label: 'Batch Analyze', icon: BarChart3, onClick: () => navigate('/analysis') },
          ].map(action => (
            <button
              key={action.label}
              onClick={action.onClick}
              className="flex items-center gap-3 p-4 rounded-md bg-secondary hover:bg-secondary/80 transition-colors text-left group"
            >
              <action.icon className="w-5 h-5 text-primary group-hover:text-accent transition-colors" />
              <span className="text-sm font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Recent Maps */}
      <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Maps</h2>
        {maps.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No maps loaded yet. Upload an .xodr file or load a sample map.</p>
            <div className="flex gap-3 justify-center mt-4">
              <button onClick={handleFileUpload} className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                Open File
              </button>
              <button onClick={handleLoadSample} className="text-sm px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity">
                Load Sample
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {maps.map(map => (
              <button
                key={map.id}
                onClick={() => handleOpenMap(map)}
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Map className="w-4 h-4 text-primary" />
                  <div>
                    <div className="text-sm font-medium">{map.name}.xodr</div>
                    <div className="text-xs text-muted-foreground font-mono">{map.roads.length} roads · {map.junctions.length} junctions · {map.signals.length} signals</div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{getTimeAgo(map.loadedAt)}</span>
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Recent Routes */}
      {routes.length > 0 && (
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Routes</h2>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {routes.slice(0, 5).map(route => (
              <div key={route.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <RouteIcon className="w-4 h-4 text-route" />
                  <div>
                    <div className="text-sm font-medium">{route.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{(route.totalDistance / 1000).toFixed(1)} km · {route.mapId}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
