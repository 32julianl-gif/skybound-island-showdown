import { expect, it } from "vitest";
import { cleanChatText } from "./chat";

it("accepts nonempty bounded room messages and rejects invalid input", () => {
  expect(cleanChatText("  hello\nteam  ")).toBe("hello team");
  expect(cleanChatText("x".repeat(200))).toHaveLength(160);
  expect(cleanChatText(" \n\t")).toBe("");
  expect(cleanChatText({ text: "bad" })).toBe("");
});