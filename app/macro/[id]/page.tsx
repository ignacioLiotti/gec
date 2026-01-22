import { redirect } from "next/navigation";

export default async function LegacyMacroTableRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/macro?macroId=${id}`);
}





