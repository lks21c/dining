-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "placeName" TEXT NOT NULL,
    "menuName" TEXT NOT NULL,
    "price" TEXT,
    "source" TEXT NOT NULL DEFAULT 'diningcode',
    "crawledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Menu_placeName_idx" ON "Menu"("placeName");

-- CreateIndex
CREATE UNIQUE INDEX "Menu_placeName_menuName_source_key" ON "Menu"("placeName", "menuName", "source");
