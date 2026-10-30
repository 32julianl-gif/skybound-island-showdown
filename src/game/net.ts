import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const playerId =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const EVENTS = ["state", "hit", "dead", "block", "chest", "start", "reset", "sync", "arrow", "chat"] as const;
export type NetEvent = (typeof EVENTS)[number];

let channel: RealtimeChannel | null = null;

export function send(event: NetEvent, payload: Record<string, unknown>) {
  if (!channel) return;
  channel.send({ type: "broadcast", event, payload });
}

/** One channel per room; returns teardown. */
export function connect(
  room: string,
  name: string,
  onEvent: (event: NetEvent, payload: any) => void,
  onRoster: (list: { id: string; name: string }[]) => void,
  onStatus: (ok: boolean) => void,
) {
  const ch = supabase.channel(`skywars:${room}`, {
    config: { broadcast: { self: false }, presence: { key: playerId } },
  });
  for (const ev of EVENTS) ch.on("broadcast", { event: ev }, ({ payload }) => onEvent(ev, payload));
  ch.on("presence", { event: "sync" }, () => {
    const list = Object.entries(ch.presenceState<{ name: string }>()).map(([id, metas]) => ({
      id,
      name: metas[0]?.name ?? "Player",
    }));
    onRoster(list);
  });
  ch.subscribe((status) => {
    console.log("[net] channel:", status);
    if (status === "SUBSCRIBED") {
      ch.track({ name });
      onStatus(true);
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatus(false);
  });
  channel = ch;
  return () => {
    channel = null;
    supabase.removeChannel(ch);
  };
}
