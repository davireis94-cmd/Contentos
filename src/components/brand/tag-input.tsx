"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TagInputProps {
  name: string;
  defaultValue?: string[];
  placeholder?: string;
  hint?: string;
}

export function TagInput({ name, defaultValue = [], placeholder, hint }: TagInputProps) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !tags.includes(s));
    if (parts.length === 0) return;
    setTags((prev) => [...prev, ...parts]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(tags)} />
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(draft);
          }
          if (e.key === "Backspace" && draft === "" && tags.length > 0) {
            setTags((prev) => prev.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
        onPaste={(e) => {
          // Auto-split pasted comma-separated text
          const text = e.clipboardData.getData("text");
          if (text.includes(",")) {
            e.preventDefault();
            commit(draft + text);
          }
        }}
        placeholder={placeholder ?? "Digite e pressione Enter"}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs"
            >
              {tag}
              <button
                type="button"
                onClick={() => setTags(tags.filter((t) => t !== tag))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
