"use client";

import React from "react";
import { X } from "lucide-react";

interface BadgeProps {
  label: string;
  color: string;
  onRemove?: () => void;
}

export default function Badge({ label, color, onRemove }: BadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 inline-flex items-center rounded-full p-0.5 hover:opacity-70 transition-opacity"
          style={{ color }}
          aria-label={`Remove ${label}`}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
