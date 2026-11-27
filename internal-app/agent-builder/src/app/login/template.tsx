"use client";

import type { ReactNode } from "react";

export default function LoginTemplate({ children }: { children: ReactNode }) {
  return <div className="page-transition-shell">{children}</div>;
}
