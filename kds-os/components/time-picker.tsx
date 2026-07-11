"use client";
import { useState } from "react";
import { Clock } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export function fmtTime(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

// 항목의 시작/종료 시간을 지정하는 인라인 팝오버.
// dateAnchor(YYYY-MM-DD)의 그 날짜에 시각을 얹어 timestamptz로 저장.
export function TimePicker({
  itemId,
  dateAnchor,
  startAt,
  endAt,
  onChanged,
}: {
  itemId: string;
  dateAnchor: string;
  startAt: string | null;
  endAt: string | null;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const start = fmtTime(startAt);
  const end = fmtTime(endAt);

  async function setTime(field: "start_at" | "end_at", hhmm: string) {
    const value = hhmm
      ? new Date(`${dateAnchor}T${hhmm}:00`).toISOString()
      : null;
    await supabase.from("items").update({ [field]: value }).eq("id", itemId);
    onChanged?.();
  }

  async function clear() {
    await supabase
      .from("items")
      .update({ start_at: null, end_at: null })
      .eq("id", itemId);
    setOpen(false);
    onChanged?.();
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={
          start
            ? "rounded-full bg-ink-100 px-2 py-0.5 font-mono text-[10px] text-ink-500 hover:text-signal-600"
            : "flex h-5 w-5 items-center justify-center rounded text-ink-300 hover:text-signal-600"
        }
        title="시간 지정"
      >
        {start ? (end ? `${start}~${end}` : start) : (
          <Clock className="h-3.5 w-3.5" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 flex w-[180px] flex-col gap-2 rounded-card border-[0.5px] border-ink-200 bg-ink-0 p-3 shadow-sm">
            <label className="flex items-center justify-between gap-2 font-mono text-[11px] text-ink-500">
              시작
              <input
                key={`s-${startAt ?? ""}`}
                type="time"
                defaultValue={start ?? ""}
                onChange={(e) => setTime("start_at", e.target.value)}
                className="h-7 rounded border-[0.5px] border-ink-200 bg-ink-0 px-1.5 text-xs text-ink-700 outline-none"
              />
            </label>
            <label className="flex items-center justify-between gap-2 font-mono text-[11px] text-ink-500">
              종료
              <input
                key={`e-${endAt ?? ""}`}
                type="time"
                defaultValue={end ?? ""}
                onChange={(e) => setTime("end_at", e.target.value)}
                className="h-7 rounded border-[0.5px] border-ink-200 bg-ink-0 px-1.5 text-xs text-ink-700 outline-none"
              />
            </label>
            {start && (
              <button
                onClick={clear}
                className="self-start font-mono text-[11px] text-ink-400 hover:text-signal-600"
              >
                시간 지우기
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}