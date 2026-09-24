"use client";

import { useEffect, useState } from "react";
import { getSettings } from "@/db/settings";
import type { AppSettings } from "@/types";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = async () => {
    const s = await getSettings();
    setSettings(s);
    setReady(true);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { settings, ready, refresh, setSettings };
}