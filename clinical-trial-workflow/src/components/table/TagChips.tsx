"use client";

import React from "react";
import type { Tag } from "@/types";

interface TagChipsProps {
  tagIds: string[];
  allTags: Tag[];
}

export default function TagChips({ tagIds, allTags }: TagChipsProps) {
  if (tagIds.length === 0) {
    return <span className="text-xs text-gray-400">None</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tagIds.map((tagId) => {
        const tag = allTags.find((t) => t.id === tagId);
        if (!tag) return null;
        return (
          <span
            key={tag.id}
            className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium leading-none text-white"
            style={{ backgroundColor: tag.color }}
            title={tag.name}
          >
            {tag.name}
          </span>
        );
      })}
    </div>
  );
}
