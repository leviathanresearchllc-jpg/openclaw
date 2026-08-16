/* @vitest-environment jsdom */

import { render } from "lit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n, t } from "../../i18n/index.ts";
import { renderChatComposer, resetChatComposerState } from "./components/chat-composer.ts";

type ComposerProps = Parameters<typeof renderChatComposer>[0];

function composerProps(overrides: Partial<ComposerProps> = {}): ComposerProps {
  return {
    paneId: crypto.randomUUID(),
    sessionKey: "main",
    currentAgentId: "main",
    connected: true,
    canSend: true,
    disabledReason: null,
    sending: false,
    messages: [],
    stream: null,
    queue: [],
    draft: "",
    sessions: null,
    assistantName: "OpenClaw",
    onDraftChange: vi.fn(),
    onSend: vi.fn(),
    onQueueRemove: vi.fn(),
    onNewSession: vi.fn(),
    ...overrides,
  };
}

function renderComposer(overrides: Partial<ComposerProps> = {}) {
  const container = document.createElement("div");
  render(renderChatComposer(composerProps(overrides)), container);
  return container;
}

function button(container: Element, label: string): HTMLButtonElement {
  const result = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!result) {
    throw new Error(`expected button ${label}`);
  }
  return result;
}

function pressComposerEnter(
  container: Element,
  modifiers: Pick<KeyboardEventInit, "altKey" | "ctrlKey" | "metaKey">,
) {
  const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
  if (!textarea) {
    throw new Error("expected composer textarea");
  }
  textarea.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      ...modifiers,
    }),
  );
}

beforeEach(async () => {
  await i18n.setLocale("en");
});

afterEach(() => {
  resetChatComposerState();
  localStorage.clear();
  document.body.replaceChildren();
});

describe("chat composer send shortcuts", () => {
  it.each([
    ["Meta", { metaKey: true }],
    ["Control", { ctrlKey: true }],
  ] as const)("uses %s+Enter to steer an active queued follow-up", (_name, modifiers) => {
    const onSend = vi.fn();
    const container = renderComposer({
      canAbort: true,
      draft: "Steer this now",
      followUpMode: "queue",
      onAbort: vi.fn(),
      onSend,
      sendShortcut: "enter",
    });

    pressComposerEnter(container, modifiers);

    expect(onSend).toHaveBeenCalledOnce();
    expect(onSend).toHaveBeenCalledWith({ followUpMode: "steer" });
  });

  it.each([
    ["modifier-enter", true, "queue", "Keep this queued", false],
    ["enter", false, "queue", "No active run", false],
    ["enter", true, "steer", "Already steering", false],
    ["enter", true, "queue", "", false],
    ["enter", true, "queue", "Alt keeps this a plain send", true],
  ] as const)(
    "does not override follow-up mode for shortcut=%s active=%s mode=%s draft=%j alt=%s",
    (sendShortcut, active, followUpMode, draft, altKey) => {
      const onSend = vi.fn();
      const container = renderComposer({
        canAbort: active,
        draft,
        followUpMode,
        onAbort: active ? vi.fn() : undefined,
        onSend,
        sendShortcut,
      });

      pressComposerEnter(container, { altKey, ctrlKey: true });

      expect(onSend.mock.calls).toEqual([[]]);
    },
  );

  it("teaches the steer shortcut only for Enter-mode queued active runs", () => {
    const enterMode = renderComposer({
      canAbort: true,
      draft: "Follow up now",
      followUpMode: "queue",
      onAbort: vi.fn(),
      sendShortcut: "enter",
    });
    const enterTooltip = button(enterMode, t("chat.runControls.queueMessage")).closest(
      "openclaw-tooltip",
    ) as (HTMLElement & { content?: string }) | null;
    expect(enterTooltip?.content).toBe("Queue ⏎ · Steer ⌘/Ctrl+Enter");

    const modifierMode = renderComposer({
      canAbort: true,
      draft: "Follow up later",
      followUpMode: "queue",
      onAbort: vi.fn(),
      sendShortcut: "modifier-enter",
    });
    const modifierTooltip = button(modifierMode, t("chat.runControls.queueMessage")).closest(
      "openclaw-tooltip",
    ) as (HTMLElement & { content?: string }) | null;
    expect(modifierTooltip?.content).toBe(t("chat.runControls.queue"));
  });
});
