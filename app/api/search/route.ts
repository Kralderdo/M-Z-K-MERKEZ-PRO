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
const url = new URL("https://itunes.apple.com/search");
url.searchParams.set("term", term);
url.searchParams.set("entity", "song");
url.searchParams.set("media", "music");
url.searchParams.set("limit", "25");
url.searchParams.set("country", "tr");

const upstream = await fetch(url, {
  headers: { Accept: "application/json" },
  cache: "no-store",
  signal: AbortSignal.timeout(9000)
});

if (!upstream.ok) {
  return Response.json(
    { error: "Müzik kataloğu şu anda yanıt vermiyor." },
    { status: 502 }
  );
}

const data = await upstream.json();

const results = (data.results ?? [])
  .filter((item: any) => typeof item.previewUrl === "string")
  .map((item: any) => ({
    id: String(item.trackId),
    title: item.trackName,
    artist: item.artistName,
    album: item.collectionName ?? "",
    artwork: (item.artworkUrl100 ?? "").replace(
      "100x100",
      "300x300"
    ),
    audioUrl: item.previewUrl,
    storeUrl: item.trackViewUrl ?? "",
    durationMs: item.trackTimeMillis ?? 0,
    source: "iTunes önizlemesi"
  }));

return Response.json(
  { results },
  { headers: { "Cache-Control": "no-store" } }
);

} catch {
return Response.json(
{
error:
"Arama başarısız oldu. İnternet bağlantını kontrol edip yeniden dene."
},
{ status: 502 }
);
}
}
