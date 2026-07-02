import { redirect } from "next/navigation";

export default function SendPageRedirect() {
  redirect("/dashboard/campaigns");
}
