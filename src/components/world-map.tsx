"use client";
import { useEffect, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { feature } from "topojson-client";
import { geoCentroid, geoBounds } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import type { Topology } from "topojson-specification";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface WorldMapProps {
  highlightCountryId: string; // numeric ISO id
  borderCountryIds?: string[]; // shown in orange after reveal
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
  // scale = how many pixels per radian; aim for country to fill ~60% of viewport
  const scale = Math.min(3000, Math.max(150, 13750 / maxSpan));

  return { center: [lon, lat], scale };
}

export function WorldMap({
  highlightCountryId,
  borderCountryIds = [],
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
    </ComposableMap>
  );
}
