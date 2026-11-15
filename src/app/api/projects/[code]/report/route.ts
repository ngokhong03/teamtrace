import { getStore } from "@/lib/store";
import { authenticate, route } from "@/lib/http";
import { buildReport, loadProjectData } from "@/lib/report";
import type { ReportResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request, ctx: { params: { code: string } }): Promise<ReportResponse> => {
  const { project, member } = await authenticate(req, ctx.params.code);
  const data = await loadProjectData(getStore(), project);
  return buildReport(data, member.id, member.isLeader);
});
