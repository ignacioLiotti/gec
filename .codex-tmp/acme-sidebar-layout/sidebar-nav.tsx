"use client"

import type { ComponentType, ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Boxes,
  ChevronRight,
  ClipboardList,
  Component,
  Database,
  FileSpreadsheet,
  FileText,
  Layers,
  LayoutGrid,
  Settings,
  Table2,
  UserRound
} from "lucide-react"
import {
  Badge,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  cn,
  useSidebar
} from "@acme/ui"

type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  badge?: string
}

const primaryNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/excel-clone-lab", label: "Excel Lab", icon: FileSpreadsheet },
  { href: "/document-workbench", label: "Workbench", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings }
]

const layoutNav: NavItem[] = [
  { href: "/layouts", label: "Overview", icon: LayoutGrid },
  { href: "/excel-clone-lab", label: "Spreadsheet", icon: Table2 },
  { href: "/layouts/charts", label: "Chart editor", icon: BarChart3 },
  { href: "/document-workbench", label: "PDF review", icon: FileText },
  { href: "/layouts/consistency", label: "Consistency", icon: Layers }
]

const componentNav: NavItem[] = [
  { href: "/components", label: "Components", icon: Component, badge: "19" },
  { href: "/components/forms", label: "Forms", icon: ClipboardList },
  { href: "/components/data", label: "Data", icon: Boxes }
]

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const Icon = item.icon
  const active = isActivePath(pathname, item.href)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} title={item.label}>
        <Link href={item.href}>
          <Icon className="size-4" />
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="truncate">{item.label}</span>
            {item.badge ? (
              <Badge variant="outline" size="xs" className="h-5 px-1.5">
                {item.badge}
              </Badge>
            ) : null}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavTree({
  title,
  icon: Icon,
  active,
  children
}: {
  title: string
  icon: ComponentType<{ className?: string }>
  active: boolean
  children: ReactNode
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} title={title}>
        <button type="button">
          <Icon className="size-4" />
          <span>{title}</span>
          <ChevronRight className="ml-auto size-4 rotate-90 text-content-disabled transition-transform duration-normal ease-standard group-data-[collapsible=icon]:opacity-0" />
        </button>
      </SidebarMenuButton>
      <SidebarMenuSub>{children}</SidebarMenuSub>
    </SidebarMenuItem>
  )
}

export function SidebarNav() {
  const pathname = usePathname()
  const { isMobile, state } = useSidebar()
  const isCollapsed = !isMobile && state === "collapsed"
  const layoutsActive = layoutNav.some((item) => isActivePath(pathname, item.href))
  const componentsActive = componentNav.some((item) => isActivePath(pathname, item.href))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="space-y-2 transition-[gap] duration-sidebar ease-sidebar">
              <SidebarMenuButton size="lg" asChild className={cn(isCollapsed ? "" : "min-w-0")}>
                <Link href="/" className="flex w-full min-w-0 items-center gap-3 px-2 py-1.5" title="Acme UI">
                  <div
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-full bg-orange-primary text-sm font-semibold text-primary-foreground shadow-raised transition-[width,height,transform] duration-sidebar ease-sidebar",
                      isCollapsed ? "size-8 scale-95" : "size-10 scale-100"
                    )}
                  >
                    A
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight transition-[opacity,transform] duration-normal ease-sidebar group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0">
                    <span className="truncate font-mono text-lg font-semibold leading-4 text-content">Acme UI</span>
                    <span className="truncate text-xs text-content-muted">Design system</span>
                  </div>
                </Link>
              </SidebarMenuButton>

              {isCollapsed ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent/40 py-2.5 text-content-muted"
                  title="Starter shell"
                >
                  <Database className="size-5" />
                </button>
              ) : (
                <div className="rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5 text-left">
                  <p className="text-xs text-content-muted">Workspace</p>
                  <p className="truncate text-sm font-medium text-content">Starter shell</p>
                </div>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarSection label="Principal">
          {primaryNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </SidebarSection>

        <SidebarSeparator />

        <SidebarSection label="Patterns">
          <NavTree title="Layouts" icon={Layers} active={layoutsActive}>
            {layoutNav.map((item) => {
              const Icon = item.icon
              return (
                <SidebarMenuSubItem key={item.href}>
                  <SidebarMenuSubButton asChild isActive={isActivePath(pathname, item.href)}>
                    <Link href={item.href}>
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </NavTree>

          <NavTree title="Components" icon={Component} active={componentsActive}>
            {componentNav.map((item) => {
              const Icon = item.icon
              return (
                <SidebarMenuSubItem key={item.href}>
                  <SidebarMenuSubButton asChild isActive={isActivePath(pathname, item.href)}>
                    <Link href={item.href}>
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </NavTree>
        </SidebarSection>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none" title="AC Studio">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-orange-primary/10 text-orange-primary">
                <UserRound className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight transition-[opacity,transform] duration-normal ease-sidebar group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0">
                <span className="truncate font-semibold text-content">AC Studio</span>
                <span className="truncate text-xs text-content-muted">Starter shell</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
