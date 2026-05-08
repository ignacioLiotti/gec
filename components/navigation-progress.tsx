"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * NavigationProgress - A global progress bar that shows during page transitions.
 * 
 * Uses a combination of pathname/searchParams changes and a delay to provide
 * smooth visual feedback without flashing on fast navigations.
 */
export function NavigationProgress({
  color = "bg-orange-primary",
  height = "h-0.5",
  delay = 100,
}: {
  /** Background color class for the progress bar */
  color?: string;
  /** Height class for the progress bar */
  height?: string;
  /** Delay in ms before showing the progress bar (prevents flash on fast navigations) */
  delay?: number;
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
      // Complete the progress bar
      setProgress(100);
      
      // Hide after animation completes
      const hideTimeout = setTimeout(() => {
        setVisible(false);
        setIsNavigating(false);
        setProgress(0);
      }, 200);
      
      return () => clearTimeout(hideTimeout);
    }
    
    previousPathRef.current = currentPath;
    previousSearchRef.current = searchParams?.toString() ?? null;
  }, [pathname, searchParams, isNavigating]);

  // Handle delay and progress animation
  React.useEffect(() => {
    if (isNavigating && !visible) {
      // Clear any existing timeout
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }
      
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
    }
    
    return () => {
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isNavigating, visible, delay]);

  // Reset if navigation is cancelled
  React.useEffect(() => {
    if (!isNavigating) {
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
  }, [isNavigating]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 top-0 z-[9999]",
        height
      )}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Page loading"
    >
      <div
        className={cn(
          "h-full transition-all duration-200 ease-out",
          color
        )}
        style={{
          width: `${progress}%`,
          boxShadow: `0 0 10px var(--color-orange-primary, #f97316), 0 0 5px var(--color-orange-primary, #f97316)`,
        }}
      />
    </div>
  );
}
