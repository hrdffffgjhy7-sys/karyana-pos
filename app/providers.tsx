"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { CommandPalette } from "@/components/command-palette";
import { useHotkey } from "@/hooks/use-hotkey";
import { useRouter } from "next/navigation";
import * as React from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  React.useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useHotkey("k", () => {
    document.dispatchEvent(new CustomEvent("open-command-palette"));
  }, { ctrl: true, ignoreInputs: false });

  useHotkey("n", () => {
    router.push("/bill/new");
  }, { ctrl: true, ignoreInputs: true });

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      {children}
      <CommandPalette />
      <Toaster />
    </ThemeProvider>
  );
}