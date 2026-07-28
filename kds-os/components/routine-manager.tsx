"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Pause, Play, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useProject } from "@/components/app-shell";
import type { Routine, RoutineFreq } from "@/types/db";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const FREQS: { key: RoutineFreq; label: string }[] = [
  { key: "daily", label: "매일" },
  { key: "weekly", label: "매주" },
  { key: "biweekly", label: "격주" },
  { key: "monthly", label: "매월" },
];

export function freqLabel(r: Routine) {
  if (r.freq === "daily") return "매일";
  const days = (r.weekdays ?? []).map((d) => DAYS[d]).join("·");
  if (r.freq === "weekly") return `매주 ${days}`;
  if (r.freq === "biweekly") return `격주 ${days}`;
  return `매월 ${r.month_day ?? 1}일`;
}

export function RoutineManager({ onChanged }: { onChanged?: () => void }) {
  const { userId, projects } = useProject();
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [title, setTitle] = useState("");
  const [freq, setFreq] = useState<RoutineFreq>("daily");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [monthDay, setMonthDay] = useState(1);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("routines")
      .select("*")
      .order("created_at", { ascending: true });
    setRoutines((data as Routine[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    const t = title.trim();
    if (!t || !userId) return;
    if ((freq === "weekly" || freq === "biweekly") && weekdays.length === 0)
      return;
    await supabase.from("routines").insert({
      user_id: userId,
      title: t,
      freq,
      weekdays: freq === "weekly" || freq === "biweekly" ? weekdays : null,
      month_day: freq === "monthly" ? monthDay : null,
      project_id: projectId,
    });
    setTitle("");
    setWeekdays([]);
    load();
    onChanged?.();
  }

  async function toggleActive(r: Routine) {
    await supabase
      .from("routines")
      .update({ is_active: !r.is_active })
      .eq("id", r.id);
    load();
    onChanged?.();
  }

  async function remove(id: string) {
    await supabase.from("routines").delete().eq("id", id);
    setConfirmId(null);
    load();
    onChanged?.();
  }

  if (!routines) return null;

  return (
    <div className="flex flex-col gap-3 rounded-panel border-[0.5px] border-ink-200 bg-ink-0 p-4">
      {/* 추가 폼 */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="루틴 이름 (예: 아침 스트레칭)"
            className="h-8 min-w-[180px] flex-1 rounded border-[0.5px] border-ink-200 bg-ink-0 px-3 text-sm text-ink-700 outline-none focus:border-signal-400"
          />
          <select
            value={freq}
            onChange={(e) => setFreq(e.target.value as RoutineFreq)}
            className="h-8 shrink-0 rounded border-[0.5px] border-ink-200 bg-ink-0 px-2 text-xs text-ink-500 outline-none"
          >
            {FREQS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={projectId ?? ""}
            onChange={(e) => setProjectId(e.target.value || null)}
            className="h-8 shrink-0 rounded border-[0.5px] border-ink-200 bg-ink-0 px-2 text-xs text-ink-500 outline-none"
          >
            <option value="">프로젝트 없음</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            className="flex h-8 shrink-0 items-center gap-1 rounded bg-signal-400 px-3 text-sm font-medium text-white active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            추가
          </button>
        </div>

        {(freq === "weekly" || freq === "biweekly") && (
          <div className="flex items-center gap-1">
            {DAYS.map((d, i) => (
              <button
                key={d}
                onClick={() =>
                  setWeekdays((prev) =>
                    prev.includes(i)
                      ? prev.filter((x) => x !== i)
                      : [...prev, i].sort(),
                  )
                }
                className={
                  "h-7 w-7 rounded-full font-mono text-[11px] transition " +
                  (weekdays.includes(i)
                    ? "bg-signal-400 text-white"
                    : "bg-ink-100 text-ink-500 hover:bg-ink-200/60")
                }
              >
                {d}
              </button>
            ))}
            {freq === "biweekly" && (
              <span className="ml-1 font-mono text-[10px] text-ink-400">
                이번 주 기준 2주마다
              </span>
            )}
          </div>
        )}
        {freq === "monthly" && (
          <label className="flex items-center gap-2 font-mono text-[11px] text-ink-500">
            매월
            <input
              type="number"
              min={1}
              max={31}
              value={monthDay}
              onChange={(e) =>
                setMonthDay(Math.min(31, Math.max(1, Number(e.target.value))))
              }
              className="h-7 w-14 rounded border-[0.5px] border-ink-200 bg-ink-0 px-2 text-xs text-ink-700 outline-none"
            />
            일 (짧은 달엔 말일)
          </label>
        )}
      </div>

      {/* 목록 */}
      {routines.length === 0 ? (
        <p className="font-mono text-[11px] text-ink-400">
          아직 루틴 없음. 매일/매주 반복하는 걸 등록해보세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {routines.map((r) => (
            <li
              key={r.id}
              className={
                "flex items-center gap-2 rounded-card border-[0.5px] border-ink-200 px-3 py-2 text-sm " +
                (r.is_active ? "bg-ink-0" : "bg-ink-50 opacity-60")
              }
            >
              <span className="flex-1 truncate text-ink-700">{r.title}</span>
              <span className="shrink-0 font-mono text-[10px] text-ink-400">
                {freqLabel(r)}
              </span>
              {r.project_id &&
                projects.find((p) => p.id === r.project_id) && (
                  <span className="shrink-0 rounded-full bg-signal-50 px-2 py-0.5 font-mono text-[10px] text-signal-800">
                    {projects.find((p) => p.id === r.project_id)!.name}
                  </span>
                )}
              <button
                onClick={() => toggleActive(r)}
                className="shrink-0 text-ink-400 hover:text-signal-600"
                title={r.is_active ? "일시정지" : "재개"}
              >
                {r.is_active ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => {
                  if (confirmId === r.id) {
                    remove(r.id);
                  } else {
                    setConfirmId(r.id);
                    setTimeout(
                      () => setConfirmId((c) => (c === r.id ? null : c)),
                      2500,
                    );
                  }
                }}
                className={
                  "flex shrink-0 items-center gap-1 " +
                  (confirmId === r.id ? "text-danger" : "text-ink-400 hover:text-danger")
                }
                title="삭제 (이미 생성된 항목은 유지)"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmId === r.id && (
                  <span className="font-mono text-[10px]">한 번 더</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}