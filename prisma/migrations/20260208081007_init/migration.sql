-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "priceRange" TEXT NOT NULL,
    "atmosphere" TEXT NOT NULL,
    "goodFor" TEXT NOT NULL,
    "rating" REAL NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "parkingAvailable" BOOLEAN NOT NULL DEFAULT false,
    "nearbyParking" TEXT
);

-- CreateTable
CREATE TABLE "Cafe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "priceRange" TEXT NOT NULL,
    "atmosphere" TEXT NOT NULL,
    "goodFor" TEXT NOT NULL,
    "rating" REAL NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "parkingAvailable" BOOLEAN NOT NULL DEFAULT false,
    "nearbyParking" TEXT
);

-- CreateTable
CREATE TABLE "ParkingLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "capacity" INTEGER NOT NULL,
    "hourlyRate" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "operatingHours" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Restaurant_lat_lng_idx" ON "Restaurant"("lat", "lng");

-- CreateIndex
CREATE INDEX "Cafe_lat_lng_idx" ON "Cafe"("lat", "lng");

-- CreateIndex
CREATE INDEX "ParkingLot_lat_lng_idx" ON "ParkingLot"("lat", "lng");
