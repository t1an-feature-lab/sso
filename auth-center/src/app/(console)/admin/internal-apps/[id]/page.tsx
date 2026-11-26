import { redirect } from 'next/navigation';
import { requireAdmin } from '@/server/auth';

export default async function InternalAppDetail() {
  await requireAdmin();
  redirect('/admin/internal-apps');
}
