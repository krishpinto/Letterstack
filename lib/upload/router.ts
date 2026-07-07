import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

import { auth } from "@/lib/auth";

const f = createUploadthing();

// Images referenced by EmailDocument blocks. Files land on UploadThing's CDN
// and the public URL is written into the document — never base64, never blobs.
export const uploadRouter = {
  emailImage: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await auth();
      const userId = session?.user?.id;
      if (!userId) throw new UploadThingError("Sign in to upload images");
      return { userId };
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
