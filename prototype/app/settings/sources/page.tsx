import { redirect } from "next/navigation";

// Merged into the unified data pipeline (Sources & integration → Setup & run).
export default function SourcesRedirect() {
  redirect("/data-pipeline");
}
