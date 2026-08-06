ALTER TABLE "User"
ADD COLUMN "contactPrivacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN "contactPrivacyVersion" TEXT;

ALTER TABLE "EmailLoginCode"
ADD COLUMN "contactPrivacyAcceptedAt" TIMESTAMP(3);
