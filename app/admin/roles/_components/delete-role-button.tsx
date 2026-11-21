"use client";
import { Button } from "@/components/ui/button";


export default function DeleteRoleButton({ onDelete }: { onDelete: () => Promise<void> }) {
  return (
    <form action={onDelete}>
      <Button variant="outline" className="px-2 py-1 text-xs">Delete</Button>
    </form>
  );
}


