import { redirect } from "next/navigation";

// Merged into the unified data pipeline (Sources & integration → Run history).
export default function IngestionRedirect() {
  redirect("/data-pipeline");
}
