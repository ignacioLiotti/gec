import React, {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal as reactPortal } from "react-dom";
import { MotionConfig } from "motion/react";
export * from "motion/react";

const ReferenceContext = createContext({
  reduced: false,
  library: "interior",
  productTheme: "",
});
const preferenceQuery = "(prefers-reduced-motion: reduce)";
function subscribePreference(onChange: () => void) {
  const media = window.matchMedia(preferenceQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
export function useSystemMotionPreference() {
  return useSyncExternalStore(
    subscribePreference,
    () => window.matchMedia(preferenceQuery).matches,
    () => false,
  );
}

// Preserve the upstream preference branches while allowing both modes to be
// inspected side by side. OS reduced motion always wins over the preview.
export function useReducedMotion() {
  const { reduced } = useContext(ReferenceContext);
  return useSystemMotionPreference() || reduced;
}

export function ReferenceSurface({
  library,
  reduced,
  children,
  productTheme,
}: {
  library: string;
  reduced: boolean;
  children: ReactNode;
  productTheme?: "published";
}) {
  const systemReduced = useSystemMotionPreference();
  const parent = useContext(ReferenceContext);
  const effective = parent.reduced || reduced || systemReduced === true;
  const theme = productTheme ?? parent.productTheme;
  return (
    <ReferenceContext.Provider
      value={{ library, reduced: effective, productTheme: theme }}
    >
      <MotionConfig reducedMotion={effective ? "always" : "never"}>
        <div
          className="motion-reference"
          data-library={library}
          data-reduced={effective}
          data-product-theme={theme || undefined}
        >
          {children}
        </div>
      </MotionConfig>
    </ReferenceContext.Provider>
  );
}

function PortalSurface({ children }: { children: ReactNode }) {
  const { library, reduced, productTheme } = useContext(ReferenceContext);
  return (
    <div
      className="motion-reference motion-reference-portal"
      data-library={library}
      data-reduced={reduced}
      data-product-theme={productTheme || undefined}
    >
      {children}
    </div>
  );
}

// React context follows portals. Keep tokens and the reduced preference scoped
// to the originating sample, without changing upstream focus/positioning logic.
export function createPortal(
  children: ReactNode,
  container: Element | DocumentFragment,
  key?: string | null,
) {
  return reactPortal(<PortalSurface>{children}</PortalSurface>, container, key);
}
