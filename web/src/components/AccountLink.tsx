import type { MouseEvent } from "react";
import { navigate } from "@/state/filters";

/** Every account name links to Account 360 (PLAN.md Stage 7), keeping the current filters. */
export function AccountLink({ id, name }: { id: unknown; name: unknown }) {
  const q = new URLSearchParams(window.location.search);
  q.set("account", String(id));
  const search = `?${q.toString()}`;
  return (
    <a
      href={`/accounts${search}`}
      onClick={(e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        navigate("/accounts", search);
      }}
      className="font-medium text-foreground underline decoration-brand-accent underline-offset-4 hover:text-brand-accent"
    >
      {String(name)}
    </a>
  );
}
