"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Circle, CircleCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { SystemLine } from "@/components/system-line";
import type { Item, Project } from "@/types/db";

export default function ProjectDetail() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data: p } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();
    setProject((p as Project) ?? null);

    const { data: its } = await supabase
      .from("items")
      .select("*")
      .eq("project_id", id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    setItems((its as Item[]) ?? []);
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleDone(it: Item) {
    const next = it.status === "done" ? "active" : "done";
    await supabase.from("items").update({ status: next }).eq("id", it.id);
    load();
  }

  if (!loaded) return <SystemLine>불러오는 중…</SystemLine>;
  if (!project) return <SystemLine>프로젝트를 찾을 수 없어요.</SystemLine>;

  const tasks = items.filter((it) => it.type === "task");
  const activeTasks = tasks.filter((it) => it.status !== "done");
  const doneTasks = tasks.filter((it) => it.status === "done");
  const links = items.filter((it) => it.type === "link");
  const notes = items.filter((it) => it.type === "note");
  const reviews = items.filter((it) => it.type === "review");

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/projects"
        className="flex items-center gap-1 font-mono text-[11px] text-ink-400 hover:text-signal-600"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        projects
      </Link>

      <div className="flex items-center gap-2">
        <span
          className="h-4 w-4 rounded-full"
          style={{ background: project.color ?? "#9C9A90" }}
        />
        <h1 className="text-lg font-medium text-ink-900">{project.name}</h1>
        <span className="font-mono text-[11px] text-ink-400">
          {items.length}개 항목
        </span>
      </div>

      {/* 할 일 */}
      <section>
        <p className="mb-2 font-mono text-[11px] tracking-wide text-ink-400">
          TASKS / {activeTasks.length}
        </p>
        {activeTasks.length === 0 && doneTasks.length === 0 ? (
          <p className="font-mono text-[12px] text-ink-400">할 일 없음</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {activeTasks.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-3 rounded-card border-[0.5px] border-ink-200 bg-ink-0 px-3.5 py-2.5"
              >
                <span className="flex-1 truncate text-sm text-ink-700">
                  {it.title}
                </span>
                {it.due_date && (
                  <span className="font-mono text-[10px] text-ink-400">
                    ~{it.due_date.slice(5).replace("-", ".")}
                  </span>
                )}
                <button onClick={() => toggleDone(it)}>
                  <Circle className="h-[18px] w-[18px] text-ink-300 hover:text-signal-400" />
                </button>
              </div>
            ))}
            {doneTasks.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-3 rounded-card border-[0.5px] border-ink-200 bg-ink-0 px-3.5 py-2.5"
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
        )}
      </section>

      {/* 링크 */}
      <section>
        <p className="mb-2 font-mono text-[11px] tracking-wide text-ink-400">
          LINKS / {links.length}
        </p>
        {links.length === 0 ? (
          <p className="font-mono text-[12px] text-ink-400">링크 없음</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {links.map((it) => {
              const m = it.metadata ?? {};
              const domain =
                m.site_name ??
                (it.url
                  ? new URL(it.url).hostname.replace(/^www\./, "")
                  : "");
              return (
                <a
                  key={it.id}
                  href={it.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-card border-[0.5px] border-ink-200 bg-ink-0 px-3.5 py-2.5 hover:border-signal-400"
                >
                  <span className="flex-1 truncate text-sm text-ink-700">
                    {m.title ?? it.title}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-400">
                    {domain}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* 노트 */}
      {notes.length > 0 && (
        <section>
          <p className="mb-2 font-mono text-[11px] tracking-wide text-ink-400">
            NOTES / {notes.length}
          </p>
          <div className="flex flex-col gap-1.5">
            {notes.map((it) => (
              <div
                key={it.id}
                className="rounded-card border-[0.5px] border-ink-200 bg-ink-0 px-3.5 py-2.5"
              >
                <p className="text-sm text-ink-700">{it.title}</p>
                {it.content && (
                  <p className="mt-1 line-clamp-2 text-xs text-ink-500">
                    {it.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 회고 */}
      {reviews.length > 0 && (
        <section>
          <p className="mb-2 font-mono text-[11px] tracking-wide text-ink-400">
            REVIEWS / {reviews.length}
          </p>
          <div className="rounded-card border-[0.5px] border-ink-200 bg-ink-100 px-3.5 py-2.5">
            <ul className="flex flex-col gap-1.5">
              {reviews.map((it) => (
                <li
                  key={it.id}
                  className="flex items-start gap-2 text-sm text-ink-700"
                >
                  {it.due_date && (
                    <span className="mt-[2px] shrink-0 font-mono text-[10px] text-ink-400">
                      {it.due_date.slice(5).replace("-", ".")}
                    </span>
                  )}
                  <span className="flex-1">{it.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}