export type PlaceType = "restaurant" | "cafe" | "parking";

export interface BasePlace {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  type: PlaceType;
}

export interface Restaurant extends BasePlace {
  type: "restaurant";
  category: string;
  priceRange: string;
  atmosphere: string;
  goodFor: string;
  rating: number;
  reviewCount: number;
  parkingAvailable: boolean;
  nearbyParking: string | null;
}

export interface Cafe extends BasePlace {
  type: "cafe";
  specialty: string;
  priceRange: string;
  atmosphere: string;
  goodFor: string;
  rating: number;
  reviewCount: number;
  parkingAvailable: boolean;
  nearbyParking: string | null;
}

export interface ParkingLot extends BasePlace {
  type: "parking";
  parkingType: string;
  address?: string;
  capacity: number;
  hourlyRate: number;
  baseTime?: number;
  baseRate?: number;
  extraTime?: number;
  extraRate?: number;
  freeNote?: string;
  operatingHours: string;
}

export type Place = Restaurant | Cafe | ParkingLot;

export interface Bounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export interface CourseStop {
  order: number;
  id: string;
  type: PlaceType;
  reason: string;
}

export interface Course {
  courseNumber: number;
  title: string;
  stops: CourseStop[];
  routeSummary: string;
}

export interface SearchResult {
  summary: string;
  persona: string;
  courses: Course[];
  /** Derived from selected course — used by RouteMarkers */
  recommendations: CourseStop[];
  routeSummary: string;
  places: Place[];
  center?: { lat: number; lng: number; name: string };
}
