import { redirect } from "next/navigation";

// The old Send workspace is retired. Campaigns are now created from the
// Campaigns page (pick a template → draft → send page), and audience +
// do-not-mail live under Audience.
export default function SendPageRedirect() {
  redirect("/dashboard/campaigns");
}
