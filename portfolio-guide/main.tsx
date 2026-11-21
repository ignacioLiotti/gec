import { Component, Suspense, lazy, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotionProvider } from "@/components/motion/lazy-motion-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { ArrowLeft } from "lucide-react";
import { chapters, type ChapterId } from "./chapters";
import Guide from "./guide";
import { installLocalApi } from "./runtime/local-api";
import "@/app/globals.css";
import "./guide.css";

installLocalApi();
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
const screens = {
  operations: lazy(() => import("./screens/operations")),
  obras: lazy(() => import("./screens/obras")),
  documents: lazy(() => import("./screens/documents")),
  reports: lazy(() => import("./screens/reports")),
  "data-flow": lazy(() => import("./screens/data-flow")),
  setup: lazy(() => import("./screens/setup")),
};
class ScreenBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="guide-error" role="alert">
        <h1>This screen could not load.</h1>
        <p>Your account and product data are not connected to this guide.</p>
        <button onClick={() => window.location.reload()}>
          Reload the example
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotionProvider>
        <TooltipProvider>
          {children}
          <Toaster richColors position="bottom-right" />
        </TooltipProvider>
      </LazyMotionProvider>
    </QueryClientProvider>
  );
}
const screen = new URLSearchParams(window.location.search).get("screen");
document.documentElement.lang = screen ? "es" : "en";
const validScreen = chapters.some((chapter) => chapter.id === screen);
const Screen = validScreen ? screens[screen as ChapterId] : null;
createRoot(document.getElementById("root")!).render(
  <Providers>
    <ScreenBoundary>
      {screen ? (
        Screen ? (
          <>
            {window.parent === window && (
              <div className="standalone-toolbar" lang="en">
                <a href={"./#" + screen}>
                  <ArrowLeft size={15} /> Back to guide
                </a>
                <span>
                  {chapters.find((chapter) => chapter.id === screen)?.short} ·
                  Sample data
                </span>
              </div>
            )}
            <Suspense
              fallback={
                <div className="guide-loading" role="status">
                  Loading product component…
                </div>
              }
            >
              <Screen />
            </Suspense>
          </>
        ) : (
          <p role="alert">
            Unknown screen. <a href="./">Open the guide</a>
          </p>
        )
      ) : (
        <Guide />
      )}
    </ScreenBoundary>
  </Providers>,
);
