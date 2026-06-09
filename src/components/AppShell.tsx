import { type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  Home,
  GraduationCap,
  BookOpen,
  ClipboardList,
  AlertTriangle,
  Settings,
  LogOut,
  User as UserIcon,
  School,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile, useMyRoles, hasRole } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: profile } = useMyProfile(user?.id);
  const { data: roles } = useMyRoles(user?.id);
  const router = useRouter();

  const isAdmin = hasRole(roles, "admin");
  const isProf = hasRole(roles, "professeur");
  const isCpe = hasRole(roles, "cpe");

  const nav = [
    { to: "/feed", label: "Fil d'actualité", icon: Home, show: true },
    { to: "/devoirs", label: "Devoirs", icon: BookOpen, show: true },
    { to: "/notes", label: "Notes", icon: GraduationCap, show: true },
    { to: "/classes", label: "Classes", icon: School, show: true },
    { to: "/discipline", label: "Vie scolaire", icon: AlertTriangle, show: isAdmin || isCpe || isProf },
    { to: "/admin", label: "Administration", icon: Settings, show: isAdmin },
  ];

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  const initial = (profile?.full_name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6 md:flex-row md:px-6 md:py-8">
        {/* Sidebar */}
        <aside className="glass rounded-3xl p-4 md:sticky md:top-6 md:h-[calc(100dvh-3rem)] md:w-64 md:shrink-0">
          <div className="mb-6 flex items-center gap-3 px-2 pt-2">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-semibold">
              S
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Scholar</p>
              <p className="text-xs text-muted-foreground leading-tight">Espace scolaire</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {nav
              .filter((n) => n.show)
              .map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{
                    className:
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium bg-primary/10 text-primary",
                  }}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
          </nav>

          <div className="mt-6 border-t border-border/60 pt-4">
            <Link
              to="/profil"
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-secondary"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-accent/30 text-sm font-semibold">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{profile?.full_name || "Mon profil"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {roles?.[0] === "admin"
                    ? "Administrateur"
                    : roles?.[0] === "professeur"
                      ? "Professeur"
                      : roles?.[0] === "cpe"
                        ? "Vie scolaire"
                        : "Élève"}
                </p>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="mt-2 w-full justify-start gap-2 text-muted-foreground"
            >
              <LogOut className="size-4" />
              Se déconnecter
            </Button>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 animate-float-in">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </header>
  );
}
