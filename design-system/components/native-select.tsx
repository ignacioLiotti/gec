import * as React from "react";
import { cn } from "../lib/utils";
import { fieldClassName } from "./field-styles";

/** Native selection for forms that depend on ChangeEvent and FormData. */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select data-slot="native-select" className={cn(fieldClassName, "h-9", className)} {...props} />;
}
