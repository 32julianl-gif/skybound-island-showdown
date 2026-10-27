import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SkyWarsGame } from "@/components/skywars/SkyWarsGame";
import heroImg from "@/assets/sky-islands.jpg";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sky Wars — Voxel Island Battles" },
      { name: "description", content: "Bridge, loot chests and knock your friends into the void in this online voxel Sky Wars game." },
      { property: "og:title", content: "Sky Wars — Voxel Island Battles" },
      { property: "og:description", content: "Online voxel Sky Wars: bridge, loot and knock friends off floating islands." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const r = url.searchParams.get("room");
    setRoom(r ? r.toUpperCase() : Math.random().toString(36).slice(2, 6).toUpperCase());
    setName(localStorage.getItem("skywars-name") ?? "");
  }, []);

  const play = () => {
    const n = name.trim().slice(0, 16) || `Player${Math.floor(Math.random() * 900 + 100)}`;
    const r = room.trim().toUpperCase().slice(0, 8) || "SKY";
    localStorage.setItem("skywars-name", n);
    const url = new URL(window.location.href);
    url.searchParams.set("room", r);
    window.history.replaceState(null, "", url);
    setName(n);
    setRoom(r);
    setJoined(true);
  };

  if (joined) return <SkyWarsGame room={room} name={name} />;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden font-pixel">
      <img src={heroImg} alt="" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover" />
      <div className="lobby-scrim absolute inset-0" />
      <div className="relative w-full max-w-md px-6">
        <h1 className="text-center text-7xl leading-none text-primary text-shadow-pixel md:text-8xl">SKY WARS</h1>
        <p className="mt-3 text-center text-lg text-foreground text-shadow-pixel">
          Bridge. Loot. Knock them into the void.
        </p>
        <form
          className="pixel-panel mt-8 space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            play();
          }}
        >
          <label className="block">
            <span className="text-sm text-muted-foreground">YOUR NAME</span>
            <input
              className="pixel-input mt-1"
              value={name}
              maxLength={16}
              placeholder="Steve"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">ROOM CODE</span>
            <input
              className="pixel-input mt-1 uppercase"
              value={room}
              maxLength={8}
              onChange={(e) => setRoom(e.target.value)}
            />
          </label>
          <button type="submit" className="pixel-btn pixel-btn-primary w-full text-xl">
            PLAY
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Share the same room code with friends — up to 8 players.
          </p>
        </form>
      </div>
    </main>
  );
}
