// Client-side OpenDRIVE (.xodr) XML parser

import type {
  OpenDRIVEMap, Road, RoadGeometry, LaneSection, Lane,
  Junction, JunctionConnection, Signal, MapHeader
} from '@/types/opendrive';

function getAttr(el: Element, name: string, fallback = ''): string {
  return el.getAttribute(name) ?? fallback;
}

function getNumAttr(el: Element, name: string, fallback = 0): number {
  const v = el.getAttribute(name);
  return v ? parseFloat(v) : fallback;
}

function parseHeader(doc: Document): MapHeader {
  const h = doc.querySelector('OpenDRIVE > header');
  if (!h) return { revMajor: 1, revMinor: 6, name: 'Unknown', date: '', north: 0, south: 0, east: 0, west: 0 };
  return {
    revMajor: getNumAttr(h, 'revMajor', 1),
    revMinor: getNumAttr(h, 'revMinor', 6),
    name: getAttr(h, 'name', 'Unnamed Map'),
    date: getAttr(h, 'date'),
    north: getNumAttr(h, 'north'),
    south: getNumAttr(h, 'south'),
    east: getNumAttr(h, 'east'),
    west: getNumAttr(h, 'west'),
  };
}

function parseGeometry(roadEl: Element): RoadGeometry[] {
  const geoms: RoadGeometry[] = [];
  const planView = roadEl.querySelector('planView');
  if (!planView) return geoms;

  planView.querySelectorAll('geometry').forEach(g => {
    const base = {
      s: getNumAttr(g, 's'),
      x: getNumAttr(g, 'x'),
      y: getNumAttr(g, 'y'),
      hdg: getNumAttr(g, 'hdg'),
      length: getNumAttr(g, 'length'),
    };

    const line = g.querySelector('line');
    const arc = g.querySelector('arc');
    const spiral = g.querySelector('spiral');

    if (arc) {
      geoms.push({ ...base, type: 'arc', curvature: getNumAttr(arc, 'curvature') });
    } else if (spiral) {
      geoms.push({ ...base, type: 'spiral' });
    } else {
      geoms.push({ ...base, type: 'line' });
    }
  });

  return geoms;
}

function parseLanes(roadEl: Element): LaneSection[] {
  const sections: LaneSection[] = [];
  roadEl.querySelectorAll('lanes > laneSection').forEach(ls => {
    const s = getNumAttr(ls, 's');
    const lanes: Lane[] = [];

    const parseSide = (side: 'left' | 'right' | 'center') => {
      const sideEl = ls.querySelector(side);
      if (!sideEl) return;
      sideEl.querySelectorAll('lane').forEach(l => {
        const id = parseInt(getAttr(l, 'id', '0'));
        const type = getAttr(l, 'type', 'driving');
        const widthEl = l.querySelector('width');
        const width = widthEl ? getNumAttr(widthEl, 'a', 3.5) : 3.5;
        lanes.push({
          id,
          type,
          width,
          direction: id > 0 ? 'backward' : 'forward',
        });
      });
    };

    parseSide('left');
    parseSide('center');
    parseSide('right');
    sections.push({ s, lanes });
  });

  return sections;
}

function parseRoads(doc: Document): Road[] {
  const roads: Road[] = [];
  doc.querySelectorAll('OpenDRIVE > road').forEach(r => {
    const typeEl = r.querySelector('type');
    const speedEl = r.querySelector('type > speed');
    const predEl = r.querySelector('link > predecessor');
    const succEl = r.querySelector('link > successor');

    roads.push({
      id: getAttr(r, 'id'),
      name: getAttr(r, 'name', `Road ${getAttr(r, 'id')}`),
      length: getNumAttr(r, 'length'),
      junctionId: getAttr(r, 'junction', '-1'),
      type: typeEl ? getAttr(typeEl, 'type', 'town') : 'town',
      geometry: parseGeometry(r),
      lanes: parseLanes(r),
      speedLimit: speedEl ? getNumAttr(speedEl, 'max') : null,
      predecessorId: predEl ? getAttr(predEl, 'elementId') : null,
      successorId: succEl ? getAttr(succEl, 'elementId') : null,
    });
  });
  return roads;
}

function parseJunctions(doc: Document): Junction[] {
  const junctions: Junction[] = [];
  doc.querySelectorAll('OpenDRIVE > junction').forEach(j => {
    const connections: JunctionConnection[] = [];
    j.querySelectorAll('connection').forEach(c => {
      connections.push({
        id: getAttr(c, 'id'),
        incomingRoad: getAttr(c, 'incomingRoad'),
        connectingRoad: getAttr(c, 'connectingRoad'),
        contactPoint: getAttr(c, 'contactPoint', 'start'),
      });
    });
    junctions.push({
      id: getAttr(j, 'id'),
      name: getAttr(j, 'name', `Junction ${getAttr(j, 'id')}`),
      connections,
    });
  });
  return junctions;
}

function parseSignals(doc: Document): Signal[] {
  const signals: Signal[] = [];
  doc.querySelectorAll('OpenDRIVE > road').forEach(r => {
    const roadId = getAttr(r, 'id');
    r.querySelectorAll('signals > signal').forEach(s => {
      signals.push({
        id: getAttr(s, 'id'),
        name: getAttr(s, 'name', `Signal ${getAttr(s, 'id')}`),
        type: getAttr(s, 'type'),
        subtype: getAttr(s, 'subtype', '-1'),
        roadId,
        s: getNumAttr(s, 's'),
        t: getNumAttr(s, 't'),
        value: getNumAttr(s, 'value'),
        text: getAttr(s, 'text'),
      });
    });
  });
  return signals;
}

export function parseOpenDRIVE(xmlString: string, fileName: string): OpenDRIVEMap {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const errorNode = doc.querySelector('parsererror');
  if (errorNode) {
    throw new Error('Invalid XML: ' + errorNode.textContent);
  }

  const header = parseHeader(doc);
  const roads = parseRoads(doc);
  const junctions = parseJunctions(doc);
  const signals = parseSignals(doc);

  // Calculate signal positions based on road geometry
  signals.forEach(sig => {
    const road = roads.find(r => r.id === sig.roadId);
    if (road && road.geometry.length > 0) {
      const geom = road.geometry[0];
      const fraction = road.length > 0 ? sig.s / road.length : 0;
      sig.position = {
        x: geom.x + Math.cos(geom.hdg) * sig.s,
        y: geom.y + Math.sin(geom.hdg) * sig.s,
      };
    }
  });

  // Calculate junction positions
  junctions.forEach(junc => {
    const connectedRoads = junc.connections
      .map(c => roads.find(r => r.id === c.connectingRoad || r.id === c.incomingRoad))
      .filter(Boolean);
    if (connectedRoads.length > 0) {
      const avgX = connectedRoads.reduce((s, r) => s + (r!.geometry[0]?.x ?? 0), 0) / connectedRoads.length;
      const avgY = connectedRoads.reduce((s, r) => s + (r!.geometry[0]?.y ?? 0), 0) / connectedRoads.length;
      junc.position = { x: avgX, y: avgY };
    }
  });

  return {
    id: crypto.randomUUID(),
    name: fileName.replace('.xodr', ''),
    roads,
    junctions,
    signals,
    header,
    loadedAt: new Date(),
  };
}
