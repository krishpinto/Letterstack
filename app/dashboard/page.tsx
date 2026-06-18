import { redirect } from "next/navigation";

// The dashboard home now lands on Campaigns — the primary surface.
export default function DashboardHome() {
  redirect("/dashboard/campaigns");
}
