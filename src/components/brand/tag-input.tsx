"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TagInputProps {
  name: string;
  defaultValue?: string[];
  placeholder?: string;
}

export function TagInput({ name, defaultValue = [], placeholder }: TagInputProps) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");

  function addTag() {
    const value = draft.trim();
    if (!value || tags.includes(value)) return;
    setTags([...tags, value]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(tags)} />
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag();
          }
        }}
        onBlur={addTag}
        placeholder={placeholder ?? "Digite e pressione Enter"}
      />
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
