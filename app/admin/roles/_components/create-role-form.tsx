"use client";

export default function CreateRoleForm({ onCreate }: { onCreate: (formData: FormData) => Promise<void> }) {
  return (
    <form action={onCreate} className="flex items-center gap-2">
      <input name="key" placeholder="key" className="w-40 rounded-md border bg-background px-2 py-1 text-sm" />
      <input name="name" placeholder="name" className="w-48 rounded-md border bg-background px-2 py-1 text-sm" />
      <button className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/90">Create</button>
    </form>
  );
}


