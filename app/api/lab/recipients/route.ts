import {
  DELETE as audienceDELETE,
  GET as audienceGET,
  POST as audiencePOST,
} from "@/app/api/audience/route";
import { devOnly } from "@/lib/lab/dev-only";

export const GET = devOnly(audienceGET);
export const POST = devOnly(audiencePOST);
export const DELETE = devOnly(audienceDELETE);

export const runtime = "nodejs";
