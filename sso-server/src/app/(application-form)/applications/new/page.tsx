import { randomUUID } from 'node:crypto';
import { ApplicationForm } from '@/components/application-form';
import { requireUser } from '@/server/auth';

export default async function NewApplicationPage({ searchParams }: { searchParams: Promise<{ protocol?: string | string[] }> }) {
  await requireUser();
  const protocol = (await searchParams).protocol === 'oidc' ? 'oidc' : 'oauth';
  return <ApplicationForm key={protocol} protocol={protocol} applicationId={randomUUID()} />;
}
