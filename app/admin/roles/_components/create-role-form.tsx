"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";


export default function CreateRoleForm({ onCreate }: { onCreate: (formData: FormData) => Promise<void> }) {
  return (
    <form action={onCreate} className="flex items-center gap-2">
      <Input name="key" placeholder="key" className="w-40 px-2 py-1 text-sm" />
      <Input name="name" placeholder="name" className="w-48 px-2 py-1 text-sm" />
      <Button variant="outline" className="px-3 py-1.5 text-xs font-medium">Create</Button>
    </form>
  );
}


