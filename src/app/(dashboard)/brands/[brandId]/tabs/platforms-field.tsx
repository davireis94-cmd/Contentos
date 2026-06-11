"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PLATFORM_LABELS, type Platform } from "@/types/app";

const PLATFORMS = Object.keys(PLATFORM_LABELS) as Platform[];

export function PlatformsField({ name }: { name: string }) {
  const [selected, setSelected] = useState<Platform[]>([]);

  function toggle(platform: Platform) {
    setSelected((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
      {PLATFORMS.map((platform) => (
        <button
          key={platform}
          type="button"
          onClick={() => toggle(platform)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            selected.includes(platform)
              ? "border-foreground bg-foreground text-background"
              : "text-muted-foreground hover:border-foreground/30 hover:text-foreground"
          )}
        >
          {PLATFORM_LABELS[platform]}
        </button>
      ))}
    </div>
  );
}
