import { cn } from "cn";

function LoadingSpinner({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-5 shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current text-primary motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

function LoadingScreen({
  label = "Loading...",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-dvh items-center justify-center bg-background p-6",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3 text-center" role="status">
        <LoadingSpinner className="size-10 border-4" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export { LoadingScreen, LoadingSpinner };
