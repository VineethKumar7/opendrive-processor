import type { Road } from '@/types/opendrive';
import { X, ChevronRight } from 'lucide-react';

interface Props {
  road: Road;
  onClose: () => void;
}

export default function RoadInspector({ road, onClose }: Props) {
  const allLanes = road.lanes.flatMap(ls => ls.lanes);
  const geom = road.geometry[0];

  return (
    <div className="w-72 bg-card border-l border-border flex-shrink-0 overflow-y-auto animate-slide-in">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold">Road #{road.id}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Properties */}
        <Section title="Properties">
          <DataRow label="Name" value={road.name} />
          <DataRow label="Type" value={road.type} />
          <DataRow label="Length" value={`${road.length.toFixed(1)} m`} mono />
          <DataRow label="Junction" value={road.junctionId === '-1' ? 'None' : `#${road.junctionId}`} />
        </Section>

        {/* Geometry */}
        {geom && (
          <Section title="Geometry">
            <DataRow label="Start" value={`(${geom.x.toFixed(1)}, ${geom.y.toFixed(1)})`} mono />
            <DataRow label="Heading" value={`${(geom.hdg * 180 / Math.PI).toFixed(1)}°`} mono />
            <DataRow label="Type" value={geom.type} />
            {geom.curvature !== undefined && (
              <DataRow label="Curvature" value={geom.curvature.toFixed(4)} mono />
            )}
          </Section>
        )}

        {/* Lanes */}
        <Section title="Lanes">
          <div className="space-y-1">
            {allLanes.map(lane => (
              <div key={lane.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-secondary/50">
                <span className="font-mono">Lane {lane.id > 0 ? `+${lane.id}` : lane.id}</span>
                <span className="font-mono text-muted-foreground">{lane.width.toFixed(1)}m</span>
                <span className={lane.direction === 'forward' ? 'text-lane-right' : 'text-lane-left'}>
                  {lane.direction === 'forward' ? '→' : '←'}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Cross Section */}
        <Section title="Cross Section">
          <div className="bg-canvas-bg rounded p-3">
            <div className="flex items-center justify-center gap-0.5">
              {allLanes
                .sort((a, b) => b.id - a.id)
                .map(lane => (
                  <div
                    key={lane.id}
                    className="flex flex-col items-center"
                    style={{ width: `${Math.max(20, lane.width * 6)}px` }}
                  >
                    <span className="text-[9px] text-muted-foreground mb-1">
                      {lane.direction === 'forward' ? '→' : '←'}
                    </span>
                    <div
                      className={`h-3 w-full rounded-sm ${
                        lane.id === 0 ? 'bg-accent' :
                        lane.direction === 'forward' ? 'bg-lane-right/60' : 'bg-lane-left/60'
                      }`}
                    />
                    <span className="text-[8px] font-mono text-muted-foreground mt-1">
                      L{lane.id}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </Section>

        {/* Speed Limit */}
        {road.speedLimit && (
          <Section title="Speed Limit">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-destructive flex items-center justify-center">
                <span className="text-xs font-bold">{road.speedLimit}</span>
              </div>
              <span className="text-sm text-muted-foreground">{road.speedLimit} km/h</span>
            </div>
          </Section>
        )}

        {/* Connections */}
        <Section title="Connections">
          <DataRow label="Predecessor" value={road.predecessorId ? `Road #${road.predecessorId}` : 'None'} />
          <DataRow label="Successor" value={road.successorId ? `Road #${road.successorId}` : 'None'} />
        </Section>

        <button className="w-full text-sm py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          Export JSON
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</h4>
      {children}
    </div>
  );
}

function DataRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono' : ''}>{value}</span>
    </div>
  );
}
