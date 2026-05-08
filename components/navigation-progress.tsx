"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * NavigationProgress — Full-screen backdrop with a goo-style loader during page transitions.
 *
 * Uses pathname/searchParams changes plus a delay so fast navigations do not flash
 * the overlay.
 */
export function NavigationProgress({
  delay = 100,
  maxDuration = 10000,
}: {
  /** Delay in ms before showing the overlay (prevents flash on fast navigations) */
  delay?: number;
  /** Maximum time in ms before force-hiding a stuck overlay */
  maxDuration?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(false);

  const previousPathRef = React.useRef<string | null>(null);
  const previousSearchRef = React.useRef<string | null>(null);
  const delayTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNavigationTimers = React.useCallback(() => {
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
      delayTimeoutRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
  }, []);

  const resetNavigation = React.useCallback(() => {
    clearNavigationTimers();
    setVisible(false);
    setIsNavigating(false);
    setProgress(0);
  }, [clearNavigationTimers]);

  // Track navigation start via click events on links
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      // Check if it's an external link
      if (href.startsWith("http") && !href.startsWith(window.location.origin)) {
        return;
      }

      // Check for target="_blank"
      if (anchor.target === "_blank") {
        return;
      }

      // Check for download attribute
      if (anchor.hasAttribute("download")) {
        return;
      }

      // Check for modifier keys (new tab/window)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const targetUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      const targetPath = `${targetUrl.pathname}${targetUrl.search}`;
      const currentPath = `${currentUrl.pathname}${currentUrl.search}`;

      if (targetPath === currentPath) {
        return;
      }

      // Start navigation state
      setIsNavigating(true);
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, []);

  // Handle navigation completion
  React.useEffect(() => {
    const currentPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    const previousPath = previousPathRef.current;

    // If path changed and we were navigating, complete the animation
    if (previousPath !== null && previousPath !== currentPath && isNavigating) {
      previousPathRef.current = currentPath;
      previousSearchRef.current = searchParams?.toString() ?? null;

      // Complete the simulated progress (used for aria + timing)
      setProgress(100);

      // Hide after animation completes
      const hideTimeout = setTimeout(() => {
        resetNavigation();
      }, 200);

      return () => clearTimeout(hideTimeout);
    }

    previousPathRef.current = currentPath;
    previousSearchRef.current = searchParams?.toString() ?? null;
  }, [pathname, searchParams, isNavigating, resetNavigation]);

  // Handle delay and progress animation
  React.useEffect(() => {
    if (isNavigating) {
      // Clear any existing timeout
      clearNavigationTimers();

      // Start after delay to prevent flash on fast navigations
      delayTimeoutRef.current = setTimeout(() => {
        setVisible(true);
        setProgress(13);

        // Gradually increase progress
        progressIntervalRef.current = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) {
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
              }
              return prev;
            }
            // Slow down as we approach 90%
            const increment = Math.max(1, (90 - prev) * 0.1);
            return Math.min(90, prev + increment);
          });
        }, 200);
      }, delay);

      maxDurationTimeoutRef.current = setTimeout(() => {
        resetNavigation();
      }, maxDuration);
    }

    return () => {
      clearNavigationTimers();
    };
  }, [
    clearNavigationTimers,
    delay,
    isNavigating,
    maxDuration,
    resetNavigation,
  ]);

  // Reset if navigation is cancelled
  React.useEffect(() => {
    if (!isNavigating) {
      clearNavigationTimers();
    }
  }, [clearNavigationTimers, isNavigating]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center",
        "bg-background/70 backdrop-blur-sm",
        "pointer-events-auto cursor-wait"
      )}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Page loading"
    >
      <div
        className={cn(
          "grid size-[100px] box-border bg-white p-[10px]",
          "mix-blend-darken",
          "filter-[blur(5px)_contrast(10)_hue-rotate(300deg)]"
        )}
        aria-hidden
      >
        <div
          className={cn(
            "col-start-1 row-start-1 size-10 bg-[#ff9900]",
            "animate-[nav-progress-loader-l7_2s_infinite]"
          )}
        />
        <div
          className={cn(
            "col-start-1 row-start-1 size-10 bg-[#ff9900]",
            "animate-[nav-progress-loader-l7_2s_infinite] [animation-delay:-1s]"
          )}
        />
      </div>
    </div>
  );
}
