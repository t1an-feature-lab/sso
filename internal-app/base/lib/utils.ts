import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function reorderList<T extends { id: string }>(
  items: T[],
  sourceId: string,
  targetId: string,
  position: "before" | "after"
): T[] | null {
  if (sourceId === targetId) return null;
  const fromIndex = items.findIndex((item) => item.id === sourceId);
  const toIndex = items.findIndex((item) => item.id === targetId);
  if (fromIndex === -1 || toIndex === -1) return null;

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  const targetIndexAfterRemoval = next.findIndex(
    (item) => item.id === targetId
  );
  if (targetIndexAfterRemoval === -1) return null;

  const insertIndex =
    position === "before"
      ? targetIndexAfterRemoval
      : targetIndexAfterRemoval + 1;
  next.splice(insertIndex, 0, moved);

  const changed = next.some((item, idx) => item.id !== items[idx]?.id);
  return changed ? next : null;
}
