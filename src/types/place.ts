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
  capacity: number;
  hourlyRate: number;
  operatingHours: string;
}

export type Place = Restaurant | Cafe | ParkingLot;

export interface Bounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export interface SearchResult {
  persona: string;
  recommendations: {
    order: number;
    id: string;
    type: PlaceType;
    reason: string;
  }[];
  routeSummary: string;
  places: Place[];
}
