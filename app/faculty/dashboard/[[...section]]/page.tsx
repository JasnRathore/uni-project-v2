import { FacultyDashboardPage } from '@/components/FacultyDashboardPage';
import { notFound } from 'next/navigation';

export default async function FacultyDashboardRoute({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  if (section?.[0] === 'add-class') notFound();

  return <FacultyDashboardPage />;
}
