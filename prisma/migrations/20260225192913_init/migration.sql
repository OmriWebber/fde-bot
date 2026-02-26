-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('draft', 'active', 'complete');

-- CreateEnum
CREATE TYPE "RoundType" AS ENUM ('touge', 'circuit', 'wangan');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('upcoming', 'live', 'complete');

-- CreateEnum
CREATE TYPE "RegStatus" AS ENUM ('pending', 'confirmed', 'dns', 'dq');

-- CreateEnum
CREATE TYPE "XpEventType" AS ENUM ('participation', 'win', 'podium', 'season_complete', 'achievement', 'perfect_tandem', 'personal_best');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "gamertag" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "discordId" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Car" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "number" TEXT,
    "piClass" TEXT,
    "horsepower" INTEGER,
    "weight" INTEGER,
    "tireFrontWidth" TEXT,
    "tireRearWidth" TEXT,
    "tireCompound" TEXT,
    "liveryUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'draft',
    "roundsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoundType" NOT NULL DEFAULT 'touge',
    "status" "RoundStatus" NOT NULL DEFAULT 'upcoming',
    "scheduledAt" TIMESTAMP(3),
    "venue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "status" "RegStatus" NOT NULL DEFAULT 'pending',
    "seed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "angle" DOUBLE PRECISION,
    "proximity" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "style" DOUBLE PRECISION,
    "position" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" "XpEventType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "roundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_gamertag_key" ON "Driver"("gamertag");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_slug_key" ON "Driver"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Season_slug_key" ON "Season"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Result_registrationId_key" ON "Result"("registrationId");

-- AddForeignKey
ALTER TABLE "Car" ADD CONSTRAINT "Car_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
