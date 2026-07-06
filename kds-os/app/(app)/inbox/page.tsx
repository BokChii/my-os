"use client";
import { useCallback, useEffect, useState } from "react";
import { Circle, FileText, Link2, Calendar, Copy, CalendarPlus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useProject } from "@/components/app-shell";
import { SystemLine } from "@/components/system-line";
import type { Item, ItemType } from "@/types/db";

const icon: Record<ItemType, React.ElementType> = {
  task: Circle,
  note: FileText,
  link: Link2,
  event: Calendar,
  template: Copy,
};
const daysSince = (iso: string) =>
  Math.floor((Date.now() - +new Date(iso)) / 864e5);
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function InboxPage() {
  const { active } = useProject();
  const [items, setItems] = useState<Item[] | null>(null);

  const load = useCallback(async () => {
    let q = supabase
      .from("items")
      .select("*")
      .eq("status", "inbox")
      .eq("is_archived", false)
      .neq("type", "link")
      .order("created_at", { ascending: false });
    if (active) q = q.eq("project_id", active);
    const { data } = await q;
    setItems((data as Item[]) ?? []);
  }, [active]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(id: string, fields: Partial<Item>) {
    await supabase.from("items").update(fields).eq("id", id);
    load();
  }

  if (!items) return <SystemLine>불러오는 중…</SystemLine>;
  if (items.length === 0)
    return <SystemLine>inbox zero. 훌륭해요.</SystemLine>;

  const stale = items.filter((it) => daysSince(it.created_at) >= 7).length;

  return (
    <div className="flex flex-col gap-3">
      <SystemLine>
        정리되지 않은 항목 {items.length}개
        {stale > 0 ? `, ${stale}개는 7일 넘게 방치됨` : ""}.
      </SystemLine>
      <ul className="flex flex-col gap-1.5">
        {items.map((it) => {
          const I = icon[it.type];
          const old = daysSince(it.created_at) >= 7;
          return (
            <li
              key={it.id}
              className="flex items-center gap-3 rounded-card border-[0.5px] border-ink-200 bg-ink-0 px-3.5 py-2.5"
            >
              {old && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                  title="7일+ 방치"
                />
              )}
              <I className="h-4 w-4 shrink-0 text-ink-400" />
              <span className="flex-1 truncate text-sm text-ink-700">
                {it.title}
              </span>
              <div className="flex shrink-0 items-center gap-1.5 font-mono text-[11px]">
                <button
                  onClick={() =>
                    patch(it.id, { status: "active", focus_date: todayStr() })
                  }
                  className="rounded border-[0.5px] border-ink-200 px-2 py-0.5 text-ink-500 hover:border-signal-400 hover:text-signal-600"
                >
                  오늘
                </button>
                <label
                  className="relative flex h-6 w-7 cursor-pointer items-center justify-center overflow-hidden rounded border-[0.5px] border-ink-200 text-ink-400 hover:border-signal-400 hover:text-signal-600"
                  title="날짜 지정"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <input
                    type="date"
                    onChange={(e) =>
                      e.target.value &&
                      patch(it.id, {
                        due_date: e.target.value,
                        status: "active",
                      })
                    }
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
                <button
                  onClick={() => patch(it.id, { is_archived: true })}
                  className="rounded border-[0.5px] border-ink-200 px-2 py-0.5 text-ink-400 hover:border-danger hover:text-danger"
                >
                  버림
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}