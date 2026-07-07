import { generateReactHelpers } from "@uploadthing/react";

import type { UploadRouter } from "@/lib/upload/router";

export const { useUploadThing } = generateReactHelpers<UploadRouter>();
