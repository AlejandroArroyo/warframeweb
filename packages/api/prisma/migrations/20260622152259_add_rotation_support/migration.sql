-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "rotationGroupId" TEXT,
ADD COLUMN     "rotationRound" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "rotationTotal" INTEGER NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "RotationGroup" (
    "id" TEXT NOT NULL,
    "relicEra" "RelicEra" NOT NULL,
    "relicName" TEXT NOT NULL,
    "totalRounds" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RotationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RotationGroup_createdAt_idx" ON "RotationGroup"("createdAt");

-- CreateIndex
CREATE INDEX "Lobby_rotationGroupId_idx" ON "Lobby"("rotationGroupId");

-- AddForeignKey
ALTER TABLE "Lobby" ADD CONSTRAINT "Lobby_rotationGroupId_fkey" FOREIGN KEY ("rotationGroupId") REFERENCES "RotationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
