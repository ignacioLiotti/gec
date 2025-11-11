"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutGrid, Save, Trash2 } from "lucide-react";

type NamedView = { name: string } & Record<string, unknown>;

export function ViewsMenu({
  views,
  saveCurrentAsView,
  applyView,
  deleteView,
}: {
  views: any[];
  saveCurrentAsView: () => void;
  applyView: (v: any) => void;
  deleteView: (name: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <LayoutGrid className="h-4 w-4" />
          Vistas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={saveCurrentAsView} className="gap-2">
          <Save className="h-4 w-4" />
          Guardar vista actual…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          Vistas guardadas
        </div>
        {views.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            No hay vistas guardadas
          </div>
        ) : (
          <div className="max-h-[200px] overflow-y-auto">
            {views.map((v) => (
              <div key={v.name} className="flex items-center justify-between gap-2 px-2 py-2 hover:bg-muted/50 rounded-sm transition-colors group">
                <button 
                  type="button" 
                  className="flex-1 text-left text-sm hover:underline truncate" 
                  onClick={() => applyView(v)}
                >
                  {v.name}
                </button>
                <button 
                  type="button" 
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all" 
                  onClick={() => deleteView(v.name)}
                  title="Eliminar vista"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


