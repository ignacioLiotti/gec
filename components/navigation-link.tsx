"use client";

import * as React from "react";
import Link from "next/link";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type NavigationLinkProps = React.ComponentProps<typeof Link> & {
  /**
   * Show a loading spinner inline when navigation is pending
   */
  showLoadingSpinner?: boolean;
  /**
   * Additional className to apply when navigation is pending
   */
  pendingClassName?: string;
  /**
   * Icon component to replace with spinner when loading
   */
  icon?: React.ReactNode;
  /**
   * Custom loading indicator component
   */
  loadingIndicator?: React.ReactNode;
};

/**
 * NavigationLink - A Link component that provides visual feedback during navigation.
 * Uses Next.js 16's useLinkStatus hook to detect when navigation is in progress.
 */
function NavigationLinkInner(
  {
    children,
    className,
    showLoadingSpinner = false,
    pendingClassName,
    icon,
    loadingIndicator,
    ...props
  }: NavigationLinkProps,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  const { pending } = useLinkStatus();

  const defaultLoadingIndicator = (
    <Loader2 className="size-4 animate-spin" />
  );

  return (
    <Link
      ref={ref}
      className={cn(
        className,
        pending && pendingClassName,
        pending && "pointer-events-none"
      )}
      {...props}
    >
      {icon && !pending && icon}
      {icon && pending && (loadingIndicator ?? defaultLoadingIndicator)}
      {!icon && showLoadingSpinner && pending && (
        <span className="mr-2">
          {loadingIndicator ?? defaultLoadingIndicator}
        </span>
      )}
      {children}
    </Link>
  );
}

const NavigationLinkContent = React.forwardRef(NavigationLinkInner);

/**
 * Wrapper component that provides the link status context.
 * The useLinkStatus hook must be used within a child component of Link.
 */
export const NavigationLink = React.forwardRef<
  HTMLAnchorElement,
  NavigationLinkProps
>(function NavigationLink(props, ref) {
  return <NavigationLinkContent ref={ref} {...props} />;
});

/**
 * Hook to get navigation pending state - must be used inside a Link component's children
 */
export function useNavigationPending() {
  const { pending } = useLinkStatus();
  return pending;
}

/**
 * Component that renders children only when parent Link is navigating
 */
export function NavigationPendingIndicator({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { pending } = useLinkStatus();
  return pending ? <>{children}</> : <>{fallback}</>;
}

/**
 * Spinner that shows only during navigation
 */
export function NavigationSpinner({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const { pending } = useLinkStatus();
  
  const sizeClasses = {
    sm: "size-4",
    md: "size-5",
    lg: "size-6",
  };

  if (!pending) return null;

  return (
    <Loader2
      className={cn("animate-spin", sizeClasses[size], className)}
    />
  );
}
