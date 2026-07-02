"use client"

import { Bell, Search } from "lucide-react"
import { Avatar, AvatarFallback, Button, Input, SidebarTrigger } from "@acme/ui"
import { ThemeToggle } from "./theme-toggle"

export function TopBar() {
  return (
    <header className="sticky top-0 z-sticky flex h-14 shrink-0 items-center gap-3 border-b border-stroke-soft bg-surface-glass/80 px-3 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur supports-[backdrop-filter]:bg-surface-glass/65 md:px-4">
      <SidebarTrigger className="size-10 rounded-lg border border-stroke-soft bg-surface-muted text-content shadow-none md:hidden" />
      <div className="relative hidden w-full max-w-sm md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-content-disabled" />
        <Input className="h-9 bg-surface pl-9" placeholder="Search" />
      </div>
      <div className="min-w-0 flex-1 md:hidden">
        <p className="truncate text-sm font-semibold text-content">Acme UI</p>
        <p className="truncate text-[11px] text-content-muted">Starter shell</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
        <ThemeToggle />
        <Avatar className="size-9">
          <AvatarFallback>AC</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
