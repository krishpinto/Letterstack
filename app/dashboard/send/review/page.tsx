import { redirect } from "next/navigation";

// The old global review/send flow is replaced by the per-campaign send page
// at /dashboard/campaigns/[id]. Sending now happens from there.
export default function ReviewRedirect() {
  redirect("/dashboard/campaigns");
}
