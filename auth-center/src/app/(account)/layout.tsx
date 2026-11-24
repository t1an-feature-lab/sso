import type { ReactNode } from 'react';
import { ConsoleShell } from '@/components/app-shell';
import { requireUser } from '@/server/auth';

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return <ConsoleShell user={user}>{children}</ConsoleShell>;
}
