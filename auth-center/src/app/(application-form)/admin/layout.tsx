import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Auth Center Admin',
};

export default function AdminApplicationLayout({ children }: { children: ReactNode }) {
  return children;
}
