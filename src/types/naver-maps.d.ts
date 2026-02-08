declare namespace naver.maps {
  class Map {
    constructor(element: HTMLElement, options: MapOptions);
    setCenter(latlng: LatLng): void;
    getCenter(): LatLng;
    setZoom(level: number): void;
    getZoom(): number;
    getBounds(): LatLngBounds;
    panTo(latlng: LatLng, transitionOptions?: object): void;
    destroy(): void;
  }

  interface MapOptions {
    center: LatLng;
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    zoomControl?: boolean;
    zoomControlOptions?: {
      position?: number;
    };
    mapTypeControl?: boolean;
    scaleControl?: boolean;
  }

  class LatLng {
    constructor(lat: number, lng: number);
    lat(): number;
    lng(): number;
  }

  class LatLngBounds {
    constructor(sw: LatLng, ne: LatLng);
    getSW(): LatLng;
    getNE(): LatLng;
    hasLatLng(latlng: LatLng): boolean;
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
    setPosition(latlng: LatLng): void;
    getPosition(): LatLng;
    setIcon(icon: string | ImageIcon | HtmlIcon): void;
    setZIndex(zIndex: number): void;
  }

  interface MarkerOptions {
    position: LatLng;
    map?: Map;
    icon?: string | ImageIcon | HtmlIcon;
    zIndex?: number;
    clickable?: boolean;
    title?: string;
  }

  interface ImageIcon {
    url?: string;
    content?: string;
    size?: Size;
    anchor?: Point;
    origin?: Point;
    scaledSize?: Size;
  }

  interface HtmlIcon {
    content: string;
    size?: Size;
    anchor?: Point;
  }

  class Polyline {
    constructor(options: PolylineOptions);
    setMap(map: Map | null): void;
  }

  interface PolylineOptions {
    map?: Map;
    path: LatLng[];
    strokeColor?: string;
    strokeWeight?: number;
    strokeOpacity?: number;
    strokeStyle?: string;
    strokeLineCap?: string;
    strokeLineJoin?: string;
  }

  class InfoWindow {
    constructor(options: InfoWindowOptions);
    open(map: Map, marker?: Marker): void;
    close(): void;
    setContent(content: string | HTMLElement): void;
  }

  interface InfoWindowOptions {
    content: string | HTMLElement;
    borderWidth?: number;
    borderColor?: string;
    backgroundColor?: string;
    anchorSize?: Size;
    pixelOffset?: Point;
    disableAnchor?: boolean;
    maxWidth?: number;
  }

  class Size {
    constructor(width: number, height: number);
    width: number;
    height: number;
  }

  class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  class Event {
    static addListener(
      target: object,
      type: string,
      listener: (...args: unknown[]) => void
    ): MapEventListener;
    static removeListener(listener: MapEventListener): void;
  }

  interface MapEventListener {
    eventName: string;
    target: object;
    listener: (...args: unknown[]) => void;
  }

  const Position: {
    TOP_LEFT: number;
    TOP_CENTER: number;
    TOP_RIGHT: number;
    LEFT_CENTER: number;
    LEFT_TOP: number;
    LEFT_BOTTOM: number;
    RIGHT_TOP: number;
    RIGHT_CENTER: number;
    RIGHT_BOTTOM: number;
    BOTTOM_LEFT: number;
    BOTTOM_CENTER: number;
    BOTTOM_RIGHT: number;
  };
}

interface Window {
  naver: typeof naver;
}
