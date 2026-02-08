-- CreateTable
CREATE TABLE "CrawledPlace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "address" TEXT,
    "lat" REAL,
    "lng" REAL,
    "phone" TEXT,
    "priceRange" TEXT,
    "atmosphere" TEXT,
    "goodFor" TEXT,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlaceSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crawledPlaceId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "rating" REAL,
    "reviewCount" INTEGER,
    "snippet" TEXT,
    "metadata" TEXT,
    "crawledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaceSource_crawledPlaceId_fkey" FOREIGN KEY ("crawledPlaceId") REFERENCES "CrawledPlace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CrawledPlace_lat_lng_idx" ON "CrawledPlace"("lat", "lng");

-- CreateIndex
CREATE INDEX "CrawledPlace_name_idx" ON "CrawledPlace"("name");

-- CreateIndex
CREATE INDEX "PlaceSource_source_idx" ON "PlaceSource"("source");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceSource_crawledPlaceId_source_key" ON "PlaceSource"("crawledPlaceId", "source");
