"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-jazz-purple text-white hover:bg-jazz-purple-light active:bg-jazz-purple-dark focus-visible:ring-jazz-purple",
  secondary:
    "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 active:bg-gray-100 focus-visible:ring-gray-400",
  ghost:
    "bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200 focus-visible:ring-gray-400",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2 py-1 text-xs gap-1",
  md: "px-3 py-1.5 text-sm gap-1.5",
};

const iconSizes: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
};

export default function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "disabled:pointer-events-none disabled:opacity-40",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      {...rest}
    >
      {Icon && <Icon size={iconSizes[size]} aria-hidden="true" />}
      {children}
    </button>
  );
}
