"use client";

import { useEffect, useRef } from "react";

export function useHotkey(
  key: string,
  handler: (e: KeyboardEvent) => void,
  options: { ctrl?: boolean; alt?: boolean; shift?: boolean; ignoreInputs?: boolean } = {}
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      const code = e.key.toLowerCase();
      const matches =
        code === key.toLowerCase() &&
        !!e.ctrlKey === !!options.ctrl &&
        !!e.altKey === !!options.alt &&
        (options.shift ? !!e.shiftKey : true);

      if (!matches) return;
      if (options.ignoreInputs && inInput) return;
      e.preventDefault();
      handlerRef.current(e);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, options.ctrl, options.alt, options.ignoreInputs, options.shift]);
}