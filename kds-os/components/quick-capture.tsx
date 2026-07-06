"use client";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase/client";
import type { Project } from "@/types/db";

function parse(raw: string) {
  const m = raw.match(/https?:\/\/[^\s]+/);
  if (m)
    return {
      type: "link" as const,
      url: m[0],
      title: raw.replace(m[0], "").trim() || m[0],
    };
  return { type: "task" as const, url: null as string | null, title: raw.trim() };
}

export function QuickCapture({
  open,
  onOpenChange,
  userId,
  projects,
  activeProject,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  projects: Project[];
  activeProject: string | null;
}) {
  const [raw, setRaw] = useState("");
  const [projectId, setProjectId] = useState<string | null>(activeProject);
  const [due, setDue] = useState("");
  const [saved, setSaved] = useState(false);
  const preview = parse(raw);

  async function save() {
    if (!raw.trim()) return;
    const p = parse(raw);
    await supabase.from("items").insert({
      user_id: userId,
      type: p.type,
      title: p.title,
      url: p.url,
      project_id: projectId,
      due_date: due || null,
      status: "inbox",
    });
    setRaw("");
    setDue("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-3 rounded-panel border-[0.5px] border-ink-200 bg-ink-0 p-4">
        <input
          autoFocus
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="무엇이든 빠르게… (URL이면 링크로 저장)"
          className="h-10 w-full border-none bg-transparent text-[15px] text-ink-900 outline-none placeholder:text-ink-400"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 font-mono text-[11px] text-ink-500">
            {preview.type}
          </span>
          <select
            value={projectId ?? ""}
            onChange={(e) => setProjectId(e.target.value || null)}
            className="h-7 min-w-0 flex-1 rounded border-[0.5px] border-ink-200 bg-ink-0 px-2 text-xs text-ink-500 outline-none"
          >
            <option value="">프로젝트 없음</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-7 w-[130px] shrink-0 rounded border-[0.5px] border-ink-200 bg-ink-0 px-2 text-xs text-ink-500 outline-none"
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] text-ink-400">
            enter로 저장하고 계속 입력 · esc로 닫기
          </p>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="font-mono text-[11px] text-signal-400">
                › 저장됨
              </span>
            )}
            <button
              onClick={save}
              className="h-8 shrink-0 rounded bg-signal-400 px-4 text-sm font-medium text-white active:scale-[0.98]"
            >
              저장
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}