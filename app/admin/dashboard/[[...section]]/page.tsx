import { AdminDashboardPage as AdminDashboardPageClient } from "@/components/AdminDashboardPage";
import { notFound } from 'next/navigation';

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  if (section?.[0] === 'add-class') notFound();

  return <AdminDashboardPageClient />;
}
