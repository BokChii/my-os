"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Project } from "@/types/db";
import { CommandPalette } from "./command-palette";

type Ctx = { active: string | null; userId: string; projects: Project[] };
const ProjectCtx = createContext<Ctx>({
  active: null,
  userId: "",
  projects: [],
});
export const useProject = () => useContext(ProjectCtx);

function Pill({
  on,
  children,
  onClick,
}: {
  on: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full px-3 py-1 text-[13px] transition " +
        (on
          ? "bg-signal-50 font-medium text-signal-800"
          : "border-[0.5px] border-ink-200 text-ink-500 hover:border-ink-300")
      }
    >
      {children}
    </button>
  );
}

const NAV = [
  { href: "/", label: "today" },
  { href: "/inbox", label: "inbox" },
  { href: "/links", label: "links" },
  { href: "/projects", label: "projects" },
];

export function AppShell({
  userId,
  projects,
  children,
}: {
  userId: string;
  projects: Project[];
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCaptureOpen(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // 프로젝트 섹션(/projects, /projects/[id])에선 상단 스위처를 숨김
  const isProjectSection = pathname.startsWith("/projects");

  const today = new Date()
    .toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
    })
    .toUpperCase();

  return (
    <ProjectCtx.Provider value={{ active, userId, projects }}>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between border-b-[0.5px] border-ink-200 px-5 py-3.5">
          <div className="flex items-center gap-5">
            <Link
              href="/"
              className="font-mono text-[17px] font-medium tracking-tight text-signal-400 transition hover:text-signal-600"
            >
              KDS_OS
            </Link>
            <nav className="flex gap-3 font-mono text-[13px]">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={
                    "transition " +
                    (pathname === n.href
                      ? "font-medium text-signal-600"
                      : "text-ink-400 hover:text-ink-700")
                  }
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCaptureOpen(true)}
              className="rounded border-[0.5px] border-ink-200 px-2 py-1 font-mono text-[12px] text-ink-400 hover:border-ink-300 hover:text-ink-500"
            >
              ⌘K
            </button>
            <span className="font-mono text-[13px] text-ink-400">{today}</span>
          </div>
        </div>

        {!isProjectSection && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-2.5">
            <Pill on={active === null} onClick={() => setActive(null)}>
              전체
            </Pill>
            {projects.map((p) => (
              <Pill
                key={p.id}
                on={active === p.id}
                onClick={() => setActive(p.id)}
              >
                {p.name}
              </Pill>
            ))}
          </div>
        )}

        <main className="px-5 py-3">{children}</main>
      </div>
      <CommandPalette
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        userId={userId}
        projects={projects}
        activeProject={active}
      />
    </ProjectCtx.Provider>
  );
}