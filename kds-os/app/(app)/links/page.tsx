"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Star, Archive } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useProject } from "@/components/app-shell";
import { SystemLine } from "@/components/system-line";
import { enrichLink } from "@/lib/enrich";
import type { Item, ReadState } from "@/types/db";

const FILTERS: { key: "all" | ReadState; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "unread", label: "읽기 전" },
  { key: "reading", label: "읽는 중" },
  { key: "read", label: "읽음" },
];
const readLabel: Record<ReadState, string> = {
  unread: "읽기 전",
  reading: "읽는 중",
  read: "읽음",
};

export default function LinksPage() {
  const { active } = useProject();
  const [items, setItems] = useState<Item[] | null>(null);
  const [filter, setFilter] = useState<"all" | ReadState>("all");
  const tried = useRef<Set<string>>(new Set());

  const query = useCallback(async () => {
    let q = supabase
      .from("items")
      .select("*")
      .eq("type", "link")
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(60);
    if (active) q = q.eq("project_id", active);
    const { data } = await q;
    return (data as Item[]) ?? [];
  }, [active]);

  const load = useCallback(async () => {
    const list = await query();
    setItems(list);
    const missing = list.filter(
      (it) => !it.metadata?.title && it.url && !tried.current.has(it.id),
    );
    if (missing.length) {
      missing.forEach((it) => tried.current.add(it.id));
      await Promise.all(
        missing.map((it) => enrichLink(it.id, it.url!, it.metadata)),
      );
      setItems(await query());
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  async function setRead(it: Item, rs: ReadState) {
    await supabase
      .from("items")
      .update({ metadata: { ...it.metadata, read_state: rs } })
      .eq("id", it.id);
    load();
  }
  async function toggleFav(it: Item) {
    await supabase
      .from("items")
      .update({ is_favorite: !it.is_favorite })
      .eq("id", it.id);
    load();
  }
  async function archive(it: Item) {
    await supabase.from("items").update({ is_archived: true }).eq("id", it.id);
    load();
  }

  if (!items) return <SystemLine>불러오는 중…</SystemLine>;

  const shown = items.filter(
    (it) => filter === "all" || (it.metadata?.read_state ?? "unread") === filter,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SystemLine>
          {items.length === 0
            ? "아직 링크가 없어요. ⌘K로 첫 링크를 담아보세요."
            : `저장된 링크 ${items.length}개.`}
        </SystemLine>
        <div className="flex gap-1.5 font-mono text-[11px]">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={
                "rounded px-2 py-0.5 " +
                (filter === f.key
                  ? "bg-signal-50 text-signal-800"
                  : "text-ink-400 hover:text-ink-500")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ columnCount: 3, columnGap: "12px" }}>
        {shown.map((it) => {
          const m = it.metadata ?? {};
          const rs = (m.read_state ?? "unread") as ReadState;
          const domain =
            m.site_name ??
            (it.url ? new URL(it.url).hostname.replace(/^www\./, "") : "");
          return (
            <div
              key={it.id}
              className={
                "mb-3 break-inside-avoid overflow-hidden rounded-card border-[0.5px] border-ink-200 bg-ink-0 " +
                (rs === "read" ? "opacity-60" : "")
              }
            >
              {m.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.image}
                  alt=""
                  className="w-full object-cover"
                  style={{ maxHeight: 160 }}
                />
              ) : (
                <div className="flex h-16 items-center justify-center bg-ink-100 font-mono text-[11px] text-ink-400">
                  {domain}
                </div>
              )}
              <div className="p-3">
                <a
                  href={it.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="line-clamp-2 text-sm font-medium text-ink-900 hover:text-signal-600"
                >
                  {m.title ?? it.title}
                </a>
                {m.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-ink-500">
                    {m.description}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-ink-400">
                    {domain}
                  </span>
                  <div className="flex items-center gap-2 text-ink-400">
                    <button
                      onClick={() =>
                        setRead(it, rs === "read" ? "unread" : "read")
                      }
                      className="font-mono text-[11px] hover:text-signal-600"
                    >
                      {readLabel[rs]}
                    </button>
                    <button
                      onClick={() => toggleFav(it)}
                      className={
                        it.is_favorite
                          ? "text-signal-400"
                          : "hover:text-signal-600"
                      }
                      title="중요"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => archive(it)}
                      className="hover:text-danger"
                      title="보관"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}