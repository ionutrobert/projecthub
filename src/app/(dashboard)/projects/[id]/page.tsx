import ProjectDetailsClient from "../project-details-client";

export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectDetailsClient mode="view" projectId={id} />;
}
