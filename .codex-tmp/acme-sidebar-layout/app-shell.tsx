"use client"

import type { ReactNode } from "react"
import { SidebarInset, SidebarProvider } from "@acme/ui"
import { SidebarNav } from "./sidebar-nav"
import { TopBar } from "./top-bar"

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="notranslate" translate="no">
      <SidebarProvider defaultOpen={false}>
        <SidebarNav />
        <SidebarInset>
          <TopBar />
          <main className="flex min-h-[calc(100svh-3.5rem)] flex-1 flex-col gap-4 bg-[#f0f1f3] md:min-h-0">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
