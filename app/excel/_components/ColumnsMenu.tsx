"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Columns3, Eye, EyeOff, Pin } from "lucide-react";

export function ColumnsMenu({
  allColumns,
  hiddenCols,
  setHiddenCols,
  pinnedColumns,
  togglePinColumn,
  resizeMode,
  setResizeMode,
}: {
  allColumns: { index: number; label: string }[];
  hiddenCols: number[];
  setHiddenCols: React.Dispatch<React.SetStateAction<number[]>>;
  pinnedColumns: number[];
  togglePinColumn: (colIndex: number) => void;
  resizeMode: "balanced" | "fixed";
  setResizeMode: (v: "balanced" | "fixed") => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Columns3 className="h-4 w-4" />
          Columnas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          Configuración
        </div>
        <DropdownMenuCheckboxItem
          checked={resizeMode === "fixed"}
          onCheckedChange={(next) => setResizeMode(Boolean(next) ? "fixed" : "balanced")}
        >
          Ancho fijo (independiente)
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          Acciones rápidas
        </div>
        <DropdownMenuItem onClick={() => setHiddenCols([])} className="gap-2">
          <Eye className="h-4 w-4" />
          Mostrar todo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setHiddenCols(allColumns.map(c => c.index))} className="gap-2">
          <EyeOff className="h-4 w-4" />
          Ocultar todo
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          Visibilidad y fijado de columnas
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {allColumns.map((col) => {
            const isVisible = !hiddenCols.includes(col.index);
            const isPinned = pinnedColumns.includes(col.index);
            return (
              <div key={col.index} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-sm">
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(e) => {
                    setHiddenCols((prev) => {
                      const set = new Set(prev);
                      if (!e.target.checked) set.add(col.index); else set.delete(col.index);
                      return Array.from(set).sort((a, b) => a - b);
                    });
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <button
                  onClick={() => togglePinColumn(col.index)}
                  className={`p-1 rounded hover:bg-accent-foreground/10 ${isPinned ? 'text-primary' : 'text-muted-foreground'}`}
                  title={isPinned ? "Desfijar columna" : "Fijar columna"}
                >
                  <Pin className={`h-3 w-3 ${isPinned ? 'fill-current' : ''}`} />
                </button>
                <span className="flex-1 text-sm">{col.label}</span>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}



