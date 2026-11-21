import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/tray";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PermissionStateControl } from "@/app/admin/roles/_components/permission-state-control";
import { InsurancePolicyStatusBadge } from "@/components/insurance-policy-status";
import { renderOcrStatusBadge } from "@/app/excel/[obraId]/tabs/file-manager/ocr-status";

const meta = { title: "Patterns/Shared behavior" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const PermissionChoice: Story = { render: function Choice() {
  const [value, setValue] = React.useState<"inherit" | "grant" | "deny">("inherit");
  return <PermissionStateControl label="Document access" value={value} onChange={setValue} />;
} };
export const PolicyStatus: Story = { render: () => <div className="flex flex-wrap gap-3">{(["active", "dueSoon", "expired", "cancelled"] as const).map(status => <InsurancePolicyStatusBadge key={status} status={status} />)}</div> };
export const OcrStatus: Story = { render: () => <div className="flex flex-wrap gap-3">{(["pending", "processing", "completed", "failed", "unprocessed"] as const).map(status => <React.Fragment key={status}>{renderOcrStatusBadge({ id: status, name: "Example document", type: "file", ocrDocumentStatus: status, ocrRowsExtracted: 3 }, "sheet")}</React.Fragment>)}{renderOcrStatusBadge({ id: "conflict", name: "Example document", type: "file", ocrDocumentStatus: "failed", ocrErrorCode: "LINEAGE_RECONCILIATION_CONFLICT" }, "sheet")}</div> };
export const Composition: Story = { render: () => <div className="flex gap-4"><Badge asChild dot count={3}><a href="#documents">Documents</a></Badge><Chip asChild active dot="manual"><a href="#manual">Manual</a></Chip></div> };
export const FormStates: Story = { render: () => <form className="grid max-w-sm gap-3" onSubmit={event => event.preventDefault()}><Input aria-label="Name" placeholder="Name" /><Input aria-label="Invalid name" aria-invalid placeholder="Required name" /><Input aria-label="Disabled name" disabled value="Disabled" readOnly /><label className="flex items-center gap-2"><Checkbox name="documents" defaultChecked="indeterminate" />Documents</label><Button type="submit">Save changes</Button></form> };
export const NestedMenus: Story = { render: function Menus() {
  const [action, setAction] = React.useState("");
  return <Dialog><DialogTrigger asChild><Button>Open editor</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Document editor</DialogTitle></DialogHeader><div className="grid gap-4 p-4"><Select><SelectTrigger aria-label="Document status"><SelectValue placeholder="Choose status" /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="review">Review</SelectItem></SelectContent></Select><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline">Row actions</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={() => setAction("Duplicated")}>Duplicate</DropdownMenuItem><DropdownMenuItem variant="destructive" onSelect={() => setAction("Deleted")}>Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu><p role="status">{action}</p></div></DialogContent></Dialog>;
} };
