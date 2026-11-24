import { notFound } from 'next/navigation';
import { ApplicationForm } from '@/components/application-form';
import { getApplication } from '@/server/application/queries';

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const application = await getApplication((await params).id, 'all');
  if (!application) notFound();
  return <ApplicationForm key={application.id} application={application} protocol={application.protocol} admin />;
}
