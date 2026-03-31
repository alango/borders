"use client";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface WorldMapProps {
  highlightCountryId: string;   // numeric ID of main country
  borderCountryIds?: string[];  // numeric IDs of border countries (shown after reveal)
}

export function WorldMap({ highlightCountryId, borderCountryIds = [] }: WorldMapProps) {
  return (
    <ComposableMap projection="geoNaturalEarth1" style={{ width: "100%", height: "auto" }}>
      <Geographies geography={GEO_URL}>
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
