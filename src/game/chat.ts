export const CHAT_MAX_LENGTH = 160;
export const CHAT_HISTORY_LIMIT = 40;
export const CHAT_COOLDOWN_MS = 1000;
export type ChatMessage = { id: string; from: string; name: string; text: string };

export function cleanChatText(text: unknown): string {
  if (typeof text !== "string") return "";
  return text.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, CHAT_MAX_LENGTH);
}