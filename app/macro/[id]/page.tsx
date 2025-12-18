import { redirect } from "next/navigation";

export default function LegacyMacroTableRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/macro?macroId=${params.id}`);
}


