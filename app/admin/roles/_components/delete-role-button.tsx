"use client";

export default function DeleteRoleButton({ onDelete }: { onDelete: () => Promise<void> }) {
  return (
    <form action={onDelete}>
      <button className="rounded-md border px-2 py-1 text-xs hover:bg-foreground/10">Delete</button>
    </form>
  );
}


