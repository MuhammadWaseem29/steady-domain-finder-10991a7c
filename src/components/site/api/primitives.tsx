import { useState, type ReactNode } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      className="rounded-md border border-terminal-muted/30 px-2 py-1 font-mono text-[11px] text-terminal-muted transition-colors hover:text-terminal-foreground"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="max-h-[460px] overflow-auto px-4 py-3 font-mono text-[12.5px] leading-6 text-terminal-foreground">
      {children}
    </pre>
  );
}

export function MethodBadge({ method }: { method: string }) {
  const isWrite = method === "POST";
  return (
    <span
      className={`label-mono rounded px-1.5 py-0.5 ${
        isWrite ? "bg-brand text-brand-foreground" : "bg-success text-success-foreground"
      }`}
    >
      {method}
    </span>
  );
}

export function StatusPill({ status }: { status: number }) {
  const ok = status >= 200 && status < 300;
  return (
    <span
      className={`label-mono rounded-full px-2 py-0.5 ${
        ok ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
      }`}
    >
      {status}
    </span>
  );
}

export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-1.5 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
