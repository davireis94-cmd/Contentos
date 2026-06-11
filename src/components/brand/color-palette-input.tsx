"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

interface ColorPaletteInputProps {
  name: string;
  defaultValue?: string[];
}

export function ColorPaletteInput({
  name,
  defaultValue = [],
}: ColorPaletteInputProps) {
  const [colors, setColors] = useState<string[]>(defaultValue);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="hidden" name={name} value={JSON.stringify(colors)} />
      {colors.map((color, i) => (
        <div key={i} className="group relative">
          <input
            type="color"
            value={color}
            onChange={(e) =>
              setColors(colors.map((c, j) => (j === i ? e.target.value : c)))
            }
            className="size-9 cursor-pointer rounded-md border bg-transparent p-0.5"
          />
          <button
            type="button"
            onClick={() => setColors(colors.filter((_, j) => j !== i))}
            className="absolute -right-1.5 -top-1.5 hidden size-4 items-center justify-center rounded-full bg-foreground text-background group-hover:flex"
          >
            <X className="size-2.5" />
          </button>
        </div>
      ))}
      {colors.length < 6 && (
        <button
          type="button"
          onClick={() => setColors([...colors, "#7c3aed"])}
          className="flex size-9 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:border-foreground/30 hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
}
