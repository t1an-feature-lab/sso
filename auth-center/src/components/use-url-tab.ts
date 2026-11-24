"use client";

import { useSearchParams } from "next/navigation";

export function useUrlTab<T extends string>(parameter: string, values: readonly T[], defaultValue: T) {
  const searchParams = useSearchParams();
  const queryValue = searchParams.get(parameter);
  const selected = values.find((value) => value === queryValue) ?? defaultValue;

  function select(value: string) {
    if (value === selected || !values.some((option) => option === value)) return;
    const url = new URL(window.location.href);
    url.searchParams.set(parameter, value);
    window.history.pushState(null, "", url);
  }

  return [selected, select] as const;
}
