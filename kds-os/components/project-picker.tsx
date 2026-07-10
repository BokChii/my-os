"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useProject } from "@/components/app-shell";

// 항목의 프로젝트를 바꾸는 인라인 pill+드롭다운.
// 클릭하면 프로젝트 목록이 뜨고, 고르면 즉시 저장 + onChanged 콜백.
export function ProjectPicker({
  itemId,
  projectId,
  onChanged,
}: {
  itemId: string;
  projectId: string | null;
  onChanged?: (newProjectId: string | null) => void;
}) {
  const { projects } = useProject();
  const [open, setOpen] = useState(false);
  const current = projects.find((p) => p.id === projectId);

  async function pick(id: string | null) {
    setOpen(false);
    await supabase.from("items").update({ project_id: id }).eq("id", itemId);
    onChanged?.(id);
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={
          "rounded-full px-2 py-0.5 font-mono text-[10px] transition " +
          (current
            ? "bg-signal-50 text-signal-800"
            : "border-[0.5px] border-dashed border-ink-300 text-ink-400 hover:border-signal-400 hover:text-signal-600")
        }
        title="프로젝트 지정"
      >
        {current ? (
          <span className="flex items-center gap-1">
            {current.color && (
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: current.color }}
              />
            )}
            {current.name}
          </span>
        ) : (
          "+ 프로젝트"
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 min-w-[140px] rounded-card border-[0.5px] border-ink-200 bg-ink-0 py-1 shadow-sm">
            <button
              onClick={() => pick(null)}
              className="flex w-full items-center px-3 py-1.5 text-left text-xs text-ink-500 hover:bg-ink-100"
            >
              프로젝트 없음
            </button>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p.id)}
                className={
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-ink-100 " +
                  (p.id === projectId ? "text-signal-800" : "text-ink-700")
                }
              >
                {p.color && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: p.color }}
                  />
                )}
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}