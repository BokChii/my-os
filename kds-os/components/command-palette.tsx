"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Inbox,
  Link2,
  FolderKanban,
  Plus,
  ArrowRight,
  Circle,
  FileText,
  MessageSquare,
  CalendarCheck,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/lib/supabase/client";
import type { Item, Project } from "@/types/db";

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

const PAGES = [
  { href: "/", label: "today", icon: Home, keywords: ["today", "홈", "오늘"] },
  { href: "/inbox", label: "inbox", icon: Inbox, keywords: ["inbox", "인박스"] },
  { href: "/links", label: "links", icon: Link2, keywords: ["links", "링크"] },
  {
    href: "/projects",
    label: "projects",
    icon: FolderKanban,
    keywords: ["projects", "프로젝트"],
  },
  {
    href: "/review",
    label: "review",
    icon: CalendarCheck,
    keywords: ["review", "리뷰", "회고", "주간"],
  },
];

export function CommandPalette({
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
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [projectId, setProjectId] = useState<string | null>(activeProject);
  const [due, setDue] = useState("");
  const [saved, setSaved] = useState(false);
  const [results, setResults] = useState<Item[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 팔레트 열 때 활성 프로젝트 반영, 닫을 때 입력 초기화
  useEffect(() => {
    if (open) setProjectId(activeProject);
    else {
      setRaw("");
      setDue("");
    }
  }, [open, activeProject]);

  // 2글자 이상 입력 시 300ms 디바운스로 제목 검색
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = raw.trim();
    if (query.length < 2 || /^https?:\/\//.test(query)) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("items")
        .select("id,type,title,url,project_id,focus_date,status")
        .eq("is_archived", false)
        .ilike("title", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(8);
      setResults((data as Item[]) ?? []);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [raw]);

  const q = raw.trim().toLowerCase();
  const preview = parse(raw);
  const hasInput = q.length > 0;

  const matchedPages = PAGES.filter(
    (p) => !hasInput || p.keywords.some((k) => k.includes(q)),
  );
  const matchedProjects = hasInput
    ? projects.filter((p) => p.name.toLowerCase().includes(q))
    : [];

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  function openResult(it: Item) {
    onOpenChange(false);
    if (it.type === "link" && it.url) {
      window.open(it.url, "_blank");
      return;
    }
    if (it.type === "task") {
      const d = it.focus_date ?? it.due_date;
      if (!d) {
        router.push("/inbox");
        return;
      }
      const off = new Date().getTimezoneOffset();
      const todayIso = new Date(Date.now() - off * 60000)
        .toISOString()
        .slice(0, 10);
      if (d === todayIso) {
        router.push("/");
      } else {
        // 같은 페이지(today)에 있을 때도 확실히 반영되도록 전체 이동
        window.location.assign(`/?date=${d}`);
      }
      return;
    }
    // note / review / event / template
    if (it.project_id) {
      router.push(`/projects/${it.project_id}`);
    } else {
      router.push(it.type === "review" ? "/" : "/inbox");
    }
  }

  const resultIcon = (t: Item["type"]) =>
    t === "link" ? Link2
    : t === "note" ? FileText
    : t === "review" ? MessageSquare
    : Circle;

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
      ...(p.type === "link" ? { metadata: { read_state: "unread" } } : {}),
    });
    setRaw("");
    setDue("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-panel border-[0.5px] border-ink-200 bg-ink-0 p-0">
        <DialogTitle className="sr-only">명령 팔레트</DialogTitle>
        <Command shouldFilter={false} className="bg-transparent">
          <CommandInput
            autoFocus
            value={raw}
            onValueChange={setRaw}
            placeholder="무엇이든… (할 일·URL 입력, 또는 이동할 곳)"
            className="text-[15px]"
          />
          <CommandList className="max-h-[320px]">
            <CommandEmpty className="py-5 text-center font-mono text-[12px] text-ink-400">
              결과 없음
            </CommandEmpty>

            {hasInput && (
              <CommandGroup
                heading={
                  <span className="font-mono text-[10px] tracking-wide text-ink-400">
                    저장
                  </span>
                }
              >
                <CommandItem
                  value={`__capture_${raw}`}
                  onSelect={save}
                  className="gap-2"
                >
                  {preview.type === "link" ? (
                    <Link2 className="h-4 w-4 text-signal-400" />
                  ) : (
                    <Plus className="h-4 w-4 text-signal-400" />
                  )}
                  <span className="flex-1 truncate text-sm text-ink-700">
                    {preview.title}
                  </span>
                  <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 font-mono text-[10px] text-ink-500">
                    {preview.type === "link" ? "링크로 저장" : "할 일로 저장"}
                  </span>
                </CommandItem>
              </CommandGroup>
            )}

            {results.length > 0 && (
              <CommandGroup
                heading={
                  <span className="font-mono text-[10px] tracking-wide text-ink-400">
                    검색 결과
                  </span>
                }
              >
                {results.map((it) => {
                  const I = resultIcon(it.type);
                  return (
                    <CommandItem
                      key={it.id}
                      value={`__result_${it.id}`}
                      onSelect={() => openResult(it)}
                      className="gap-2"
                    >
                      <I className="h-4 w-4 shrink-0 text-ink-400" />
                      <span
                        className={
                          "flex-1 truncate text-sm " +
                          (it.status === "done"
                            ? "text-ink-400 line-through"
                            : "text-ink-700")
                        }
                      >
                        {it.title}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-ink-400">
                        {it.type}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {matchedProjects.length > 0 && (
              <CommandGroup
                heading={
                  <span className="font-mono text-[10px] tracking-wide text-ink-400">
                    프로젝트 열기
                  </span>
                }
              >
                {matchedProjects.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`__proj_${p.id}`}
                    onSelect={() => go(`/projects/${p.id}`)}
                    className="gap-2"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: p.color ?? "#9C9A90" }}
                    />
                    <span className="flex-1 truncate text-sm text-ink-700">
                      {p.name}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-ink-300" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {matchedPages.length > 0 && (
              <CommandGroup
                heading={
                  <span className="font-mono text-[10px] tracking-wide text-ink-400">
                    이동
                  </span>
                }
              >
                {matchedPages.map((p) => {
                  const I = p.icon;
                  return (
                    <CommandItem
                      key={p.href}
                      value={`__page_${p.href}`}
                      onSelect={() => go(p.href)}
                      className="gap-2"
                    >
                      <I className="h-4 w-4 text-ink-400" />
                      <span className="flex-1 font-mono text-[13px] text-ink-700">
                        {p.label}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-ink-300" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>

          {/* 캡처 옵션 줄: 입력 중일 때만 */}
          {hasInput && (
            <div className="flex flex-wrap items-center gap-2 border-t-[0.5px] border-ink-200 px-3 py-2.5">
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
              {saved && (
                <span className="font-mono text-[11px] text-signal-400">
                  › 저장됨
                </span>
              )}
            </div>
          )}

          <p className="border-t-[0.5px] border-ink-200 px-3 py-2 font-mono text-[11px] text-ink-400">
            ↑↓ 이동 · enter 실행 · esc 닫기
            {hasInput ? " · 저장 후 계속 입력 가능" : ""}
          </p>
        </Command>
      </DialogContent>
    </Dialog>
  );
}