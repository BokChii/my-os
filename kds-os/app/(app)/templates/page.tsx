"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Archive, Check, Copy } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useProject } from "@/components/app-shell";
import { SystemLine } from "@/components/system-line";
import type { Item } from "@/types/db";

const VAR_RE = /\{\{([^}]+)\}\}/g;
const extractVars = (body: string) => [
  ...new Set([...body.matchAll(VAR_RE)].map((m) => m[1].trim())),
];

export default function TemplatesPage() {
  const { userId } = useProject();
  const [templates, setTemplates] = useState<Item[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newBody, setNewBody] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");
  const [usingId, setUsingId] = useState<string | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("type", "template")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    setTemplates((data as Item[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addTemplate() {
    const name = newName.trim();
    const body = newBody.trim();
    if (!name || !body || !userId) return;
    await supabase.from("items").insert({
      user_id: userId,
      type: "template",
      title: name,
      content: body,
      status: "active",
      metadata: { variables: extractVars(body) },
    });
    setNewName("");
    setNewBody("");
    setAdding(false);
    load();
  }

  async function saveEdit(id: string) {
    const name = editName.trim();
    const body = editBody.trim();
    if (!name || !body) {
      setEditingId(null);
      return;
    }
    await supabase
      .from("items")
      .update({
        title: name,
        content: body,
        metadata: { variables: extractVars(body) },
      })
      .eq("id", id);
    setEditingId(null);
    load();
  }

  async function archive(id: string) {
    await supabase.from("items").update({ is_archived: true }).eq("id", id);
    load();
  }

  async function copyFilled(t: Item) {
    const body = t.content ?? "";
    const filled = body.replace(VAR_RE, (_, name) => {
      const key = name.trim();
      return varValues[key]?.trim() || `{{${key}}}`;
    });
    await navigator.clipboard.writeText(filled);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 1400);
  }

  function startUse(t: Item) {
    const vars = extractVars(t.content ?? "");
    if (vars.length === 0) {
      // 변수 없으면 바로 복사
      navigator.clipboard.writeText(t.content ?? "");
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(null), 1400);
      return;
    }
    setUsingId(usingId === t.id ? null : t.id);
    setVarValues({});
  }

  if (!templates) return <SystemLine>불러오는 중…</SystemLine>;

  return (
    <div className="flex flex-col gap-4">
      <SystemLine>
        템플릿 {templates.length}개. 본문에 {"{{변수}}"}를 쓰면 사용할 때
        채워요.
      </SystemLine>

      {/* 새 템플릿 */}
      {adding ? (
        <div className="flex flex-col gap-2 rounded-panel border-[0.5px] border-signal-400 bg-ink-0 p-4">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="템플릿 이름 (예: 행사 안내 메일)"
            className="h-9 rounded border-[0.5px] border-ink-200 bg-ink-0 px-3 text-sm text-ink-900 outline-none focus:border-signal-400"
          />
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder={`안녕하세요 {{이름}}님,\n\n{{행사명}} 안내드립니다…`}
            rows={6}
            className="rounded border-[0.5px] border-ink-200 bg-ink-0 px-3 py-2 text-sm text-ink-700 outline-none focus:border-signal-400"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={addTemplate}
              className="h-8 rounded bg-signal-400 px-4 text-sm font-medium text-white active:scale-[0.98]"
            >
              저장
            </button>
            <button
              onClick={() => setAdding(false)}
              className="font-mono text-[12px] text-ink-400 hover:text-ink-500"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center gap-1.5 rounded-card border border-dashed border-ink-300 px-3 py-2.5 text-left text-[13px] text-ink-400 hover:border-signal-400 hover:text-signal-600"
        >
          <Plus className="h-4 w-4" />새 템플릿
        </button>
      )}

      {/* 목록 */}
      {templates.length === 0 && !adding && (
        <p className="font-mono text-[12px] text-ink-400">
          아직 템플릿 없음. 반복해서 쓰는 메일·안내문을 저장해두세요.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {templates.map((t) => {
          const vars = extractVars(t.content ?? "");
          const isEditing = editingId === t.id;
          const isUsing = usingId === t.id;
          return (
            <div
              key={t.id}
              className="rounded-panel border-[0.5px] border-ink-200 bg-ink-0 p-4"
            >
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9 rounded border-[0.5px] border-ink-200 bg-ink-0 px-3 text-sm text-ink-900 outline-none focus:border-signal-400"
                  />
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={6}
                    className="rounded border-[0.5px] border-ink-200 bg-ink-0 px-3 py-2 text-sm text-ink-700 outline-none focus:border-signal-400"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => saveEdit(t.id)}
                      className="flex h-8 items-center gap-1 rounded bg-signal-400 px-3 text-sm font-medium text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                      저장
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="font-mono text-[12px] text-ink-400"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 truncate text-sm font-medium text-ink-900">
                      {t.title}
                    </p>
                    {vars.length > 0 && (
                      <span className="shrink-0 font-mono text-[10px] text-ink-400">
                        변수 {vars.length}
                      </span>
                    )}
                    <button
                      onClick={() => startUse(t)}
                      className="flex h-7 shrink-0 items-center gap-1 rounded border-[0.5px] border-signal-400 px-2.5 font-mono text-[11px] text-signal-600 hover:bg-signal-50"
                    >
                      <Copy className="h-3 w-3" />
                      {copiedId === t.id ? "복사됨" : "사용"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(t.id);
                        setEditName(t.title);
                        setEditBody(t.content ?? "");
                        setUsingId(null);
                      }}
                      className="shrink-0 text-ink-400 hover:text-signal-600"
                      title="수정"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => archive(t.id)}
                      className="shrink-0 text-ink-400 hover:text-warning"
                      title="보관"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-xs text-ink-500">
                    {t.content}
                  </p>

                  {/* 변수 채우기 */}
                  {isUsing && vars.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2 rounded-card border-[0.5px] border-ink-200 bg-ink-50 p-3">
                      {vars.map((v) => (
                        <label
                          key={v}
                          className="flex items-center gap-2 font-mono text-[11px] text-ink-500"
                        >
                          <span className="w-20 shrink-0 truncate">{v}</span>
                          <input
                            value={varValues[v] ?? ""}
                            onChange={(e) =>
                              setVarValues((prev) => ({
                                ...prev,
                                [v]: e.target.value,
                              }))
                            }
                            className="h-7 flex-1 rounded border-[0.5px] border-ink-200 bg-ink-0 px-2 text-xs text-ink-700 outline-none focus:border-signal-400"
                          />
                        </label>
                      ))}
                      <button
                        onClick={() => copyFilled(t)}
                        className="flex h-8 items-center justify-center gap-1 rounded bg-signal-400 px-3 text-sm font-medium text-white active:scale-[0.98]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copiedId === t.id ? "복사됨!" : "채워서 복사"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}