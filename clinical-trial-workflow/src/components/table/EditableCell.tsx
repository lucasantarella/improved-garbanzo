"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface EditableCellProps {
  value: string | number;
  onChange: (value: string | number) => void;
  type?: "text" | "number";
}

export default function EditableCell({
  value,
  onChange,
  type = "text",
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commit = useCallback(() => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed === String(value)) return;
    if (type === "number") {
      const num = Number(trimmed);
      if (!Number.isNaN(num)) {
        onChange(num);
      }
    } else {
      onChange(trimmed);
    }
  }, [draft, value, type, onChange]);

  const cancel = useCallback(() => {
    setDraft(String(value));
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [commit, cancel],
  );

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={[
          "w-full rounded border border-jazz-purple/40 bg-white px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-jazz-purple/40",
          type === "number" ? "tabular-nums text-right" : "",
        ].join(" ")}
      />
    );
  }

  if (type === "number") {
    return (
      <span
        className="tabular-nums block w-full cursor-text truncate rounded px-1.5 py-0.5 text-xs text-gray-700 text-right hover:bg-gray-100/60"
        onDoubleClick={() => setIsEditing(true)}
        title={String(value)}
      >
        {value}
      </span>
    );
  }

  return (
    <span
      className="block w-full cursor-text truncate rounded px-1 py-0.5 text-xs text-gray-800 hover:bg-gray-100/60"
      onDoubleClick={() => setIsEditing(true)}
      title={String(value)}
    >
      {value}
    </span>
  );
}
