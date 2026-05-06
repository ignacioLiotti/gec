import type { DocumentGenerationPermissionMap } from "@/lib/document-generation-server";

type Props = {
  permissions: DocumentGenerationPermissionMap;
};

export function DocumentGenerationShell({
  children,
}: Props & { children: React.ReactNode }) {
  return <div className="flex w-full flex-col">{children}</div>;
}
