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

  const results: any[] = [];

  // iTunes kısa önizlemeleri
  try {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", term);
    url.searchParams.set("entity", "song");
    url.searchParams.set("limit", "15");
    url.searchParams.set("country", "tr");

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const data = await response.json();

      for (const track of data.results ?? []) {
        if (typeof track.previewUrl !== "string") continue;

        results.push({
          id: `itunes-${track.trackId}`,
          title: track.trackName,
          artist: track.artistName,
          album: track.collectionName ?? "",
          artwork: (track.artworkUrl100 ?? "").replace(
            "100x100",
            "300x300"
          ),
          audioUrl: track.previewUrl,
          storeUrl: track.trackViewUrl ?? "",
          durationMs: track.trackTimeMillis ?? 0,
          source: "iTunes · Kısa önizleme",
        });
      }
    }
  } catch {
    // Diğer kaynakla devam et.
  }

  // Jamendo tam parça akışları
  try {
    const clientId = process.env.JAMENDO_CLIENT_ID;

    if (clientId) {
      const url = new URL("https://api.jamendo.com/v3.0/tracks/");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "15");
      url.searchParams.set("search", term);
      url.searchParams.set("audioformat", "mp31");

      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const data = await response.json();

        for (const track of data.results ?? []) {
          if (
            typeof track.audio !== "string" ||
            !track.audio.startsWith("https://")
          ) {
            continue;
          }

          results.push({
            id: `jamendo-${track.id}`,
            title: track.name ?? "Bilinmeyen şarkı",
            artist: track.artist_name ?? "Bilinmeyen sanatçı",
            album: track.album_name ?? "",
            artwork: track.album_image ?? "",
            audioUrl: track.audio,
            storeUrl: track.shareurl ?? "",
            durationMs: Number(track.duration ?? 0) * 1000,
            source: "Jamendo · Tam parça",
          });
        }
      }
    }
  } catch {
    // iTunes sonuçları korunur.
  }

  return Response.json(
    { results },
    { headers: { "Cache-Control": "no-store" } }
  );
  }
