"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HoleGreen {
  hole: number;
  lat: number;
  lng: number;
}

interface PlayerPos {
  lat: number;
  lng: number;
  accuracy: number;
}

interface CourseFeature {
  type: "fairway" | "green" | "bunker" | "water" | "rough" | "tee";
  hole?: number;
  coordinates: [number, number][][];  // array of polygon rings (outer + holes)
}

interface ShotLog {
  hole: number;
  lat: number;
  lng: number;
  timestamp: number;
  shotNumber: number; // 1, 2, 3... for this hole
}

interface CourseMapModalProps {
  courseName: string;
  totalHoles: number;
  onClose: () => void;
}

// ─── Haversine distance (metres) ─────────────────────────────────────────────

function haversineMetres(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function metresToYards(m: number): number {
  return Math.round(m * 1.09361);
}

// ─── Overpass API: fetch all course features in one call ─────────────────────

// Try multiple Overpass mirrors in parallel — first to respond wins
const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function fetchWithFallback(query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let errors = 0;
    const encoded = encodeURIComponent(query);
    OVERPASS_SERVERS.forEach((server) => {
      fetch(`${server}?data=${encoded}`)
        .then((r) => { if (!r.ok) throw new Error("non-ok"); return r.json(); })
        .then((data) => { if (!settled) { settled = true; resolve(data); } })
        .catch(() => { errors++; if (errors === OVERPASS_SERVERS.length && !settled) reject(new Error("All Overpass servers failed")); });
    });
  });
}

async function fetchCourseData(courseName: string): Promise<{ greens: HoleGreen[]; features: CourseFeature[] }> {
  const cacheKey = `course_data_v2_${courseName}`;

  // Check localStorage first — persists across sessions so second open is instant
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Invalidate cache older than 7 days
      if (parsed._ts && Date.now() - parsed._ts < 7 * 24 * 60 * 60 * 1000
          && Array.isArray(parsed.greens) && Array.isArray(parsed.features)) {
        return { greens: parsed.greens, features: parsed.features };
      }
    }
  } catch { /* ignore */ }

  // Faster query: use a bbox approach by searching for named golf course ways/relations
  // then fetch their child elements with geometry — avoids slow planet-wide area search
  const safeName = courseName.replace(/"/g, "").replace(/'/g, "");
  const query = `
    [out:json][timeout:30];
    (
      way["leisure"="golf_course"]["name"~"${safeName}",i];
      relation["leisure"="golf_course"]["name"~"${safeName}",i];
    )->.course;
    map_to_area->.courseArea;
    (
      way["golf"~"fairway|green|bunker|rough|water_hazard|tee"](area.courseArea);
      relation["golf"~"fairway|green|bunker|rough|tee"](area.courseArea);
      way["natural"="sand"](area.courseArea);
      way["natural"="water"](area.courseArea);
    );
    out body geom qt;
  `;

  const data = await fetchWithFallback(query);

  const greens: HoleGreen[] = [];
  const features: CourseFeature[] = [];

  data.elements.forEach((el: any) => {
    const tags = el.tags || {};
    const holeRaw = tags["ref"] || tags["hole"] || tags["name"] || "";
    const holeNum = parseInt(holeRaw.replace(/\D/g, "")) || undefined;

    // Determine feature type
    let featureType: CourseFeature["type"] | null = null;
    if (tags["golf"] === "fairway" || tags["landuse"] === "grass") featureType = "fairway";
    else if (tags["golf"] === "green") featureType = "green";
    else if (tags["golf"] === "bunker" || (tags["natural"] === "sand" && (tags["golf"] === "bunker" || tags["golf"] === "yes"))) featureType = "bunker";
    else if (tags["golf"] === "water_hazard" || (tags["natural"] === "water" && (tags["golf"] === "water_hazard" || tags["golf"] === "yes"))) featureType = "water";
    else if (tags["golf"] === "rough" || (tags["natural"] === "scrub" && (tags["golf"] === "rough" || tags["golf"] === "yes"))) featureType = "rough";
    else if (tags["golf"] === "tee") featureType = "tee";

    if (!featureType) return;

    // Extract polygon coordinates
    let coords: [number, number][][] = [];
    if (el.type === "way" && el.geometry) {
      const ring: [number, number][] = el.geometry.map((n: { lat: number; lon: number }) => [n.lat, n.lon]);
      coords = [ring];
    } else if (el.type === "relation" && el.members) {
      // Multipolygon: outer + inner rings
      el.members.forEach((m: any) => {
        if (m.geometry) {
          const ring: [number, number][] = m.geometry.map((n: { lat: number; lon: number }) => [n.lat, n.lon]);
          coords.push(ring);
        }
      });
    }

    if (coords.length === 0) return;

    features.push({ type: featureType, hole: holeNum, coordinates: coords });

    // If it's a green, also compute centre for the greens array
    if (featureType === "green") {
      const ring = coords[0];
      const centLat = ring.reduce((s, c) => s + c[0], 0) / ring.length;
      const centLng = ring.reduce((s, c) => s + c[1], 0) / ring.length;
      greens.push({ hole: holeNum || greens.length + 1, lat: centLat, lng: centLng });
    }
  });

  // Sort greens by hole number
  greens.sort((a, b) => a.hole - b.hole);
  if (greens.length > 0 && greens.every(g => g.hole === 1)) {
    greens.forEach((g, i) => { g.hole = i + 1; });
  }

  const result = { greens, features };
  try { localStorage.setItem(cacheKey, JSON.stringify({ ...result, _ts: Date.now() })); } catch { /* ignore */ }
  return result;
}

// ─── Map component (Leaflet) ──────────────────────────────────────────────────

function LiveMap({
  greens,
  features,
  playerPos,
  activeHole,
  measureMode,
  measurePoint,
  onMeasurePoint,
  shots,
  onHoleSelect,
}: {
  greens: HoleGreen[];
  features: CourseFeature[];
  playerPos: PlayerPos | null;
  activeHole: number;
  measureMode: boolean;
  measurePoint: { lat: number; lng: number } | null;
  onMeasurePoint: (p: { lat: number; lng: number } | null) => void;
  shots: ShotLog[];
  onHoleSelect: (h: number) => void;
}) {
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const playerMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const lineRef = useRef<any>(null);
  const measureLineRef = useRef<any>(null);
  const measureMarkerRef = useRef<any>(null);
  const polygonsRef = useRef<any[]>([]);
  const shotMarkersRef = useRef<any[]>([]);
  const shotLineRef = useRef<any>(null);

  // Initialise map
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    if ((containerRef.current as any)._leaflet_id != null) {
      try { (containerRef.current as any)._leaflet_id = undefined; } catch { /* ignore */ }
    }

    let destroyed = false;

    import("leaflet").then((L) => {
      if (destroyed || !containerRef.current) return;
      leafletRef.current = L;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if ((containerRef.current as any)._leaflet_id != null) return;

      const centre = greens[0]
        ? { lat: greens[0].lat, lng: greens[0].lng }
        : { lat: -28.4793, lng: 24.6727 };

      const map = L.map(containerRef.current!, {
        center: [centre.lat, centre.lng],
        zoom: greens.length > 0 ? 17 : 7,
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true,
      });

      // Esri satellite tiles
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri", maxZoom: 20 }
      ).addTo(map);

      mapRef.current = map;

      // Draw all polygons once (fairways, bunkers, water, etc.)
      features.forEach((f) => {
        f.coordinates.forEach((ring) => {
          let style: any = {};
          if (f.type === "fairway") {
            style = { color: "#4ade80", fillColor: "#86efac", fillOpacity: 0.3, weight: 1 };
          } else if (f.type === "green") {
            style = { color: "#16a34a", fillColor: "#22c55e", fillOpacity: 0.5, weight: 2 };
          } else if (f.type === "bunker") {
            style = { color: "#d97706", fillColor: "#fbbf24", fillOpacity: 0.6, weight: 1 };
          } else if (f.type === "water") {
            style = { color: "#0ea5e9", fillColor: "#38bdf8", fillOpacity: 0.5, weight: 2 };
          } else if (f.type === "rough") {
            style = { color: "#65a30d", fillColor: "#a3e635", fillOpacity: 0.2, weight: 1 };
          } else if (f.type === "tee") {
            style = { color: "#ec4899", fillColor: "#f472b6", fillOpacity: 0.4, weight: 1 };
          }
          const poly = L.polygon(ring, style).addTo(map);
          polygonsRef.current.push(poly);
        });
      });

      // Draw green centre markers
      greens.forEach((g) => {
        const isActive = g.hole === activeHole;
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:${isActive ? 32 : 24}px;height:${isActive ? 32 : 24}px;
            border-radius:50%;background:${isActive ? "#16a34a" : "#6b7280"};
            border:3px solid white;display:flex;align-items:center;justify-content:center;
            font-size:${isActive ? 12 : 10}px;font-weight:700;color:white;
            box-shadow:0 2px 6px rgba(0,0,0,0.6);
          ">${g.hole}</div>`,
          iconSize: [isActive ? 32 : 24, isActive ? 32 : 24],
          iconAnchor: [isActive ? 16 : 12, isActive ? 16 : 12],
        });
        const m = L.marker([g.lat, g.lng], { icon })
          .addTo(map)
          .on("click", () => onHoleSelect(g.hole));
        markersRef.current.push({ hole: g.hole, marker: m });
      });
    });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];
      playerMarkerRef.current = null;
      accuracyCircleRef.current = null;
      lineRef.current = null;
      measureLineRef.current = null;
      measureMarkerRef.current = null;
      polygonsRef.current = [];
      shotMarkersRef.current = [];
      shotLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greens, features]);

  // Update player marker
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !playerPos) return;

    if (playerMarkerRef.current) {
      playerMarkerRef.current.setLatLng([playerPos.lat, playerPos.lng]);
      accuracyCircleRef.current?.setLatLng([playerPos.lat, playerPos.lng]).setRadius(playerPos.accuracy);
    } else {
      const playerIcon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 3px rgba(37,99,235,0.4);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      playerMarkerRef.current = L.marker([playerPos.lat, playerPos.lng], { icon: playerIcon }).addTo(map);
      accuracyCircleRef.current = L.circle([playerPos.lat, playerPos.lng], {
        radius: playerPos.accuracy,
        color: "#2563eb",
        fillColor: "#93c5fd",
        fillOpacity: 0.15,
        weight: 1,
      }).addTo(map);
    }
  }, [playerPos]);

  // Line from player to active green
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    lineRef.current?.remove();
    lineRef.current = null;

    const green = greens.find((g) => g.hole === activeHole);
    if (!green || !playerPos) return;

    lineRef.current = L.polyline(
      [[playerPos.lat, playerPos.lng], [green.lat, green.lng]],
      { color: "#f59e0b", weight: 2, dashArray: "6 4", opacity: 0.9 }
    ).addTo(map);
  }, [playerPos, activeHole, greens]);

  // Measure mode: tap to set measure point
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    const handleClick = (e: any) => {
      if (!measureMode) return;
      onMeasurePoint({ lat: e.latlng.lat, lng: e.latlng.lng });
    };

    map.on("click", handleClick);
    return () => { map.off("click", handleClick); };
  }, [measureMode, onMeasurePoint]);

  // Draw measure line and marker when measurePoint is set
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    measureLineRef.current?.remove();
    measureLineRef.current = null;
    measureMarkerRef.current?.remove();
    measureMarkerRef.current = null;

    if (!measurePoint || !playerPos) return;

    measureLineRef.current = L.polyline(
      [[playerPos.lat, playerPos.lng], [measurePoint.lat, measurePoint.lng]],
      { color: "#ec4899", weight: 3, opacity: 0.9 }
    ).addTo(map);

    const measureIcon = L.divIcon({
      className: "",
      html: `<div style="width:16px;height:16px;border-radius:50%;background:#ec4899;border:3px solid white;box-shadow:0 0 0 3px rgba(236,72,153,0.4);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    measureMarkerRef.current = L.marker([measurePoint.lat, measurePoint.lng], { icon: measureIcon }).addTo(map);
  }, [measurePoint, playerPos]);

  // Draw shot trail for active hole
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    shotMarkersRef.current.forEach(m => m.remove());
    shotMarkersRef.current = [];
    shotLineRef.current?.remove();
    shotLineRef.current = null;

    const holeShots = shots.filter(s => s.hole === activeHole).sort((a, b) => a.shotNumber - b.shotNumber);
    if (holeShots.length === 0) return;

    // Draw shot trail line
    const coords = holeShots.map(s => [s.lat, s.lng]);
    shotLineRef.current = L.polyline(coords, { color: "#8b5cf6", weight: 2, dashArray: "4 4", opacity: 0.8 }).addTo(map);

    // Draw shot markers with number
    holeShots.forEach((s) => {
      const shotIcon = L.divIcon({
        className: "",
        html: `<div style="width:24px;height:24px;border-radius:50%;background:#8b5cf6;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;box-shadow:0 1px 4px rgba(0,0,0,0.5);">${s.shotNumber}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const m = L.marker([s.lat, s.lng], { icon: shotIcon }).addTo(map);
      shotMarkersRef.current.push(m);
    });
  }, [shots, activeHole]);

  // Pan to active green
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const green = greens.find((g) => g.hole === activeHole);
    if (green) map.setView([green.lat, green.lng], 17, { animate: true });

    // Update markers
    markersRef.current.forEach(({ hole, marker }) => {
      const L = leafletRef.current;
      if (!L) return;
      const isActive = hole === activeHole;
      marker.setIcon(
        L.divIcon({
          className: "",
          html: `<div style="width:${isActive ? 32 : 24}px;height:${isActive ? 32 : 24}px;border-radius:50%;background:${isActive ? "#16a34a" : "#6b7280"};border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:${isActive ? 12 : 10}px;font-weight:700;color:white;box-shadow:0 2px 6px rgba(0,0,0,0.6);">${hole}</div>`,
          iconSize: [isActive ? 32 : 24, isActive ? 32 : 24],
          iconAnchor: [isActive ? 16 : 12, isActive ? 16 : 12],
        })
      );
    });
  }, [activeHole, greens]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function CourseMapModal({ courseName, totalHoles, onClose }: CourseMapModalProps) {
  const [greens, setGreens] = useState<HoleGreen[]>([]);
  const [features, setFeatures] = useState<CourseFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [playerPos, setPlayerPos] = useState<PlayerPos | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [activeHole, setActiveHole] = useState(1);
  const [unit, setUnit] = useState<"m" | "yd">("m");
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoint, setMeasurePoint] = useState<{ lat: number; lng: number } | null>(null);
  const [shots, setShots] = useState<ShotLog[]>([]);
  const watchIdRef = useRef<number | null>(null);

  // Fetch course data — map renders immediately, features overlay as they arrive
  useEffect(() => {
    let cancelled = false;
    // Don't block map render — show map straight away, features load in background
    setLoading(false);
    setFetchError(null);

    fetchCourseData(courseName)
      .then(({ greens: g, features: f }) => {
        if (!cancelled) {
          setGreens(g);
          setFeatures(f);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchError("Course overlay unavailable — map still usable.");
        }
      });

    return () => { cancelled = true; };
  }, [courseName]);

  // Watch GPS — two-phase: fast network fix first, then high-accuracy watch
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS not available.");
      return;
    }

    // Phase 1: immediate low-accuracy fix for instant display
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlayerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsError(null);
      },
      () => { /* ignore — phase 2 will handle */ },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 6000 }
    );

    // Phase 2: high-accuracy watch refines continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPlayerPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsError(null);
      },
      (err) => {
        if (err.code === 1) setGpsError("Location denied.");
        // Don't set error for timeout — phase 1 already gave an approximate fix
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // Compute distances
  const activeGreen = greens.find((g) => g.hole === activeHole);
  const distanceRaw = playerPos && activeGreen
    ? haversineMetres(playerPos.lat, playerPos.lng, activeGreen.lat, activeGreen.lng)
    : null;
  const distanceDisplay = distanceRaw != null
    ? unit === "m" ? `${Math.round(distanceRaw)} m` : `${metresToYards(distanceRaw)} yds`
    : null;

  const measureDist = measurePoint && playerPos
    ? haversineMetres(playerPos.lat, playerPos.lng, measurePoint.lat, measurePoint.lng)
    : null;
  const measureDisplay = measureDist != null
    ? unit === "m" ? `${Math.round(measureDist)} m` : `${metresToYards(measureDist)} yds`
    : null;

  const holes = Array.from({ length: totalHoles }, (_, i) => i + 1);

  // Log shot
  const handleLogShot = () => {
    if (!playerPos) return;
    const holeShots = shots.filter(s => s.hole === activeHole);
    const shotNumber = holeShots.length + 1;
    setShots([...shots, { hole: activeHole, lat: playerPos.lat, lng: playerPos.lng, timestamp: Date.now(), shotNumber }]);
  };

  // Clear shots for active hole
  const handleClearShots = () => {
    setShots(shots.filter(s => s.hole !== activeHole));
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 shrink-0">
        <div>
          <div className="text-sm font-bold text-white leading-tight">{courseName}</div>
          <div className="text-[10px] text-slate-400">GPS Course Map</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUnit(u => u === "m" ? "yd" : "m")}
            className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
          >
            {unit === "m" ? "Yds" : "M"}
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700 text-white hover:bg-slate-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Distance banner — primary read at a glance */}
      <div className="shrink-0 bg-slate-800 border-b border-slate-700">
        <div className="flex items-stretch">
          {/* Green dot + label */}
          <div className="flex flex-col items-center justify-center px-4 border-r border-slate-700 gap-1">
            <div className="w-4 h-4 rounded-full bg-green-500 shrink-0" />
            <span className="text-[9px] text-slate-400 font-medium leading-none">Hole {activeHole}</span>
          </div>
          {/* Distance — hero number */}
          <div className="flex-1 flex flex-col items-center justify-center py-3">
            {distanceRaw != null ? (
              <>
                <div className="text-5xl font-black text-white tracking-tight leading-none tabular-nums">
                  {unit === "m" ? Math.round(distanceRaw) : metresToYards(distanceRaw)}
                </div>
                <div className="text-[11px] font-semibold text-green-400 mt-0.5 uppercase tracking-widest">
                  {unit === "m" ? "Metres to Centre" : "Yards to Centre"}
                </div>
              </>
            ) : gpsError ? (
              <div className="text-sm font-semibold text-amber-400">{gpsError}</div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-[10px] text-slate-500">Acquiring GPS...</div>
              </div>
            )}
          </div>
          {/* Measure distance (if active) */}
          {measureDist != null && (
            <div className="flex flex-col items-center justify-center px-4 border-l border-slate-700 gap-0.5">
              <div className="text-xl font-black text-pink-400 tabular-nums leading-none">
                {unit === "m" ? Math.round(measureDist) : metresToYards(measureDist)}
              </div>
              <div className="text-[8px] text-pink-500 font-semibold uppercase tracking-wide">
                {unit === "m" ? "m tap" : "yds tap"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Measure & shot controls */}
      {!loading && !fetchError && (
        <div className="shrink-0 bg-slate-900 px-4 py-2 flex items-center gap-2 border-b border-slate-700">
          <button
            onClick={() => { setMeasureMode(!measureMode); setMeasurePoint(null); }}
            className={`text-[10px] font-semibold px-3 py-1.5 rounded-md transition-colors ${measureMode ? "bg-pink-600 text-white" : "bg-slate-700 text-slate-200 hover:bg-slate-600"}`}
          >
            {measureMode ? "Exit Measure" : "Tap to Measure"}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleLogShot}
              disabled={!playerPos}
              className="text-[10px] font-semibold px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
            >
              Log Shot
            </button>
            {shots.filter(s => s.hole === activeHole).length > 0 && (
              <button
                onClick={handleClearShots}
                className="text-[10px] font-semibold px-2 py-1.5 rounded-md bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* GPS accuracy */}
      {playerPos && (
        <div className="shrink-0 px-4 py-1 bg-slate-900 flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${playerPos.accuracy < 15 ? "bg-green-400" : playerPos.accuracy < 40 ? "bg-amber-400" : "bg-red-400"}`} />
          <span className="text-[9px] text-slate-500">
            GPS ±{Math.round(playerPos.accuracy)}m
          </span>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative overflow-hidden">
        {/* Subtle top banner while course features are loading — map is already visible */}
        {greens.length === 0 && !fetchError && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 bg-slate-800/90 text-slate-200 text-[10px] font-medium px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm pointer-events-none">
            <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin shrink-0" />
            Loading course overlay...
          </div>
        )}
        {fetchError && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 bg-amber-800/90 text-amber-200 text-[10px] font-medium px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm pointer-events-none">
            {fetchError}
          </div>
        )}
        <LiveMap
          key={courseName}
          greens={greens}
          features={features}
          playerPos={playerPos}
          activeHole={activeHole}
          measureMode={measureMode}
          measurePoint={measurePoint}
          onMeasurePoint={setMeasurePoint}
          shots={shots}
          onHoleSelect={setActiveHole}
        />
      </div>

      {/* Hole selector strip */}
      <div className="shrink-0 bg-slate-900 border-t border-slate-700 px-2 py-2 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {holes.map((h) => {
            const green = greens.find((g) => g.hole === h);
            const dist = playerPos && green
              ? haversineMetres(playerPos.lat, playerPos.lng, green.lat, green.lng)
              : null;
            const distLabel = dist != null
              ? unit === "m" ? `${Math.round(dist)}m` : `${metresToYards(dist)}y`
              : "—";
            const isActive = h === activeHole;
            const holeShots = shots.filter(s => s.hole === h);

            return (
              <button
                key={h}
                onClick={() => setActiveHole(h)}
                className={`flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 min-w-[44px] transition-colors relative ${
                  isActive ? "bg-green-600 text-white" : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                }`}
              >
                {holeShots.length > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center text-[8px] font-bold text-white border border-slate-900">
                    {holeShots.length}
                  </div>
                )}
                <span className="text-[10px] font-bold leading-none">{h}</span>
                <span className={`text-[8px] mt-0.5 leading-none ${isActive ? "text-green-200" : "text-slate-500"}`}>
                  {distLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="shrink-0 bg-slate-900 px-4 pb-3 pt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] text-slate-500">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500" /><span>You</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-2 bg-green-500" /><span>Green</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-2 bg-lime-400" /><span>Fairway</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-2 bg-yellow-400" /><span>Bunker</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-2 bg-sky-400" /><span>Water</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-purple-600" /><span>Shots</span></div>
      </div>
    </div>
  );
}
