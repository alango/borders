"use client";
import { useEffect, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { feature } from "topojson-client";
import { geoCentroid, geoBounds } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import type { Topology } from "topojson-specification";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface WorldMapProps {
  highlightCountryId: string;              // numeric ISO id
  borderCountryIds?: string[];             // shown in orange after reveal
  labels?: Record<string, string>;         // numericId -> display name
}

type GeoFeature = Feature<Geometry> & { id?: string | number };
type GeoCollection = { type: "FeatureCollection"; features: GeoFeature[] };

function computeProjection(
  geoData: GeoCollection,
  countryId: string
): { center: [number, number]; scale: number } {
  const geo = geoData.features.find((f) => String(f.id) === countryId);
  if (!geo) return { center: [0, 20], scale: 150 };

  const [lon, lat] = geoCentroid(geo);
  const [[x0, y0], [x1, y1]] = geoBounds(geo);
  const maxSpan = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const scale = Math.min(3000, Math.max(150, 13750 / maxSpan));

  return { center: [lon, lat], scale };
}

export function WorldMap({
  highlightCountryId,
  borderCountryIds = [],
  labels,
}: WorldMapProps) {
  const [geoData, setGeoData] = useState<GeoCollection | null>(null);
  const [projConfig, setProjConfig] = useState<{
    center: [number, number];
    scale: number;
  }>({ center: [0, 20], scale: 150 });

  // Fetch and parse topology once
  useEffect(() => {
    fetch(GEO_URL)
      .then((r) => r.json())
      .then((topology: Topology) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const countries = feature(topology, (topology.objects as any).countries) as unknown as GeoCollection;
        setGeoData(countries);
      });
  }, []);

  // Recompute projection whenever the highlighted country changes
  useEffect(() => {
    if (!geoData || !highlightCountryId) return;
    setProjConfig(computeProjection(geoData, highlightCountryId));
  }, [geoData, highlightCountryId]);

  // Compute label positions from centroids
  const labelMarkers = useMemo(() => {
    if (!geoData || !labels) return [];
    return Object.entries(labels).flatMap(([id, name]) => {
      const geo = geoData.features.find((f) => String(f.id) === id);
      if (!geo) return [];
      const [lon, lat] = geoCentroid(geo);
      return [{ id, name, coordinates: [lon, lat] as [number, number] }];
    });
  }, [geoData, labels]);

  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={projConfig}
      style={{ width: "100%", height: "auto" }}
    >
      <Geographies geography={geoData ?? GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const isMain = String(geo.id) === highlightCountryId;
            const isBorder = borderCountryIds.includes(String(geo.id));
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={isMain ? "#2563eb" : isBorder ? "#f97316" : "#e5e7eb"}
                stroke="#ffffff"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none" },
                  pressed: { outline: "none" },
                }}
              />
            );
          })
        }
      </Geographies>
      {labelMarkers.map(({ id, name, coordinates }) => (
        <Marker key={id} coordinates={coordinates}>
          <text
            textAnchor="middle"
            fontSize={20}
            fontWeight="700"
            fill="#1e293b"
            stroke="#ffffff"
            strokeWidth={5}
            paintOrder="stroke"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {name}
          </text>
        </Marker>
      ))}
    </ComposableMap>
  );
}
