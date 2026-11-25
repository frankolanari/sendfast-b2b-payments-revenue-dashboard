import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { applyTheme, saveTheme, storedTheme } from "@/design/theme";
import type { Mode } from "@/design/tokens";
import { AccountPage } from "@/pages/AccountPage";
import { PipelinePage } from "@/pages/PipelinePage";
import { RiskPage } from "@/pages/RiskPage";
import { RevenuePage } from "@/pages/RevenuePage";
import { navigate, usePath } from "@/state/filters";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: 1 } },
});

const PAGES = [
  { path: "/pipeline", label: "Pipeline & funnel", title: "Pipeline & funnel" },
  {
    path: "/revenue",
    label: "Revenue & retention",
    title: "Revenue & retention",
  },
  {
    path: "/risk",
    label: "Account health & risk",
    title: "Account health & risk",
  },
  { path: "/accounts", label: "Account 360", title: "Account 360" },
] as const;

function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(storedTheme);
  const next: Mode = mode === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        saveTheme(next);
        setMode(next);
      }}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="grid size-9 place-items-center rounded-lg text-ink-secondary transition-colors hover:bg-foreground/10 hover:text-foreground"
    >
      {mode === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}

function NavLink({
  path,
  label,
  active,
}: {
  path: string;
  label: string;
  active: boolean;
}) {
  const go = (e: MouseEvent) => {
    e.preventDefault();
    navigate(path);
  };
  return (
    <a
      href={path}
      onClick={go}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-lg bg-foreground/10 px-3 py-1.5 font-medium"
          : "rounded-lg px-3 py-1.5 text-ink-secondary hover:text-foreground"
      }
    >
      {label}
    </a>
  );
}

export function App() {
  const path = usePath();
  const page = PAGES.find((p) => path.startsWith(p.path)) ?? PAGES[0];
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <header className="glass-bar sticky top-2 z-20 mx-auto mt-2 flex max-w-6xl items-center gap-6 rounded-2xl px-4 py-2">
          <span className="font-display text-xl tracking-tight">SendFast</span>
          <nav className="flex gap-1 text-sm" aria-label="Pages">
            {PAGES.map((p) => (
              <NavLink
                key={p.path}
                path={p.path}
                label={p.label}
                active={p === page}
              />
            ))}
          </nav>
          <span className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
            Synthetic data
          </span>
          <ThemeToggle />
        </header>

        <main id="main" className="mx-auto max-w-6xl px-4 pb-16 pt-8">
          <h1 className="font-display text-5xl tracking-tight">{page.title}</h1>
          <div className="mt-6">
            {page.path === "/revenue" ? (
              <RevenuePage />
            ) : page.path === "/risk" ? (
              <RiskPage />
            ) : page.path === "/accounts" ? (
              <AccountPage />
            ) : (
              <PipelinePage />
            )}
          </div>
        </main>
      </div>
    </QueryClientProvider>
  );
}
