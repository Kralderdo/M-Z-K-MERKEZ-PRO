"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  audioUrl: string;
  storeUrl?: string;
  durationMs?: number;
  source: string;
};

type SearchResponse = {
  results?: Track[];
  error?: string;
};

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  return `${Math.floor(seconds / 60)}:${String(
    Math.floor(seconds % 60)
  ).padStart(2, "0")}`;
};

const validAudioUrl = (value: string) => {
  try {
    const url = new URL(value);

    return ["https:", "http:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
};

export default function MusicApp() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const requestRef = useRef(0);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [current, setCurrent] = useState<Track | null>(null);
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const [tab, setTab] = useState<"search" | "favorites" | "queue">(
    "search"
  );
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    "Bir şarkı ara ve dinlemeye başla."
  );
  const [directUrl, setDirectUrl] = useState("");
  const [directTitle, setDirectTitle] = useState("");
  const [volume, setVolume] = useState(0.85);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);

  // Favorileri ve çalma sırasını sakla.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mmp-state-v1");

      if (saved) {
        const data = JSON.parse(saved);

        setFavorites(
          Array.isArray(data.favorites) ? data.favorites : []
        );
        setQueue(Array.isArray(data.queue) ? data.queue : []);
      }
    } catch {
      // Bozuk kayıt varsa uygulama açılmaya devam eder.
    }

    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    try {
      localStorage.setItem(
        "mmp-state-v1",
        JSON.stringify({ favorites, queue })
      );
    } catch {
      // Depolama kullanılamıyorsa oynatıcı çalışmaya devam eder.
    }
  }, [favorites, queue, ready]);

  // PWA çevrimdışı desteği.
  useEffect(() => {
    if (
      "serviceWorker" in navigator &&
      window.location.protocol === "https:"
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Şarkıyı oynat.
  const playTrack = useCallback(async (track: Track) => {
    const audio = audioRef.current;
    const url = validAudioUrl(track.audioUrl);

    if (!audio || !url) {
      setError("Geçerli bir ses bağlantısı bulunamadı.");
      return;
    }

    setError("");
    setTime(0);
    setDuration(0);
    setPlaying(false);
    setCurrent(track);

    audio.src = url;
    audio.load();

    try {
      await audio.play();
      setPlaying(true);
      setNotice(`${track.title} çalıyor · ${track.source}`);
    } catch {
      setPlaying(false);
      setNotice(
        "Oynatma başlamadı. Kaynak bağlantısını veya internetini kontrol et."
      );
    }
  }, []);

  // Oynat / duraklat.
  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!current) {
      const first = queue[0] ?? results[0] ?? favorites[0];

      if (first) {
        await playTrack(first);
      } else {
        setNotice("Önce şarkı ara veya ses bağlantısı ekle.");
      }

      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
        setError("");
      } catch {
        setError("Ses açılamadı. Başka bir bağlantı dene.");
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, [current, queue, results, favorites, playTrack]);

  // iTunes ve Jamendo sonuçlarını API'den al.
  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const term = query.trim();

    if (!term) {
      setError("Bir şarkı veya sanatçı adı yaz.");
      return;
    }

    const requestId = ++requestRef.current;

    setLoading(true);
    setError("");
    setTab("search");
    setNotice("Müzik katalogları aranıyor...");

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(term)}`
      );

      const data: SearchResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Arama başarısız oldu.");
      }

      if (requestId !== requestRef.current) return;

      const tracks = Array.isArray(data.results)
        ? data.results.filter(
            (track) =>
              track &&
              typeof track.id === "string" &&
              typeof track.title === "string" &&
              typeof track.artist === "string" &&
              typeof track.audioUrl === "string" &&
              validAudioUrl(track.audioUrl) !== ""
          )
        : [];

      setResults(tracks);

      const fullTracks = tracks.filter((track) =>
        track.source.toLowerCase().includes("jamendo")
      ).length;

      const previews = tracks.length - fullTracks;

      if (tracks.length) {
        setNotice(
          `${tracks.length} parça bulundu. ${fullTracks} Jamendo sonucu, ${previews} diğer sonuç. Süre ve erişim kaynağa göre değişebilir.`
        );
      } else {
        setNotice(
          "Sonuç bulunamadı. Başka bir şarkı veya sanatçı ara."
        );
      }
    } catch (err) {
      if (requestId !== requestRef.current) return;

      setError(
        err instanceof Error ? err.message : "Bağlantı hatası."
      );
      setResults([]);
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
      }
    }
  };

  // Doğrudan ses bağlantısı ekle.
  const addDirectAudio = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const url = validAudioUrl(directUrl.trim());

    if (!url) {
      setError("Geçerli bir HTTP veya HTTPS ses adresi gir.");
      return;
    }

    const track: Track = {
      id: `direct-${url}`,
      title: directTitle.trim() || "İnternetten ses",
      artist: "Doğrudan ses bağlantısı",
      audioUrl: url,
      source: "Doğrudan bağlantı",
    };

    setResults((old) => [
      track,
      ...old.filter((item) => item.id !== track.id),
    ]);

    setDirectUrl("");
    setDirectTitle("");
    setTab("search");

    await playTrack(track);
  };

  // Sonraki parça.
  const nextTrack = useCallback(async () => {
    const list = queue.length ? queue : results;

    if (!list.length) {
      setPlaying(false);
      return;
    }

    const index = current
      ? list.findIndex((item) => item.id === current.id)
      : -1;

    const nextIndex =
      index < 0 ? 0 : (index + 1) % list.length;

    await playTrack(list[nextIndex]);
  }, [queue, results, current, playTrack]);

  // Önceki parça.
  const previousTrack = useCallback(async () => {
    const list = queue.length ? queue : results;

    if (!list.length) return;

    const index = current
      ? list.findIndex((item) => item.id === current.id)
      : 0;

    const previousIndex =
      index < 0 ? 0 : (index - 1 + list.length) % list.length;

    await playTrack(list[previousIndex]);
  }, [queue, results, current, playTrack]);

  // Favoriye ekle / çıkar.
  const toggleFavorite = (track: Track) => {
    setFavorites((old) =>
      old.some((item) => item.id === track.id)
        ? old.filter((item) => item.id !== track.id)
        : [track, ...old]
    );
  };

  // Çalma sırasına ekle.
  const addToQueue = (track: Track) => {
    setQueue((old) =>
      old.some((item) => item.id === track.id)
        ? old
        : [...old, track]
    );

    setNotice("Çalma sırasına eklendi.");
  };

  // Ses seviyesini uygula.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Telefonun medya kontrolleri.
  useEffect(() => {
    if (
      !current ||
      !("mediaSession" in navigator) ||
      typeof MediaMetadata === "undefined"
    ) {
      return;
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: current.album || "MÜZİK MERKEZİ PRO",
        artwork: current.artwork
          ? [
              {
                src: current.artwork,
                sizes: "300x300",
                type: "image/jpeg",
              },
            ]
          : [],
      });

      navigator.mediaSession.playbackState = playing
        ? "playing"
        : "paused";

      navigator.mediaSession.setActionHandler("play", () => {
        void togglePlay();
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        audioRef.current?.pause();
        setPlaying(false);
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => {
        void nextTrack();
      });

      navigator.mediaSession.setActionHandler("previoustrack", () => {
        void previousTrack();
      });
    } catch {
      // Desteklenmeyen medya kontrolleri uygulamayı bozmaz.
    }
  }, [current, playing, togglePlay, nextTrack, previousTrack]);

  const visibleTracks =
    tab === "favorites"
      ? favorites
      : tab === "queue"
        ? queue
        : results;

  return (
    <main className="app-shell">
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={(event) => {
          setTime(event.currentTarget.currentTime);
        }}
        onLoadedMetadata={(event) => {
          const audioDuration = event.currentTarget.duration;

          setDuration(
            Number.isFinite(audioDuration) ? audioDuration : 0
          );
        }}
        onDurationChange={(event) => {
          const audioDuration = event.currentTarget.duration;

          if (Number.isFinite(audioDuration)) {
            setDuration(audioDuration);
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          void nextTrack();
        }}
        onError={() => {
          if (current) {
            setPlaying(false);
            setError(
              "Ses yüklenemedi. Bağlantı geçersiz olabilir veya kaynak oynatmaya izin vermiyor olabilir."
            );
          }
        }}
      />

      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">♫</span>
          <span>
            MÜZİK <b>MERKEZİ PRO</b>
          </span>
        </a>

        <span className="live-pill">
          <i /> GERÇEK OYNATICI
        </span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">KENDİ RİTMİNİ BUL</p>

          <h1>
            Müziğin
            <br />
            <span>hep yanında.</span>
          </h1>

          <p className="subtext">
            Müzik ara, kaynakları karşılaştır ve çalma sıranı oluştur.
          </p>

          <form className="searchbar" onSubmit={search}>
            <span aria-hidden="true">⌕</span>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Şarkı veya sanatçı ara..."
              aria-label="Şarkı ara"
            />

            <button type="submit" disabled={loading}>
              {loading ? "Aranıyor…" : "Ara"}
            </button>
          </form>

          <div className="source-note">
            iTunes önizlemeleri · Jamendo parçaları · Ses bağlantıları
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />

          <div className="disc">
            <div className="disc-center">♫</div>
          </div>

          <div className="sound-bars">
            {Array.from({ length: 9 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="direct-panel">
        <div>
          <p className="eyebrow">KENDİ KAYNAĞIN</p>
          <h2>Ses bağlantısı ekle</h2>
          <p>
            İzinli, doğrudan MP3 veya erişilebilir ses akışı bağlantısı gir.
            YouTube ve Spotify sayfa bağlantıları doğrudan ses adresi değildir.
          </p>
        </div>

        <form className="direct-form" onSubmit={addDirectAudio}>
          <input
            value={directTitle}
            onChange={(event) => setDirectTitle(event.target.value)}
            placeholder="Şarkı adı (isteğe bağlı)"
            aria-label="Şarkı adı"
          />

          <input
            type="url"
            required
            value={directUrl}
            onChange={(event) => setDirectUrl(event.target.value)}
            placeholder="https://site.com/sarki.mp3"
            aria-label="Ses bağlantısı"
          />

          <button type="submit">Ekle ve çal ↗</button>
        </form>
      </section>

      <section className="library">
        <div className="section-heading">
          <div>
            <p className="eyebrow">KÜTÜPHANEN</p>
            <h2>
              {tab === "favorites"
                ? "Favorilerin"
                : tab === "queue"
                  ? "Çalma sıran"
                  : "Müzik keşfet"}
            </h2>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={tab === "search" ? "active" : ""}
              onClick={() => setTab("search")}
            >
              Keşfet
            </button>

            <button
              type="button"
              className={tab === "favorites" ? "active" : ""}
              onClick={() => setTab("favorites")}
            >
              ♥ Favoriler ({favorites.length})
            </button>

            <button
              type="button"
              className={tab === "queue" ? "active" : ""}
              onClick={() => setTab("queue")}
            >
              ☷ Sıra ({queue.length})
            </button>
          </div>
        </div>

        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}

        <p className="notice" role="status">
          {notice}
        </p>

        {visibleTracks.length ? (
          <div className="track-list">
            {visibleTracks.map((track) => (
              <article className="track-row" key={track.id}>
                <button
                  type="button"
                  className="cover-button"
                  onClick={() => void playTrack(track)}
                  aria-label={`${track.title} çal`}
                >
                  {track.artwork ? (
                    <img
                      className="cover"
                      src={track.artwork}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="cover cover-placeholder">♫</span>
                  )}

                  <span className="cover-play">▶</span>
                </button>

                <div className="track-info">
                  <strong>{track.title}</strong>
                  <span>{track.artist}</span>
                  <small>{track.source}</small>
                </div>

                <span className="track-duration">
                  {track.durationMs
                    ? formatTime(track.durationMs / 1000)
                    : "Süre yüklenince görünür"}
                </span>

                {track.storeUrl && (
                  <a
                    className="store-link"
                    href={track.storeUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Kaynağı aç ↗
                  </a>
                )}

                <button
                  type="button"
                  className={`icon-btn ${
                    favorites.some((item) => item.id === track.id)
                      ? "hearted"
                      : ""
                  }`}
                  onClick={() => toggleFavorite(track)}
                  aria-label="Favorilere ekle veya çıkar"
                >
                  ♥
                </button>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => addToQueue(track)}
                  aria-label="Sıraya ekle"
                >
                  ＋
                </button>

                {tab === "queue" && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() =>
                      setQueue((old) =>
                        old.filter((item) => item.id !== track.id)
                      )
                    }
                    aria-label="Sıradan çıkar"
                  >
                    ×
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">♫</div>
            <h3>
              {tab === "favorites"
                ? "Henüz favorin yok"
                : tab === "queue"
                  ? "Çalma sıran boş"
                  : loading
                    ? "Müzikler aranıyor..."
                    : "Aramaya hazır"}
            </h3>
            <p>
              Şarkı ara veya izinli bir ses bağlantısı ekle.
            </p>
          </div>
        )}

        <p className="legal-note">
          iTunes sonuçları kısa önizleme olabilir. Jamendo parçalarının
          süresi ve kullanım izni parçaya göre değişir. Tam şarkıları
          kullanmadan önce ilgili lisans koşullarını kontrol et.
        </p>
      </section>

      <footer className="footer">
        <span>♫ MÜZİK MERKEZİ PRO</span>
        <span>Dinle · Keşfet · Tekrar et</span>
      </footer>

      <div className="player-dock">
        <div className="now-playing">
          {current?.artwork ? (
            <img
              src={current.artwork}
              alt=""
              className="dock-cover"
            />
          ) : (
            <div className="dock-cover dock-placeholder">♫</div>
          )}

          <div className="now-text">
            <strong>{current?.title ?? "Henüz şarkı seçilmedi"}</strong>
            <span>{current?.artist ?? "Bir şarkı seçerek başla"}</span>
            {current && <small>{current.source}</small>}
          </div>

          {current && (
            <button
              type="button"
              className={`icon-btn ${
                favorites.some((item) => item.id === current.id)
                  ? "hearted"
                  : ""
              }`}
              onClick={() => toggleFavorite(current)}
              aria-label="Favori"
            >
              ♥
            </button>
          )}
        </div>

        <div className="player-controls">
          <div className="control-buttons">
            <button
              type="button"
              onClick={() => void previousTrack()}
              aria-label="Önceki şarkı"
            >
              |◀
            </button>

            <button
              type="button"
              className="main-play"
              onClick={() => void togglePlay()}
              aria-label={playing ? "Duraklat" : "Çal"}
            >
              {playing ? "Ⅱ" : "▶"}
            </button>

            <button
              type="button"
              onClick={() => void nextTrack()}
              aria-label="Sonraki şarkı"
            >
              ▶|
            </button>
          </div>

          <div className="timeline">
            <span>{formatTime(time)}</span>

            <input
              type="range"
              min="0"
              max={duration || 0}
              step="1"
              value={Math.min(time, duration || 0)}
              disabled={!duration}
              aria-label="Şarkı konumu"
              onChange={(event) => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Number(
                    event.target.value
                  );
                }
              }}
            />

            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="volume-control">
          <span>♫</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            aria-label="Ses seviyesi"
            onChange={(event) =>
              setVolume(Number(event.target.value))
            }
          />
        </div>
      </div>
    </main>
  );
  }
