ALTER TYPE "NotificationType" ADD VALUE 'FORUM_POSTED';

CREATE TABLE "ForumPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ForumPost_publishedAt_idx" ON "ForumPost"("publishedAt");
CREATE INDEX "ForumPost_authorId_idx" ON "ForumPost"("authorId");

ALTER TABLE "ForumPost"
ADD CONSTRAINT "ForumPost_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
