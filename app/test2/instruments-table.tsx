"use client";

import { useState, useTransition } from "react";

type Instrument = {
  id: string;
  name: string;
  created_at: string;
};

export default function InstrumentsTable({
  instruments,
  addInstrument,
}: {
  instruments: Instrument[];
  addInstrument: (formData: FormData) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Instrument[]>(instruments);

  async function handleSubmit(formData: FormData) {
    const value = String(formData.get("name") ?? "").trim();
    if (!value) return;

    // optimistic local update to reduce perceived latency
    setOptimistic((prev) => [
      {
        id: `temp-${Date.now()}`,
        name: value,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);

    setName("");

    startTransition(async () => {
      await addInstrument(formData);
    });
  }

  return (
    <div className="space-y-4">
      <form
        action={handleSubmit}
        className="flex w-full items-center gap-2"
      >
        <input
          type="text"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New instrument name"
          className="px-3 py-2 w-72 rounded-md border bg-background text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/20"
        />
        <button
          type="submit"
          disabled={isPending || name.trim().length === 0}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-black/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/90"
        >
          {isPending ? "Adding..." : "Add"}
        </button>
      </form>

      <div className="overflow-hidden rounded-md border">
        <table className="w-full caption-bottom text-sm">
          <thead className="bg-foreground/5">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {optimistic.map((inst) => (
              <tr key={inst.id} className="border-t">
                <td className="px-4 py-2">{inst.name}</td>
                <td className="px-4 py-2">
                  {new Date(inst.created_at).toISOString().slice(0, 19).replace("T", " ")}
                </td>
              </tr>
            ))}
            {optimistic.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-foreground/60" colSpan={2}>
                  No instruments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


