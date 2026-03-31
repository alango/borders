declare module "react-simple-maps" {
  import * as React from "react";

  interface Geography {
    rsmKey: string;
    id: string | number;
    properties: Record<string, unknown>;
    [key: string]: unknown;
  }

  interface GeographiesChildProps {
    geographies: Geography[];
  }

  interface ComposableMapProps {
    projection?: string;
    style?: React.CSSProperties;
    className?: string;
    children?: React.ReactNode;
    [key: string]: unknown;
  }

  interface GeographiesProps {
    geography: string | object;
    children: (props: GeographiesChildProps) => React.ReactNode;
    [key: string]: unknown;
  }

  interface GeographyProps {
    geography: Geography;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: {
      default?: React.CSSProperties;
      hover?: React.CSSProperties;
      pressed?: React.CSSProperties;
    };
    key?: string;
    [key: string]: unknown;
  }

  export const ComposableMap: React.FC<ComposableMapProps>;
  export const Geographies: React.FC<GeographiesProps>;
  export const Geography: React.FC<GeographyProps>;
  export const Sphere: React.FC<Record<string, unknown>>;
  export const Graticule: React.FC<Record<string, unknown>>;
  export const Marker: React.FC<Record<string, unknown>>;
  export const Line: React.FC<Record<string, unknown>>;
  export const ZoomableGroup: React.FC<Record<string, unknown>>;
}
