import { redirect } from 'next/navigation';
import { requireAdmin } from '@/server/auth';

export default async function NewApplicationPage({ searchParams }: { searchParams: Promise<{ protocol?: string | string[] }> }) {
  await requireAdmin();
  const protocol = (await searchParams).protocol === 'oidc' ? 'oidc' : 'oauth';
  redirect(`/admin/applications?protocol=${protocol}`);
}
