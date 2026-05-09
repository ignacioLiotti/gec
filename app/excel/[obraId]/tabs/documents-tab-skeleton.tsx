"use client";

import { TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loading state for the documents tab.
 * Shows a realistic file manager layout while data loads.
 */
export function DocumentsTabSkeleton() {
  return (
    <TabsContent value="documentos" className="space-y-6">
      <div className="flex gap-4 h-[600px]">
        {/* File tree sidebar skeleton */}
        <div className="w-64 shrink-0 border rounded-lg p-3 space-y-2 hidden md:block">
          <Skeleton className="h-5 w-32 mb-4" />
          {/* Folder items */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 flex-1" style={{ width: `${60 + Math.random() * 30}%` }} />
            </div>
          ))}
          {/* Nested items with indent */}
          <div className="pl-4 space-y-2 mt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-3.5 flex-1" style={{ width: `${50 + Math.random() * 40}%` }} />
              </div>
            ))}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 border rounded-lg p-4 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 pb-3 border-b">
            <div className="flex items-center gap-2">
              <Skeleton className="size-9 rounded" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-32 rounded" />
              <Skeleton className="size-9 rounded" />
              <Skeleton className="size-9 rounded" />
            </div>
          </div>

          {/* Grid of file/folder cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="border rounded-lg p-3 space-y-2"
              >
                <Skeleton className="aspect-square w-full rounded" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
