import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openChat, sendChat } from "@/game/engine";
import { CHAT_MAX_LENGTH } from "@/game/chat";
import { hud, useHud } from "@/game/store";

export function Chat() {
  const open = useHud((s) => s.chatOpen);
  const messages = useHud((s) => s.chat);
  const connected = useHud((s) => s.connected);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
    setError("");
  }, [open]);
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages, open]);

  return (
    <section aria-label="Room chat" className="fixed bottom-28 left-4 z-30 w-[min(22rem,calc(100vw-2rem))] font-pixel">
      {open ? (
        <div className="pixel-panel p-3">
          <div className="mb-2 flex items-center justify-between text-primary">
            <span>ROOM CHAT</span>
            <Button variant="ghost" size="icon" title="Close chat" aria-label="Close chat" onClick={() => hud.set({ chatOpen: false })}><X /></Button>
          </div>
          <div ref={list} role="log" aria-live="polite" className="mb-3 max-h-40 overflow-y-auto text-sm">
            {messages.map((m) => <div key={m.id} className="break-words"><span className="text-primary">{m.name}: </span>{m.text}</div>)}
          </div>
          <form className="flex gap-2" onSubmit={(e) => {
            e.preventDefault();
            if (sendChat(draft)) { setDraft(""); setError(""); }
            else setError(connected ? "Wait a moment before sending again." : "Chat is reconnecting…");
            input.current?.focus();
          }}>
            <input ref={input} aria-label="Chat message" className="pixel-input min-w-0" placeholder="Message…" value={draft} maxLength={CHAT_MAX_LENGTH} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") { e.preventDefault(); hud.set({ chatOpen: false }); }
            }} />
            <Button type="submit" size="icon" title="Send message" aria-label="Send message" disabled={!connected || !draft.trim()}><Send /></Button>
          </form>
          {error && <div role="status" className="mt-1 text-xs text-muted-foreground">{error}</div>}
        </div>
      ) : (
        <>
          <div className="mb-2 space-y-1 text-sm">
            {messages.slice(-3).map((m) => <div key={m.id} className="pixel-panel break-words px-2 py-1"><span className="text-primary">{m.name}: </span>{m.text}</div>)}
          </div>
          <Button variant="secondary" onClick={openChat} title="Open room chat" aria-label="Open room chat"><MessageSquare /> Chat</Button>
        </>
      )}
    </section>
  );
}