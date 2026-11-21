import React, { useState, type ReactNode } from "react";
import { Database } from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import { ExcelPageTabList } from "@/components/excel-page-tabs";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { motion, useReducedMotion } from "../reference-runtime";
import { Button } from "@/components/ui/button";
import {
  useAsyncAction,
  type LoadingButtonProps,
} from "../vendor/interior/components/interior/loading-button";

export function ScreenSidebar({ onOpen }: { onOpen: () => void }) {
  return (
    <SidebarProvider className="screen-sidebar-provider">
      <Sidebar collapsible="none">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <button
                  onClick={onOpen}
                  className="flex w-full min-w-0 items-center gap-3 px-2 py-1.5"
                >
                  <AppBrand />
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Principal</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive asChild>
                  <button onClick={onOpen}><Database /><span>Obras</span></button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <span className="text-xs text-muted-foreground">
            Equipo de obras · Ejemplo local
          </span>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}

const MotionButton = motion.create(Button);

/** Interior's async state and face spring rendered by the app's actual Button. */
export function ScreenLoadingButton({
  onAction,
  children,
  pendingLabel = "Guardando…",
  successLabel = "Guardado",
  errorLabel = "Reintentar",
  resetAfter,
  disabled,
  onError,
  className,
}: LoadingButtonProps) {
  const reduced = useReducedMotion();
  const { status, pending, run } = useAsyncAction({
    action: onAction,
    resetAfter,
    onError,
  });
  const faces = {
    idle: children,
    pending: pendingLabel,
    success: successLabel,
    error: errorLabel,
  };
  return (
    <MotionButton
      disabled={disabled}
      className={className}
      aria-label={faces[status]}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      whileTap={reduced || pending || disabled ? undefined : { y: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.45 }}
      onClick={() => {
        if (!pending) run();
      }}
    >
      <span aria-hidden className="grid place-items-center">
        {Object.entries(faces).map(([phase, label]) => (
          <motion.span
            key={phase}
            initial={false}
            className="col-start-1 row-start-1 whitespace-nowrap"
            animate={
              phase === status
                ? { opacity: 1, y: 0, filter: "blur(0px)" }
                : { opacity: 0, y: 3, filter: "blur(3px)" }
            }
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 260, damping: 34, mass: 0.8 }
            }
          >
            {label}
          </motion.span>
        ))}
      </span>
    </MotionButton>
  );
}

/** Route tabs retain their product paint; panel movement uses Interior's PANEL spring. */
export function ScreenTabs({
  value,
  onValueChange,
  renderPanel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  renderPanel: (value: string) => ReactNode;
}) {
  const reduced = useReducedMotion();
  const [direction, setDirection] = useState(1);
  const routeValue = value === "documentos" ? "documentos-new" : "general";
  return (
    <Tabs
      className="screen-route-tabs"
      value={routeValue}
      onValueChange={(next) => {
        setDirection(next === "general" ? -1 : 1);
        onValueChange(next === "general" ? "general" : "documentos");
      }}
    >
      <ExcelPageTabList visibleTabs={["general", "documentos-new"]} />
      <TabsContent value={routeValue} asChild>
        <motion.div
          key={routeValue}
          initial={reduced ? false : { opacity: 0, x: direction * 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 460, damping: 38, mass: 0.8 }
          }
          className="screen-tab-panel"
        >
          {renderPanel(value)}
        </motion.div>
      </TabsContent>
    </Tabs>
  );
}
