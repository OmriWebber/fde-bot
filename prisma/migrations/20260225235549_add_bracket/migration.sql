/*
  Warnings:

  - You are about to drop the column `proximity` on the `Result` table. All the data in the column will be lost.
  - You are about to drop the column `speed` on the `Result` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Result" DROP COLUMN "proximity",
DROP COLUMN "speed",
ADD COLUMN     "line" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "BracketTournament" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BracketTournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketMatchRecord" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "leadDriverId" TEXT,
    "chaseDriverId" TEXT,
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BracketMatchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BracketTournament_roundId_key" ON "BracketTournament"("roundId");

-- AddForeignKey
ALTER TABLE "BracketTournament" ADD CONSTRAINT "BracketTournament_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketMatchRecord" ADD CONSTRAINT "BracketMatchRecord_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "BracketTournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
