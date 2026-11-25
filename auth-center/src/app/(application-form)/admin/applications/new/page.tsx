import { redirect } from 'next/navigation';
import { requireAdmin } from '@/server/auth';

export default async function NewApplicationPage() {
  await requireAdmin();
  redirect('/admin/applications');
}
