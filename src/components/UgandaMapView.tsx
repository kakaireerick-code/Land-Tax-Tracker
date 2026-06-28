import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Rectangle,
  LayersControl,
  ZoomControl,
  ScaleControl,
  useMap,
} from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import { Map, Maximize2, RotateCcw } from 'lucide-react';
import { DISTRICT_REGION_MAP, REGION_DESCRIPTIONS, type UgandaRegion } from '../data/districts';
import { calculatePenalty, formatCurrency } from '../lib/helpers';
import type { Property } from '../property';

import 'leaflet/dist/leaflet.css';

const UGANDA_CENTER: [number, number] = [1.3733, 32.2903];
const UGANDA_ZOOM = 7;
const UGANDA_BOUNDS: LatLngBoundsExpression = [[-1.85, 28.4], [4.65, 35.2]];

type RegionKey = 'central' | 'eastern' | 'northern' | 'western';

const REGIONS: Record<
  RegionKey,
  { name: string; region: UgandaRegion; bounds: LatLngBoundsExpression; description: string }
> = {
  central: {
    name: 'Central Region',
    region: 'Central',
    bounds: [[-0.55, 31.2], [1.15, 33.4]],
    description: REGION_DESCRIPTIONS.Central,
  },
  eastern: {
    name: 'Eastern Region',
    region: 'Eastern',
    bounds: [[-0.15, 32.8], [1.65, 35.0]],
    description: REGION_DESCRIPTIONS.Eastern,
  },
  northern: {
    name: 'Northern Region',
    region: 'Northern',
    bounds: [[1.35, 30.8], [4.55, 34.2]],
    description: REGION_DESCRIPTIONS.Northern,
  },
  western: {
    name: 'Western Region',
    region: 'Western',
    bounds: [[-1.55, 29.2], [1.05, 31.6]],
    description: REGION_DESCRIPTIONS.Western,
  },
};

function markerStyle(p: Property) {
  if (p.status === 'paid') return { color: '#16a34a', fill: '#22c55e', radius: 7 };
  if (p.enforcementStage === 'legal_action') return { color: '#450a0a', fill: '#7a0000', radius: 9 };
  if (p.status === 'delinquent') return { color: '#7f1d1d', fill: '#C8102E', radius: 8 };
  return { color: '#a16207', fill: '#eab308', radius: 7 };
}

function MapNavigator({
  target,
  resetKey,
}: {
  target: { bounds: LatLngBoundsExpression } | { center: [number, number]; zoom: number } | null;
  resetKey: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    if ('bounds' in target) {
      map.flyToBounds(target.bounds, { padding: [48, 48], duration: 1.1, maxZoom: 11 });
    } else {
      map.flyTo(target.center, target.zoom, { duration: 1.1 });
    }
  }, [target, resetKey, map]);

  return null;
}

function DistrictSummaryLayer({
  properties,
  visible,
  onDistrictClick,
}: {
  properties: Property[];
  visible: boolean;
  onDistrictClick: (district: string, bounds: LatLngBoundsExpression) => void;
}) {
  const districts = useMemo(() => {
    const byDistrict = new globalThis.Map<string, { lat: number; lng: number; count: number; delinquent: number }>();
    properties.forEach((p) => {
      if (!p.lat || !p.lng) return;
      const prev = byDistrict.get(p.district);
      if (!prev) {
        byDistrict.set(p.district, { lat: p.lat, lng: p.lng, count: 1, delinquent: p.status === 'delinquent' ? 1 : 0 });
      } else {
        prev.lat = (prev.lat * prev.count + p.lat) / (prev.count + 1);
        prev.lng = (prev.lng * prev.count + p.lng) / (prev.count + 1);
        prev.count += 1;
        if (p.status === 'delinquent') prev.delinquent += 1;
      }
    });
    return [...byDistrict.entries()];
  }, [properties]);

  if (!visible) return null;

  return (
    <>
      {districts.map(([district, data]) => {
        const fill =
          data.delinquent >= 3 ? '#ef4444' : data.delinquent >= 1 ? '#f97316' : '#22c55e';
        const bounds: LatLngBoundsExpression = [
          [data.lat - 0.08, data.lng - 0.08],
          [data.lat + 0.08, data.lng + 0.08],
        ];
        return (
          <CircleMarker
            key={district}
            center={[data.lat, data.lng]}
            radius={10 + Math.min(data.count, 8)}
            pathOptions={{ color: '#fff', weight: 2, fillColor: fill, fillOpacity: 0.75 }}
            eventHandlers={{
              click: () => onDistrictClick(district, bounds),
            }}
          >
            <Popup>
              <div className="text-sm min-w-[140px]">
                <p className="font-bold">{district}</p>
                <p>{data.count} propert{data.count === 1 ? 'y' : 'ies'}</p>
                <p className="text-red-600">{data.delinquent} delinquent</p>
                <p className="text-xs text-gray-500 mt-1">Click to zoom in</p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

export function UgandaMapView({
  properties,
  onSelectProperty,
}: {
  properties: Property[];
  onSelectProperty: (p: Property) => void;
}) {
  const [mapReady, setMapReady] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<RegionKey | null>(null);
  const [flyTarget, setFlyTarget] = useState<
    { bounds: LatLngBoundsExpression } | { center: [number, number]; zoom: number } | null
  >(null);
  const [resetKey, setResetKey] = useState(0);
  const [showDistrictSummary, setShowDistrictSummary] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  useEffect(() => {
    setMapReady(true);
    return () => setMapReady(false);
  }, []);

  const mappable = useMemo(
    () => properties.filter((p) => p.lat !== 0 && p.lng !== 0),
    [properties],
  );

  const regionStats = useMemo(() => {
    const stats: Record<
      RegionKey,
      { properties: Property[]; delinquent: number; totalOwed: number }
    > = {} as never;

    (Object.keys(REGIONS) as RegionKey[]).forEach((key) => {
      const regionProperties = properties.filter(
        (p) => DISTRICT_REGION_MAP[p.district] === REGIONS[key].region,
      );
      const delinquent = regionProperties.filter((p) => p.status === 'delinquent');
      let totalOwed = 0;
      delinquent.forEach((p) => {
        totalOwed += calculatePenalty(p.annualTaxDue, p.taxDueDate).totalOwed;
      });
      stats[key] = {
        properties: regionProperties,
        delinquent: delinquent.length,
        totalOwed,
      };
    });
    return stats;
  }, [properties]);

  const visibleProperties = useMemo(() => {
    let list = mappable;
    if (selectedRegion) {
      list = list.filter(
        (p) => DISTRICT_REGION_MAP[p.district] === REGIONS[selectedRegion].region,
      );
    }
    if (selectedDistrict) {
      list = list.filter((p) => p.district === selectedDistrict);
    }
    return list;
  }, [mappable, selectedRegion, selectedDistrict]);

  const selectedRegionData = selectedRegion
    ? { ...REGIONS[selectedRegion], stats: regionStats[selectedRegion] }
    : null;

  const focusRegion = (key: RegionKey) => {
    setSelectedRegion(key);
    setSelectedDistrict(null);
    setShowDistrictSummary(false);
    setFlyTarget({ bounds: REGIONS[key].bounds });
  };

  const resetView = () => {
    setSelectedRegion(null);
    setSelectedDistrict(null);
    setShowDistrictSummary(true);
    setFlyTarget({ center: UGANDA_CENTER, zoom: UGANDA_ZOOM });
    setResetKey((k) => k + 1);
  };

  return (
    <div
      className="flex flex-col gap-4"
      style={{ height: 'calc(100vh - 120px)', minHeight: '640px' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">Uganda Map</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Pan, scroll to zoom, or use +/- controls. Switch to satellite for terrain detail.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REGIONS) as RegionKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => focusRegion(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedRegion === key
                  ? 'bg-[#C8102E] text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {REGIONS[key].name.replace(' Region', '')}
            </button>
          ))}
          <button
            type="button"
            onClick={resetView}
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-800 text-white hover:bg-gray-700 flex items-center gap-1.5"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        <div className="flex-1 relative rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 min-w-0">
          {!mapReady ? (
            <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm">
              Loading map…
            </div>
          ) : (
          <MapContainer
            key="uganda-interactive-map"
            center={UGANDA_CENTER}
            zoom={UGANDA_ZOOM}
            minZoom={6}
            maxZoom={18}
            maxBounds={UGANDA_BOUNDS}
            maxBoundsViscosity={0.85}
            scrollWheelZoom
            zoomControl={false}
            className="h-full w-full z-0"
            style={{ height: '100%', width: '100%', background: '#e5e7eb' }}
          >
            <ZoomControl position="topright" />
            <ScaleControl position="bottomleft" imperial={false} />

            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Street Map">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxZoom={19}
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Satellite">
                <TileLayer
                  attribution="Tiles &copy; Esri"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Terrain">
                <TileLayer
                  attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
                  url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                  maxZoom={17}
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            {selectedRegion && (
              <Rectangle
                bounds={REGIONS[selectedRegion].bounds}
                pathOptions={{
                  color: '#C8102E',
                  weight: 3,
                  fillColor: '#C8102E',
                  fillOpacity: 0.08,
                  dashArray: '8 6',
                }}
              />
            )}

            <MapNavigator target={flyTarget} resetKey={resetKey} />

            <DistrictSummaryLayer
              properties={properties}
              visible={showDistrictSummary && !selectedDistrict}
              onDistrictClick={(district, bounds) => {
                setSelectedDistrict(district);
                setShowDistrictSummary(false);
                setFlyTarget({ bounds });
              }}
            />

            {!showDistrictSummary &&
              visibleProperties.map((p) => {
                const style = markerStyle(p);
                const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
                return (
                  <CircleMarker
                    key={p.id}
                    center={[p.lat, p.lng]}
                    radius={style.radius}
                    pathOptions={{
                      color: style.color,
                      fillColor: style.fill,
                      fillOpacity: 0.9,
                      weight: 2,
                    }}
                  >
                    <Popup maxWidth={280}>
                      <div className="text-sm space-y-1">
                        <p className="font-bold text-[#C8102E]">{p.plotNumber}</p>
                        <p>{p.ownerName}</p>
                        <p className="text-gray-600">{p.district} · {p.propertyType}</p>
                        <p className={p.status === 'paid' ? 'text-green-600' : 'text-red-600 font-semibold'}>
                          {p.status === 'paid'
                            ? 'Paid / Clear'
                            : `${formatCurrency(penalty.totalOwed)} owed`}
                        </p>
                        <button
                          type="button"
                          onClick={() => onSelectProperty(p)}
                          className="mt-2 w-full bg-[#C8102E] text-white text-xs py-1.5 rounded hover:bg-red-700"
                        >
                          View property details
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
          </MapContainer>
          )}

          <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 dark:bg-gray-900/95 backdrop-blur rounded-lg shadow-md px-3 py-2 text-xs space-y-1.5 pointer-events-none">
            <p className="font-semibold text-gray-800 dark:text-gray-100">Property status</p>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500" /> Paid</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-400" /> Partial</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#C8102E]" /> Delinquent</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#7a0000]" /> Legal action</div>
          </div>

          <div className="absolute top-3 left-3 z-[1000] bg-white/95 dark:bg-gray-900/95 backdrop-blur rounded-lg shadow-md px-3 py-2 text-xs pointer-events-none">
            <p className="font-semibold flex items-center gap-1 text-gray-800 dark:text-gray-100">
              <Maximize2 size={12} /> {visibleProperties.length} markers · zoom {showDistrictSummary ? 'district view' : 'property view'}
            </p>
            {selectedDistrict && (
              <p className="text-[#C8102E] font-medium mt-0.5">{selectedDistrict}</p>
            )}
          </div>
        </div>

        <aside className="w-full lg:w-80 shrink-0 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
          {selectedRegionData ? (
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">{selectedRegionData.name}</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block">Coverage</span>
                  <span>{selectedRegionData.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Properties on map</span>
                  <span className="font-bold">{selectedRegionData.stats.properties.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Delinquent</span>
                  <span className="font-bold text-red-600">{selectedRegionData.stats.delinquent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total owed</span>
                  <span className="font-bold text-red-600">{formatCurrency(selectedRegionData.stats.totalOwed)}</span>
                </div>
              </div>

              <h4 className="font-semibold">Top properties by debt</h4>
              <div className="space-y-2">
                {selectedRegionData.stats.properties
                  .filter((p) => p.status !== 'paid')
                  .map((p) => ({ ...p, penalty: calculatePenalty(p.annualTaxDue, p.taxDueDate) }))
                  .sort((a, b) => b.penalty.totalOwed - a.penalty.totalOwed)
                  .slice(0, 5)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setShowDistrictSummary(false);
                        setSelectedDistrict(p.district);
                        setFlyTarget({ center: [p.lat, p.lng], zoom: 13 });
                      }}
                      className="w-full flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-750 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                    >
                      <span className="text-sm truncate pr-2">{p.ownerName}</span>
                      <span className="text-sm font-bold text-red-600 shrink-0">
                        {formatCurrency(p.penalty.totalOwed)}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <Map size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-sm">Select a region above, or zoom into a district cluster on the map.</p>
              <p className="text-xs mt-3 text-gray-400">
                Use mouse wheel or pinch to zoom. Drag to pan across all 146 districts.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
