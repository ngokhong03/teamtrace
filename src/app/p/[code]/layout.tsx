import ProjectShell from "@/components/ProjectShell";

export default function ProjectLayout({ children, params }: { children: React.ReactNode; params: { code: string } }) {
  return <ProjectShell code={params.code}>{children}</ProjectShell>;
}
