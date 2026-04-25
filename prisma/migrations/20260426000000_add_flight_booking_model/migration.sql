-- CreateTable
CREATE TABLE "FlightBooking" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "confirmationCode" TEXT,
    "airline" TEXT,
    "cabinClass" TEXT NOT NULL DEFAULT 'economy',
    "seatNumbers" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'saved',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlightBooking_tripId_idx" ON "FlightBooking"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_trip_confirmation" ON "FlightBooking"("tripId", "confirmationCode");

-- AddForeignKey
ALTER TABLE "FlightBooking" ADD CONSTRAINT "FlightBooking_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Flight" ADD COLUMN "flightBookingId" TEXT;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_flightBookingId_fkey" FOREIGN KEY ("flightBookingId") REFERENCES "FlightBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
