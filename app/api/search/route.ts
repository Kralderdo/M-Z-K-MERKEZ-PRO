import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const term = request.nextUrl.searchParams.get("q")?.trim();

  if (!term) {
    return Response.json({ results: [] });
  }

  if (term.length > 100) {
    return Response.json(
      { error: "Arama en fazla 100 karakter olabilir." },
      { status: 400 }
    );
  }

  try {
    const clientId = process.env.JAMENDO_CLIENT_ID;

    if (!clientId) {
      return Response.json(
        { error: "Jamendo API ayarı eksik." },
        { status: 500 }
      );
    }

    const url = new URL("https://api.jamendo.com/v3.0/tracks/");

    url.searchParams.set("client_id", clientId);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "25");
    url.searchParams.set("search", term);
    url.searchParams.set("audioformat", "mp31");
    url.searchParams.set("include", "licenses");

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return Response.json(
        { error: "Jamendo müzik kataloğu yanıt vermedi." },
        { status: 502 }
      );
    }

    const data = await response.json();

    const results = (Array.isArray(data.results) ? data.results : [])
      .filter(
        (track: any) =>
          typeof track.audio === "string" &&
          track.audio.startsWith("https://")
      )
      .map((track: any) => ({
        id: `jamendo-${track.id}`,
        title: track.name ?? "Bilinmeyen şarkı",
        artist: track.artist_name ?? "Bilinmeyen sanatçı",
        album: track.album_name ?? "",
        artwork: track.album_image ?? "",
        audioUrl: track.audio,
        storeUrl: track.shareurl ?? "",
        durationMs: Number(track.duration ?? 0) * 1000,
        source: "Jamendo",
      }));

    return Response.json(
      { results },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { error: "Müzik araması başarısız oldu. Tekrar dene." },
      { status: 502 }
    );
  }
        }
