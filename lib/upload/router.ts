import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

import { auth } from "@/lib/auth";
import {
  createSlidingWindowLimiter,
  UPLOAD_MAX_PER_WINDOW,
  UPLOAD_WINDOW_MS,
} from "@/lib/upload/limits";

const f = createUploadthing();

const uploadLimited = createSlidingWindowLimiter(UPLOAD_WINDOW_MS, UPLOAD_MAX_PER_WINDOW);

// Images referenced by EmailDocument blocks. Files land on UploadThing's CDN
// and the public URL is written into the document — never base64, never blobs.
//
// Uploaded files are never deleted by the app. A URL written into a document
// can live on in a sent email, a reused campaign or a template, none of which
// the editor can see, so removing a file because one document stopped using
// it breaks the others.
//
// Size caps: the editor scales stills to 1200px wide before upload, so 4MB is
// generous for PNG/JPEG/WebP. GIFs pass through unscaled to keep their
// animation, hence the higher cap. Types are mirrored by EMAIL_IMAGE_TYPES in
// lib/upload/limits.ts.
export const uploadRouter = {
  emailImage: f({
    "image/png": { maxFileSize: "4MB", maxFileCount: 1 },
    "image/jpeg": { maxFileSize: "4MB", maxFileCount: 1 },
    "image/webp": { maxFileSize: "4MB", maxFileCount: 1 },
    "image/gif": { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await auth();
      const userId = session?.user?.id;
      if (!userId) throw new UploadThingError("Sign in to upload images");
      if (uploadLimited(userId)) {
        throw new UploadThingError(
          "Too many uploads in a short time. Wait a few minutes and try again.",
        );
      }
      return { userId };
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.ufsUrl, key: file.key };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
