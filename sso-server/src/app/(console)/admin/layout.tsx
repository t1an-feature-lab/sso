import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ConsoleShell } from '@/components/app-shell';
import { requireAdmin } from '@/server/auth';

export const metadata: Metadata = {
  title: 'Auth Center Admin',
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  return <ConsoleShell user={user} admin>{children}</ConsoleShell>;
}
