import { TalentDetail } from "./detail";

// Dynamic route — the detail view fetches the talent from the API at request time.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TalentDetail id={id} />;
}
