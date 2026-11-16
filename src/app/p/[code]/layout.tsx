import ProjectShell from "@/components/ProjectShell";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ProjectShell code={code}>{children}</ProjectShell>;
}
