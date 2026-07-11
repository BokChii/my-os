"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useProject } from "@/components/app-shell";
import { SystemLine } from "@/components/system-line";
import type { Item, Project } from "@/types/db";

function fmt(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
const monthDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(m)}.${Number(d)}`;
};
function weekRange(offset: number) {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const day = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - day);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { wStart: fmt(mon), wEnd: fmt(sun) };
}

export default function WeeklyReview() {
  const { projects } = useProject();
  const projName = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p: Project) => (map[p.id] = p.name));
    return map;
  }, [projects]);
  const projColor = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p: Project) => (map[p.id] = p.color ?? "#9C9A90"));
    return map;
  }, [projects]);

  const [weekOffset, setWeekOffset] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [reviews, setReviews] = useState<Item[]>([]);
  const [linkCount, setLinkCount] = useState(0);
  const [clearedDays, setClearedDays] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const { wStart, wEnd } = weekRange(weekOffset);

  const load = useCallback(async () => {
    const { data: its } = await supabase
      .from("items")
      .select("*")
      .eq("is_archived", false)
      .neq("type", "review")
      .or(
        `and(due_date.gte.${wStart},due_date.lte.${wEnd}),and(focus_date.gte.${wStart},focus_date.lte.${wEnd})`,
      );
    setItems((its as Item[]) ?? []);

    const { data: revs } = await supabase
      .from("items")
      .select("*")
      .eq("type", "review")
      .eq("is_archived", false)
      .gte("due_date", wStart)
      .lte("due_date", wEnd)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: true });
    setReviews((revs as Item[]) ?? []);

    const { count } = await supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("type", "link")
      .gte("created_at", `${wStart}T00:00:00`)
      .lte("created_at", `${wEnd}T23:59:59`);
    setLinkCount(count ?? 0);

    const { data: logs } = await supabase
      .from("daily_logs")
      .select("log_date,cleared")
      .gte("log_date", wStart)
      .lte("log_date", wEnd);
    setClearedDays(
      ((logs as { cleared: boolean }[]) ?? []).filter((l) => l.cleared).length,
    );

    setLoaded(true);
  }, [wStart, wEnd]);

  useEffect(() => {
    load();
  }, [load]);

  if (!loaded) return <SystemLine>불러오는 중…</SystemLine>;

  const done = items.filter((it) => it.status === "done");
  const undone = items.filter((it) => it.status !== "done");

  // 프로젝트별 완료 분포
  const dist: Record<string, number> = {};
  done.forEach((it) => {
    const key = it.project_id ?? "__none";
    dist[key] = (dist[key] ?? 0) + 1;
  });
  const distSorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  const distMax = Math.max(1, ...distSorted.map(([, n]) => n));

  // 회고 날짜별 그룹
  const revByDay: Record<string, Item[]> = {};
  reviews.forEach((r) => {
    if (r.due_date) (revByDay[r.due_date] ??= []).push(r);
  });

  const weekLabel =
    weekOffset === 0 ? "이번 주" : weekOffset === -1 ? "지난주" : "";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <SystemLine>
          {monthDay(wStart)} ~ {monthDay(wEnd)}
          {weekLabel && ` · ${weekLabel}`} 주간 리뷰.
        </SystemLine>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="rounded p-0.5 text-ink-400 hover:text-signal-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded px-1.5 font-mono text-[11px] text-ink-400 hover:text-signal-600"
            >
              이번 주
            </button>
          )}
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            disabled={weekOffset >= 0}
            className="rounded p-0.5 text-ink-400 hover:text-signal-600 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 숫자 요약 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "완료", value: done.length },
          { label: "미션 클리어", value: `${clearedDays}일` },
          { label: "저장한 링크", value: linkCount },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-card border-[0.5px] border-ink-200 bg-ink-0 px-4 py-3"
          >
            <p className="font-mono text-[11px] text-ink-400">{m.label}</p>
            <p className="mt-1 font-mono text-[22px] font-medium text-ink-900">
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* 프로젝트별 분포 */}
      <div>
        <p className="mb-2 font-mono text-[11px] tracking-wide text-ink-400">
          프로젝트별 완료
        </p>
        {distSorted.length === 0 ? (
          <p className="font-mono text-[12px] text-ink-400">
            이번 주 완료 항목 없음
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {distSorted.map(([key, n]) => {
              const name = key === "__none" ? "미지정" : (projName[key] ?? "미지정");
              const color = key === "__none" ? "#CBC9C1" : (projColor[key] ?? "#9C9A90");
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 truncate text-sm text-ink-700">
                    {name}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(n / distMax) * 100}%`,
                        background: color,
                      }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right font-mono text-[12px] text-ink-500">
                    {n}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 이번 주 회고 */}
      <div>
        <p className="mb-2 font-mono text-[11px] tracking-wide text-ink-400">
          이번 주 회고 · {reviews.length}개
        </p>
        {reviews.length === 0 ? (
          <p className="font-mono text-[12px] text-ink-400">
            남긴 회고 없음
          </p>
        ) : (
          <div className="rounded-panel border-[0.5px] border-ink-200 bg-ink-0 p-4">
            <div className="flex flex-col gap-3">
              {Object.entries(revByDay).map(([day, list]) => (
                <div key={day}>
                  <p className="mb-1 font-mono text-[10px] text-ink-400">
                    {monthDay(day)}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {list.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-start gap-2 text-sm text-ink-700"
                      >
                        <span className="mt-[2px] font-mono text-[11px] text-signal-400">
                          ›
                        </span>
                        <span className="flex-1">{r.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 못 끝낸 것 */}
      {undone.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[11px] tracking-wide text-ink-400">
            못 끝낸 것 · {undone.length}개
          </p>
          <ul className="flex flex-col gap-1.5">
            {undone.map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-2 rounded-card border-[0.5px] border-ink-200 bg-ink-0 px-3.5 py-2 text-sm text-ink-700"
              >
                <span className="flex-1 truncate">{it.title}</span>
                {it.project_id && projName[it.project_id] && (
                  <span className="shrink-0 rounded-full bg-signal-50 px-2 py-0.5 font-mono text-[10px] text-signal-800">
                    {projName[it.project_id]}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[11px] text-ink-400">
            다음 주 today의 이월 배너에서 가져올 수 있어요.
          </p>
        </div>
      )}
    </div>
  );
}