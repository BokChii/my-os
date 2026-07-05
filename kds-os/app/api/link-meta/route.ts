import { NextResponse } from "next/server";

function decode(s: string | null) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return NextResponse.json({ error: "no url" }, { status: 400 });

  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KDSOSBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();

    const pick = (prop: string) => {
      const a = new RegExp(
        `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`,
        "i",
      );
      const b = new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`,
        "i",
      );
      return decode(html.match(a)?.[1] ?? html.match(b)?.[1] ?? null);
    };

    const titleTag = decode(
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null,
    );

    let image = pick("og:image") ?? pick("twitter:image");
    if (image && image.startsWith("/")) {
      try {
        image = new URL(image, url).href;
      } catch {}
    }

    return NextResponse.json({
      title: pick("og:title") ?? titleTag,
      description: pick("og:description") ?? pick("description"),
      image,
      site_name: pick("og:site_name") ?? host,
    });
  } catch {
    return NextResponse.json({
      title: null,
      description: null,
      image: null,
      site_name: host,
    });
  }
}