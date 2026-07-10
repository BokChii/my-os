"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Archive, ArchiveRestore, Check, X, Pencil } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useProject } from "@/components/app-shell";
import { SystemLine } from "@/components/system-line";
import type { Project } from "@/types/db";

const COLORS = [
  "#7F77DD", // signal
  "#1D9E75", // teal
  "#EF9F27", // amber
  "#E24B4A", // red
  "#4A9DE2", // blue
  "#9C9A90", // gray
];

type ProjectRow = Project & { is_archived?: boolean };

export default function ProjectsPage() {
  const { userId } = useProject();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("sort_order", { ascending: true });
    setProjects((data as ProjectRow[]) ?? []);

    // 프로젝트별 항목 수(보관 안 된 것)
    const { data: items } = await supabase
      .from("items")
      .select("project_id")
      .eq("is_archived", false);
    const c: Record<string, number> = {};
    ((items as { project_id: string | null }[]) ?? []).forEach((it) => {
      if (it.project_id) c[it.project_id] = (c[it.project_id] ?? 0) + 1;
    });
    setCounts(c);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addProject() {
    const name = newName.trim();
    if (!name || !userId) return;
    const maxOrder = Math.max(0, ...(projects ?? []).map((p) => p.sort_order));
    await supabase.from("projects").insert({
      user_id: userId,
      name,
      color: COLORS[0],
      sort_order: maxOrder + 1,
    });
    setNewName("");
    load();
  }

  async function rename(id: string) {
    const name = editName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    await supabase.from("projects").update({ name }).eq("id", id);
    setEditingId(null);
    load();
  }

  async function setColor(id: string, color: string) {
    await supabase.from("projects").update({ color }).eq("id", id);
    load();
  }

  async function toggleArchive(p: ProjectRow) {
    await supabase
      .from("projects")
      .update({ is_archived: !p.is_archived })
      .eq("id", p.id);
    load();
  }

  if (!projects) return <SystemLine>불러오는 중…</SystemLine>;

  const active = projects.filter((p) => !p.is_archived);
  const archived = projects.filter((p) => p.is_archived);

  return (
    <div className="flex flex-col gap-4">
      <SystemLine>프로젝트 {active.length}개.</SystemLine>

      {/* 새 프로젝트 추가 */}
      <div className="flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addProject()}
          placeholder="새 프로젝트 이름…"
          className="h-9 flex-1 rounded border-[0.5px] border-ink-200 bg-ink-0 px-3 text-sm text-ink-700 outline-none focus:border-signal-400"
        />
        <button
          onClick={addProject}
          className="flex h-9 shrink-0 items-center gap-1 rounded bg-signal-400 px-3 text-sm font-medium text-white transition active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          추가
        </button>
      </div>

      {/* 활성 프로젝트 목록 */}
      <ul className="flex flex-col gap-1.5">
        {active.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-card border-[0.5px] border-ink-200 bg-ink-0 px-3.5 py-2.5"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: p.color ?? "#9C9A90" }}
            />
            {editingId === p.id ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") rename(p.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onBlur={() => rename(p.id)}
                className="flex-1 border-none bg-transparent text-sm text-ink-900 outline-none"
              />
            ) : (
              <Link
                href={`/projects/${p.id}`}
                className="flex-1 truncate text-sm text-ink-700 hover:text-signal-600"
              >
                {p.name}
              </Link>
            )}

            <span className="font-mono text-[11px] text-ink-400">
              {counts[p.id] ?? 0}개
            </span>

            {/* 색상 선택 */}
            <div className="flex shrink-0 items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(p.id, c)}
                  className={
                    "h-3.5 w-3.5 rounded-full transition " +
                    (p.color === c ? "ring-2 ring-ink-300 ring-offset-1" : "")
                  }
                  style={{ background: c }}
                  title="색상"
                />
              ))}
            </div>

            {editingId === p.id ? (
              <button
                onClick={() => rename(p.id)}
                className="shrink-0 text-signal-600"
              >
                <Check className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditingId(p.id);
                  setEditName(p.name);
                }}
                className="shrink-0 text-ink-400 hover:text-signal-600"
                title="이름 변경"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => toggleArchive(p)}
              className="shrink-0 text-ink-400 hover:text-warning"
              title="보관"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {/* 보관된 프로젝트 */}
      {archived.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="mb-1.5 font-mono text-[11px] text-ink-400 hover:text-ink-500"
          >
            {showArchived ? "▾" : "▸"} 보관됨 {archived.length}개
          </button>
          {showArchived && (
            <ul className="flex flex-col gap-1.5">
              {archived.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-card border-[0.5px] border-ink-200 bg-ink-50 px-3.5 py-2.5"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full opacity-50"
                    style={{ background: p.color ?? "#9C9A90" }}
                  />
                  <span className="flex-1 truncate text-sm text-ink-400">
                    {p.name}
                  </span>
                  <button
                    onClick={() => toggleArchive(p)}
                    className="shrink-0 text-ink-400 hover:text-signal-600"
                    title="복원"
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="font-mono text-[11px] text-ink-400">
        보관해도 항목은 사라지지 않아요. 스위처에서만 숨겨져요.
      </p>
    </div>
  );
}