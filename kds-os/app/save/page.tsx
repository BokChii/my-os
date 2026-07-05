"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { enrichLink } from "@/lib/enrich";

export default function Save() {
  const [msg, setMsg] = useState("저장 중…");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(location.search);
      const url = params.get("url");
      const title = params.get("title");
      if (!url) {
        setMsg("URL이 없어요");
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMsg("로그인이 필요해요. 앱에서 먼저 로그인하세요.");
        return;
      }
      const { data } = await supabase
        .from("items")
        .insert({
          user_id: user.id,
          type: "link",
          title: title || url,
          url,
          status: "inbox",
          metadata: { read_state: "unread" },
        })
        .select("id")
        .single();
      if (data) enrichLink(data.id, url, { read_state: "unread" });
      setMsg("저장됨 ✓");
      setTimeout(() => window.close(), 900);
    })();
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-ink-50 px-4">
      <p className="font-mono text-[13px] text-ink-500">
        <span className="text-signal-400">›</span> {msg}
      </p>
    </main>
  );
}