import { redirect } from 'next/navigation';

export default async function AdminDashboardAlias({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const suffix = section?.length
    ? `/${section.map(segment => encodeURIComponent(segment)).join('/')}`
    : '';
  redirect(`/faculty/dashboard${suffix}`);
}
