import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-bg-tertiary text-text-primary hover:bg-bg-tertiary/80",
        secondary: "border-transparent bg-bg-secondary text-text-secondary hover:bg-bg-secondary/80",
        success: "border-transparent bg-accent-green text-white",
        destructive: "border-transparent bg-accent-red text-white",
        warning: "border-transparent bg-accent-yellow text-white",
        info: "border-transparent bg-accent-blue text-white",
        purple: "border-transparent bg-accent-purple text-white",
        outline: "text-text-secondary border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn(badgeVariants({ variant }), className)} 
        {...props} 
      />
    );
  }
);
Badge.displayName = "Badge";

// Event-specific badge variants for the Chronicle dashboard
const EventBadge = forwardRef<
  HTMLDivElement,
  BadgeProps & { eventType?: "success" | "tool_use" | "file_op" | "error" | "lifecycle" }
>(({ eventType, className, ...props }, ref) => {
  const getEventVariant = (type?: string) => {
    switch (type) {
      case "success":
        return "success";
      case "tool_use":
        return "info";
      case "file_op":
        return "warning";
      case "error":
        return "destructive";
      case "lifecycle":
        return "purple";
      default:
        return "default";
    }
  };

  return (
    <Badge
      ref={ref}
      variant={getEventVariant(eventType)}
      className={className}
      {...props}
    />
  );
});
EventBadge.displayName = "EventBadge";

export { Badge, EventBadge, badgeVariants };