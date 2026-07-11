"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useProject } from "@/components/app-shell";
import { SystemLine } from "@/components/system-line";
import { fmtTime } from "@/components/time-picker";
import type { Item, Project } from "@/types/db";

function fmt(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
const todayStr = () => fmt(new Date());
const monthDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(m)}.${Number(d)}`;
};
const WEEKDAY = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// 해당 월을 월요일 시작 그리드로 (앞뒤 이웃달 포함)
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const cells: { date: Date; inMonth: boolean }[] = [];
  const cur = new Date(start);
  while (true) {
    cells.push({ date: new Date(cur), inMonth: cur.getMonth() === month });
    cur.setDate(cur.getDate() + 1);
    if (cur.getMonth() !== month && cur.getDay() === 1 && cells.length >= 28)
      break;
    if (cells.length > 42) break;
  }
  return cells;
}

export default function CalendarPage() {
  const { projects } = useProject();
  const projColor = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p: Project) => (map[p.id] = p.color ?? "#7F77DD"));
    return map;
  }, [projects]);
  const projName = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p: Project) => (map[p.id] = p.name));
    return map;
  }, [projects]);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [items, setItems] = useState<Record<string, Item[]>>({});
  const [reviews, setReviews] = useState<Record<string, Item[]>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const today = todayStr();
  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const rangeStart = fmt(cells[0].date);
  const rangeEnd = fmt(cells[cells.length - 1].date);

  const load = useCallback(async () => {
    const { data: its } = await supabase
      .from("items")
      .select("id,title,type,project_id,due_date,focus_date,status,start_at,end_at")
      .eq("is_archived", false)
      .neq("type", "review")
      .or(
        `and(due_date.gte.${rangeStart},due_date.lte.${rangeEnd}),and(focus_date.gte.${rangeStart},focus_date.lte.${rangeEnd})`,
      );
    const byDay: Record<string, Item[]> = {};
    ((its as Item[]) ?? []).forEach((r) => {
      const seen = new Set<string>();
      [r.due_date, r.focus_date].forEach((dd) => {
        if (dd && dd >= rangeStart && dd <= rangeEnd && !seen.has(dd)) {
          seen.add(dd);
          (byDay[dd] ??= []).push(r);
        }
      });
    });
    setItems(byDay);

    const { data: revs } = await supabase
      .from("items")
      .select("id,title,due_date,created_at")
      .eq("type", "review")
      .eq("is_archived", false)
      .gte("due_date", rangeStart)
      .lte("due_date", rangeEnd)
      .order("created_at", { ascending: true });
    const revByDay: Record<string, Item[]> = {};
    ((revs as Item[]) ?? []).forEach((r) => {
      if (r.due_date) (revByDay[r.due_date] ??= []).push(r);
    });
    setReviews(revByDay);
    setLoaded(true);
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    load();
  }, [load]);

  function move(diff: number) {
    const d = new Date(year, month + diff, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelectedDay(null);
  }
  function goThisMonth() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDay(null);
  }

  if (!loaded) return <SystemLine>불러오는 중…</SystemLine>;

  const isThisMonth =
    year === now.getFullYear() && month === now.getMonth();
  const selectedItems = selectedDay ? (items[selectedDay] ?? []) : [];
  const selectedReviews = selectedDay ? (reviews[selectedDay] ?? []) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SystemLine>
          {year}년 {month + 1}월.
        </SystemLine>
        <div className="flex items-center gap-1">
          <button
            onClick={() => move(-1)}
            className="rounded p-0.5 text-ink-400 hover:text-signal-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {!isThisMonth && (
            <button
              onClick={goThisMonth}
              className="rounded px-1.5 font-mono text-[11px] text-ink-400 hover:text-signal-600"
            >
              이번 달
            </button>
          )}
          <button
            onClick={() => move(1)}
            className="rounded p-0.5 text-ink-400 hover:text-signal-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div>
        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAY.map((w) => (
            <p
              key={w}
              className="text-center font-mono text-[10px] text-ink-400"
            >
              {w}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map(({ date, inMonth }) => {
            const key = fmt(date);
            const dayItems = items[key] ?? [];
            const hasReview = (reviews[key] ?? []).length > 0;
            const isToday = key === today;
            const isSelected = key === selectedDay;
            return (
              <button
                key={key}
                onClick={() =>
                  setSelectedDay(isSelected ? null : key)
                }
                className={
                  "flex min-h-[56px] flex-col items-center rounded-md py-1.5 transition " +
                  (isSelected
                    ? "bg-signal-50"
                    : isToday
                      ? "border border-signal-400"
                      : inMonth
                        ? "bg-ink-100 hover:bg-ink-200/60"
                        : "bg-transparent")
                }
              >
                <span
                  className={
                    "font-mono text-[11px] " +
                    (isSelected
                      ? "text-signal-800"
                      : isToday
                        ? "text-signal-400"
                        : inMonth
                          ? "text-ink-500"
                          : "text-ink-300")
                  }
                >
                  {date.getDate()}
                </span>
                <div className="mt-1 flex max-w-full flex-wrap items-center justify-center gap-[3px] px-1">
                  {dayItems.slice(0, 4).map((it) => (
                    <span
                      key={it.id}
                      className="h-[5px] w-[5px] rounded-full"
                      style={{
                        background: it.project_id
                          ? (projColor[it.project_id] ?? "#7F77DD")
                          : "#7F77DD",
                        opacity: it.status === "done" ? 0.35 : 1,
                      }}
                    />
                  ))}
                  {dayItems.length > 4 && (
                    <span className="font-mono text-[8px] text-ink-400">
                      +
                    </span>
                  )}
                  {hasReview && (
                    <span className="h-[5px] w-[5px] rounded-full bg-ink-300" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 범례 — 이번 달에 등장하는 것만 */}
        {(() => {
          const allItems = Object.values(items).flat();
          const usedProjects = [
            ...new Set(
              allItems
                .map((it) => it.project_id)
                .filter((v): v is string => !!v),
            ),
          ].filter((id) => projName[id]);
          const hasNone = allItems.some((it) => !it.project_id);
          const hasReview = Object.keys(reviews).length > 0;
          const hasDone = allItems.some((it) => it.status === "done");
          if (allItems.length === 0 && !hasReview) return null;
          return (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-ink-400">
              {usedProjects.map((id) => (
                <span key={id} className="flex items-center gap-1">
                  <span
                    className="h-[5px] w-[5px] rounded-full"
                    style={{ background: projColor[id] }}
                  />
                  {projName[id]}
                </span>
              ))}
              {hasNone && (
                <span className="flex items-center gap-1">
                  <span className="h-[5px] w-[5px] rounded-full bg-signal-400" />
                  미지정
                </span>
              )}
              {hasReview && (
                <span className="flex items-center gap-1">
                  <span className="h-[5px] w-[5px] rounded-full bg-ink-300" />
                  회고
                </span>
              )}
              {hasDone && <span>흐림 = 완료</span>}
            </div>
          );
        })()}
      </div>

      {selectedDay && (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] text-ink-400">
            {monthDay(selectedDay)}
            {selectedItems.length === 0
              ? " · 항목 없음"
              : ` · ${selectedItems.length}개`}
          </p>
          {selectedItems.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {selectedItems.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center gap-2 rounded-card border-[0.5px] border-ink-200 bg-ink-0 px-3.5 py-2 text-sm"
                >
                  <span className="font-mono text-[10px] text-ink-400">
                    {it.type}
                  </span>
                  <span
                    className={
                      "flex-1 truncate " +
                      (it.status === "done"
                        ? "text-ink-400 line-through"
                        : "text-ink-700")
                    }
                  >
                    {it.title}
                  </span>
                  {it.start_at && (
                    <span className="shrink-0 font-mono text-[10px] text-ink-400">
                      {fmtTime(it.start_at)}
                      {it.end_at ? `~${fmtTime(it.end_at)}` : ""}
                    </span>
                  )}
                  {it.project_id && projName[it.project_id] && (
                    <span className="shrink-0 rounded-full bg-signal-50 px-2 py-0.5 font-mono text-[10px] text-signal-800">
                      {projName[it.project_id]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {selectedReviews.length > 0 && (
            <div className="rounded-card border-[0.5px] border-ink-200 bg-ink-100 px-3.5 py-2.5">
              <p className="mb-1.5 font-mono text-[10px] text-ink-400">
                그날의 회고 · {selectedReviews.length}개
              </p>
              <ul className="flex flex-col gap-1">
                {selectedReviews.map((r) => (
                  <li key={r.id} className="text-sm text-ink-700">
                    · {r.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}