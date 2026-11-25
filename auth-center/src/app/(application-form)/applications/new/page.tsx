import { randomUUID } from 'node:crypto';
import { ApplicationForm } from '@/components/application-form';
import { requireUser } from '@/server/auth';

export default async function NewApplicationPage() {
  await requireUser();
  return <ApplicationForm applicationId={randomUUID()} />;
}
