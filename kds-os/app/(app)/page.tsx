"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Circle, CircleCheck, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/lib/supabase/client";
import { useProject } from "@/components/app-shell";
import { SystemLine } from "@/components/system-line";
import { ProjectPicker } from "@/components/project-picker";
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

function weekDatesFrom(anchor: Date) {
  const day = (anchor.getDay() + 6) % 7;
  const mon = new Date(anchor);
  mon.setDate(anchor.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}
const WEEKDAY = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// ── 오늘 할 일 한 줄 (드래그 가능) ─────────────────────────
function TodoRow({
  item,
  index,
  isTop,
  isDueToday,
  onToggle,
  onProjectChange,
}: {
  item: Item;
  index: number;
  isTop: boolean;
  isDueToday: boolean;
  onToggle: (it: Item) => void;
  onProjectChange: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const done = item.status === "done";
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        "flex items-center gap-2 rounded-card border px-3 py-3 " +
        (done
          ? "border-[0.5px] border-ink-200 bg-ink-0"
          : isTop
            ? "border-signal-400 bg-ink-0"
            : "border-[0.5px] border-ink-200 bg-ink-0")
      }
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-ink-300 hover:text-ink-400 active:cursor-grabbing"
        title="드래그로 순서 변경"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className={
          "w-5 font-mono text-[13px] font-medium " +
          (done ? "text-ink-400" : isTop ? "text-signal-400" : "text-ink-400")
        }
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <span
        className={
          "flex-1 truncate text-sm " +
          (done ? "text-ink-400 line-through" : "text-ink-700")
        }
      >
        {item.title}
      </span>
      {isDueToday && !done && (
        <span className="shrink-0 rounded-full border-[0.5px] border-warning px-2 py-0.5 font-mono text-[10px] text-warning">
          오늘 마감
        </span>
      )}
      <ProjectPicker
        itemId={item.id}
        projectId={item.project_id}
        onChanged={onProjectChange}
      />
      <button onClick={() => onToggle(item)}>
        {done ? (
          <CircleCheck className="h-[18px] w-[18px] text-success" />
        ) : (
          <Circle className="h-[18px] w-[18px] text-ink-300 hover:text-signal-400" />
        )}
      </button>
    </div>
  );
}

export default function CommandCenter() {
  const { active, userId, projects } = useProject();
  const projName = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p: Project) => (map[p.id] = p.name));
    return map;
  }, [projects]);

  const [todos, setTodos] = useState<Item[]>([]);
  const [doneToday, setDoneToday] = useState<Item[]>([]);
  const [week, setWeek] = useState<Record<string, Item[]>>({});
  const [reviews, setReviews] = useState<Record<string, Item[]>>({});
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr());
  const [overdue, setOverdue] = useState<Item[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [oldest, setOldest] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSaved, setReviewSaved] = useState(false);
  const [todayReviews, setTodayReviews] = useState<Item[]>([]);
  const [addingSlot, setAddingSlot] = useState(false);
  const [slotText, setSlotText] = useState("");
  const [loaded, setLoaded] = useState(false);

  const today = todayStr();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const anchor = new Date();
  anchor.setDate(anchor.getDate() + weekOffset * 7);
  const days = weekDatesFrom(anchor);
  const wStart = fmt(days[0]);
  const wEnd = fmt(days[6]);

  const loadToday = useCallback(async () => {
    const proj = <T,>(q: T): T =>
      active ? (q as { eq: (a: string, b: string) => T }).eq("project_id", active) : q;

    // 오늘 할 일 = focus_date 오늘 OR due_date 오늘 (미완료+완료 모두, review 제외)
    const { data: fdata } = await proj(
      supabase
        .from("items")
        .select("*")
        .eq("is_archived", false)
        .neq("type", "review")
        .or(`focus_date.eq.${today},due_date.eq.${today}`)
        .order("focus_rank", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
    );
    const all = (fdata as Item[]) ?? [];
    setTodos(all.filter((it) => it.status !== "done"));
    setDoneToday(all.filter((it) => it.status === "done"));

    const { data: tr } = await proj(
      supabase
        .from("items")
        .select("*")
        .eq("type", "review")
        .eq("due_date", today)
        .eq("is_archived", false)
        .order("created_at", { ascending: true }),
    );
    setTodayReviews((tr as Item[]) ?? []);

    // 어제 이전에 '오늘 할 일'로 올렸는데 아직 못 끝낸 것
    const { data: od } = await proj(
      supabase
        .from("items")
        .select("*")
        .eq("is_archived", false)
        .neq("type", "review")
        .neq("status", "done")
        .not("focus_date", "is", null)
        .lt("focus_date", today)
        .order("focus_date", { ascending: true }),
    );
    setOverdue((od as Item[]) ?? []);

    const { data: inbox } = await proj(
      supabase
        .from("items")
        .select("id,title,created_at")
        .eq("status", "inbox")
        .eq("is_archived", false)
        .eq("type", "task")
        .order("created_at", { ascending: true }),
    );
    const inb = (inbox as { title: string; created_at: string }[]) ?? [];
    setInboxCount(inb.length);
    setOldest(inb.length ? inb[0].title : null);

    const { data: logs } = await supabase
      .from("daily_logs")
      .select("log_date,cleared")
      .order("log_date", { ascending: false })
      .limit(120);
    const cleared = new Set(
      ((logs as { log_date: string; cleared: boolean }[]) ?? [])
        .filter((l) => l.cleared)
        .map((l) => l.log_date),
    );
    let s = 0;
    const cur = new Date();
    if (!cleared.has(fmt(cur))) cur.setDate(cur.getDate() - 1);
    while (cleared.has(fmt(cur))) {
      s++;
      cur.setDate(cur.getDate() - 1);
    }
    setStreak(s);
    setLoaded(true);
  }, [active, today]);

  const loadWeek = useCallback(async () => {
    const proj = <T,>(q: T): T =>
      active ? (q as { eq: (a: string, b: string) => T }).eq("project_id", active) : q;

    const { data: wk } = await proj(
      supabase
        .from("items")
        .select("id,title,type,project_id,due_date,focus_date,status")
        .eq("is_archived", false)
        .neq("type", "review")
        .or(
          `and(due_date.gte.${wStart},due_date.lte.${wEnd}),and(focus_date.gte.${wStart},focus_date.lte.${wEnd})`,
        ),
    );
    const byDay: Record<string, Item[]> = {};
    ((wk as Item[]) ?? []).forEach((r) => {
      [r.due_date, r.focus_date].forEach((dd) => {
        if (dd && dd >= wStart && dd <= wEnd) (byDay[dd] ??= []).push(r);
      });
    });
    setWeek(byDay);

    const { data: revs } = await proj(
      supabase
        .from("items")
        .select("id,title,project_id,due_date,created_at")
        .eq("type", "review")
        .eq("is_archived", false)
        .gte("due_date", wStart)
        .lte("due_date", wEnd)
        .order("created_at", { ascending: true }),
    );
    const revByDay: Record<string, Item[]> = {};
    ((revs as Item[]) ?? []).forEach((r) => {
      if (r.due_date) (revByDay[r.due_date] ??= []).push(r);
    });
    setReviews(revByDay);
  }, [active, wStart, wEnd]);

  // ⌘K 검색 등에서 /?date=YYYY-MM-DD 로 진입하면 그 주 + 그날을 선택
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("date");
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    const monday = (dt: Date) => {
      const day = (dt.getDay() + 6) % 7;
      const m = new Date(dt);
      m.setDate(dt.getDate() - day);
      m.setHours(0, 0, 0, 0);
      return m;
    };
    const target = new Date(`${d}T00:00:00`);
    const diff = Math.round(
      (monday(target).getTime() - monday(new Date()).getTime()) / (7 * 864e5),
    );
    setWeekOffset(diff);
    setSelectedDay(d);
  }, []);

  useEffect(() => {
    loadToday();
  }, [loadToday]);
  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  async function toggleDone(it: Item) {
    const next = it.status === "done" ? "active" : "done";
    await supabase.from("items").update({ status: next }).eq("id", it.id);
    // 남는 미완료가 0이면 미션 클리어
    const remaining =
      todos.filter((x) => x.id !== it.id).length + (next === "done" ? 0 : 1);
    const hadAny = todos.length + doneToday.length > 0;
    if (next === "done" && remaining === 0 && hadAny && userId) {
      await supabase
        .from("daily_logs")
        .upsert(
          { user_id: userId, log_date: today, cleared: true },
          { onConflict: "user_id,log_date" },
        );
    }
    loadToday();
    loadWeek();
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const oldIdx = todos.findIndex((t) => t.id === a.id);
    const newIdx = todos.findIndex((t) => t.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(todos, oldIdx, newIdx);
    setTodos(reordered); // 낙관적
    // focus_date=today + focus_rank 순번 저장
    await Promise.all(
      reordered.map((t, i) =>
        supabase
          .from("items")
          .update({ focus_rank: i + 1, focus_date: t.focus_date ?? today })
          .eq("id", t.id),
      ),
    );
  }

  async function carryOne(it: Item) {
    setOverdue((prev) => prev.filter((x) => x.id !== it.id)); // 낙관적
    await supabase
      .from("items")
      .update({ focus_date: today, focus_rank: todos.length + 1, status: "active" })
      .eq("id", it.id);
    loadToday();
    loadWeek();
  }

  async function carryAll() {
    if (overdue.length === 0) return;
    const ids = overdue.map((x) => x.id);
    setOverdue([]); // 낙관적
    await Promise.all(
      ids.map((id, i) =>
        supabase
          .from("items")
          .update({ focus_date: today, focus_rank: todos.length + 1 + i, status: "active" })
          .eq("id", id),
      ),
    );
    loadToday();
    loadWeek();
  }

  async function addTodo() {
    const title = slotText.trim();
    if (!title || !userId) {
      setAddingSlot(false);
      setSlotText("");
      return;
    }
    await supabase.from("items").insert({
      user_id: userId,
      type: "task",
      title,
      status: "active",
      focus_date: today,
      focus_rank: todos.length + 1,
      project_id: active,
    });
    setAddingSlot(false);
    setSlotText("");
    loadToday();
    loadWeek();
  }

  async function addReview() {
    const content = reviewText.trim();
    if (!content || !userId) return;
    const { data } = await supabase
      .from("items")
      .insert({
        user_id: userId,
        type: "review",
        title: content,
        status: "done",
        due_date: today,
        project_id: active,
      })
      .select("*")
      .single();
    setReviewText("");
    setReviewSaved(true);
    setTimeout(() => setReviewSaved(false), 1400);
    if (data) {
      const row = data as Item;
      setTodayReviews((prev) => [...prev, row]);
      setReviews((prev) => ({
        ...prev,
        [today]: [...(prev[today] ?? []), row],
      }));
    }
    loadWeek();
  }

  if (!loaded) return <SystemLine>불러오는 중…</SystemLine>;

  const dueTodaySet = new Set(
    [...todos, ...doneToday].filter((it) => it.due_date === today).map((it) => it.id),
  );
  const missionClear = todos.length === 0 && doneToday.length > 0;

  const hour = new Date().getHours();
  const greet =
    hour < 5 ? "늦은 밤이에요"
    : hour < 12 ? "좋은 아침"
    : hour < 18 ? "좋은 오후"
    : "좋은 저녁";

  const selectedItems = selectedDay ? (week[selectedDay] ?? []) : [];
  const selectedReviews = selectedDay ? (reviews[selectedDay] ?? []) : [];
  const weekLabel =
    weekOffset === 0 ? "이번 주"
    : weekOffset === -1 ? "지난주"
    : weekOffset === 1 ? "다음 주"
    : `${monthDay(wStart)} ~ ${monthDay(wEnd)}`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <SystemLine>
          {greet}. 오늘 할 일 {todos.length}개, inbox에 {inboxCount}개 대기 중.
        </SystemLine>
        {oldest && (
          <SystemLine>
            가장 오래 미룬 건 &ldquo;{oldest}&rdquo;. 위 3개가 오늘의 우선순위예요.
          </SystemLine>
        )}
        {missionClear && streak > 0 && (
          <p className="mt-1 font-mono text-[13px] text-signal-400">
            › 오늘 미션 클리어. {streak}일 연속.
          </p>
        )}
      </div>

      {overdue.length > 0 && (
        <div className="rounded-panel border-[0.5px] border-warning bg-ink-0 p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[11px] text-warning">
              어제 이전에 못 끝낸 {overdue.length}개
            </p>
            <button
              onClick={carryAll}
              className="rounded border-[0.5px] border-warning px-2 py-0.5 font-mono text-[11px] text-warning hover:bg-warning hover:text-white"
            >
              전부 오늘로
            </button>
          </div>
          <ul className="flex flex-col gap-1.5">
            {overdue.map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-2 rounded-card border-[0.5px] border-ink-200 bg-ink-50 px-3 py-2"
              >
                <span className="font-mono text-[10px] text-ink-400">
                  {monthDay(it.focus_date!)}
                </span>
                <span className="flex-1 truncate text-sm text-ink-700">
                  {it.title}
                </span>
                <button
                  onClick={() => carryOne(it)}
                  className="shrink-0 rounded border-[0.5px] border-ink-200 px-2 py-0.5 font-mono text-[11px] text-ink-500 hover:border-signal-400 hover:text-signal-600"
                >
                  오늘로
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-2 font-mono text-[11px] tracking-wide text-ink-400">
          TODAY · 위 3개가 TOP 3
        </p>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={todos.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {todos.map((it, i) => (
                <TodoRow
                  key={it.id}
                  item={it}
                  index={i}
                  isTop={i < 3}
                  isDueToday={dueTodaySet.has(it.id)}
                  onToggle={toggleDone}
                  onProjectChange={() => {
                    loadToday();
                    loadWeek();
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {addingSlot ? (
          <div className="mt-2 flex items-center gap-2 rounded-card border border-dashed border-signal-400 px-3 py-3">
            <span className="w-5 font-mono text-[13px] text-ink-400">
              {String(todos.length + 1).padStart(2, "0")}
            </span>
            <input
              autoFocus
              value={slotText}
              onChange={(e) => setSlotText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTodo();
                if (e.key === "Escape") {
                  setAddingSlot(false);
                  setSlotText("");
                }
              }}
              onBlur={addTodo}
              placeholder="오늘 할 일 입력 후 enter…"
              className="flex-1 border-none bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
            />
          </div>
        ) : (
          <button
            onClick={() => {
              setAddingSlot(true);
              setSlotText("");
            }}
            className="mt-2 w-full rounded-card border border-dashed border-ink-300 px-3 py-2.5 text-left text-[13px] text-ink-400 hover:border-signal-400 hover:text-signal-600"
          >
            + 오늘 할 일 추가하거나 ⌘K
          </button>
        )}

        {doneToday.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 font-mono text-[11px] text-ink-400">
              완료 {doneToday.length}
            </p>
            <div className="flex flex-col gap-1.5">
              {doneToday.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-2 rounded-card border-[0.5px] border-ink-200 bg-ink-0 px-3 py-2"
                >
                  <span className="flex-1 truncate text-sm text-ink-400 line-through">
                    {it.title}
                  </span>
                  <button onClick={() => toggleDone(it)}>
                    <CircleCheck className="h-[18px] w-[18px] text-success" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-mono text-[11px] tracking-wide text-ink-400">
            {weekLabel}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setWeekOffset((w) => w - 1);
                setSelectedDay(null);
              }}
              className="rounded p-0.5 text-ink-400 hover:text-signal-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => {
                  setWeekOffset(0);
                  setSelectedDay(today);
                }}
                className="rounded px-1.5 font-mono text-[11px] text-ink-400 hover:text-signal-600"
              >
                오늘
              </button>
            )}
            <button
              onClick={() => {
                setWeekOffset((w) => w + 1);
                setSelectedDay(null);
              }}
              className="rounded p-0.5 text-ink-400 hover:text-signal-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d, i) => {
            const key = fmt(d);
            const n = (week[key] ?? []).length;
            const hasReview = (reviews[key] ?? []).length > 0;
            const isToday = key === today;
            const isSelected = key === selectedDay;
            return (
              <button
                key={key}
                onClick={() =>
                  setSelectedDay(
                    key === today ? today : isSelected ? null : key,
                  )
                }
                className={
                  "rounded-md py-2 text-center transition " +
                  (isSelected
                    ? "bg-signal-50"
                    : isToday
                      ? "border border-signal-400"
                      : "bg-ink-100 hover:bg-ink-200/60")
                }
              >
                <p
                  className={
                    "font-mono text-[11px] " +
                    (isSelected ? "text-signal-800" : "text-ink-400")
                  }
                >
                  {WEEKDAY[i]}
                </p>
                <p
                  className={
                    "mb-1 font-mono text-[10px] " +
                    (isToday ? "text-signal-400" : "text-ink-400")
                  }
                >
                  {monthDay(key)}
                </p>
                <div className="flex min-h-[7px] items-center justify-center gap-[3px]">
                  {Array.from({ length: Math.min(n, 4) }).map((_, k) => (
                    <span
                      key={k}
                      className="h-[5px] w-[5px] rounded-full bg-signal-400"
                    />
                  ))}
                  {n > 4 && (
                    <span className="font-mono text-[9px] text-ink-400">+</span>
                  )}
                  {hasReview && (
                    <span className="h-[5px] w-[5px] rounded-full bg-ink-300" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {selectedDay && selectedDay !== today && (
          <div className="mt-2 flex flex-col gap-2">
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
                    className={
                      "flex items-center gap-2 rounded-card border-[0.5px] border-ink-200 bg-ink-0 px-3.5 py-2 text-sm " +
                      (it.status === "done"
                        ? "text-ink-400 line-through"
                        : "text-ink-700")
                    }
                  >
                    <span className="font-mono text-[10px] text-ink-400">
                      {it.type}
                    </span>
                    <span className="flex-1 truncate">{it.title}</span>
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

      <div className="rounded-panel border-[0.5px] border-ink-200 bg-ink-0 p-4">
        <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-400">
          EVENING · {monthDay(today)}
        </p>
        {todayReviews.length > 0 && (
          <ul className="mb-2 flex flex-col gap-1">
            {todayReviews.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-sm text-ink-700">
                <span className="mt-[2px] font-mono text-[11px] text-signal-400">
                  ›
                </span>
                <span className="flex-1">{r.title}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <input
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addReview()}
            placeholder="오늘 막힌 것 / 회고 한 줄… (여러 개 쌓임)"
            className="h-9 flex-1 rounded border-[0.5px] border-ink-200 bg-ink-50 px-3 text-sm text-ink-700 outline-none focus:border-signal-400"
          />
          <button
            onClick={addReview}
            className="h-9 shrink-0 rounded bg-signal-400 px-3 text-sm font-medium text-white transition active:scale-[0.98]"
          >
            추가
          </button>
        </div>
        {reviewSaved && (
          <p className="mt-1 font-mono text-[11px] text-signal-400">› 추가됨</p>
        )}
      </div>
    </div>
  );
}