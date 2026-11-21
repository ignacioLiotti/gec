import { OperationalWorkspace } from "@/app/dashboard/_components/operational-workspace";
import { operationalWorkspaceData } from "../fixtures";
export default function Operations() {
  return <OperationalWorkspace data={operationalWorkspaceData} />;
}
