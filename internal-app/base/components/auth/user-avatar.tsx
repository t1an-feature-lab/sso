"use client";

import { cn } from "@/lib/utils";

const AVATAR_PALETTES = [
  "bg-blue-500/15 text-blue-700 dark:bg-blue-400/20 dark:text-blue-200",
  "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200",
  "bg-violet-500/15 text-violet-700 dark:bg-violet-400/20 dark:text-violet-200",
  "bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-200",
  "bg-rose-500/15 text-rose-700 dark:bg-rose-400/20 dark:text-rose-200",
  "bg-cyan-500/15 text-cyan-700 dark:bg-cyan-400/20 dark:text-cyan-200",
];

function getAvatarTone(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i += 1) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

function getInitial(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return "?";
  const first = Array.from(trimmed)[0] ?? "?";
  return /[a-z]/i.test(first) ? first.toUpperCase() : first;
}

const SIZE_CLASSES = {
  sm: "size-6 text-xs",
  md: "size-7 text-xs",
  lg: "size-9 text-sm",
} as const;

export function UserAvatar({
  username,
  size = "md",
  className,
}: {
  username: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium",
        SIZE_CLASSES[size],
        getAvatarTone(username),
        className
      )}
    >
      {getInitial(username)}
    </span>
  );
}
