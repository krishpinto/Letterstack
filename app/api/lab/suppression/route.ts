import {
  GET as suppressionGET,
  POST as suppressionPOST,
} from "@/app/api/audience/suppression/route";
import { devOnly } from "@/lib/lab/dev-only";

export const GET = devOnly(suppressionGET);
export const POST = devOnly(suppressionPOST);

export const runtime = "nodejs";
