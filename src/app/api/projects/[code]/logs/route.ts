import { getStore } from "@/lib/store";
import { HttpError, authenticate, readJson, route, str, text, isoDate } from "@/lib/http";
import { CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request, ctx: { params: { code: string } }) => {
  const { project, member } = await authenticate(req, ctx.params.code);
  const body = await readJson(req);

  const task = str(body.task, "Tên đầu việc", { min: 2, max: 150 });
  const description = text(body.description, "Mô tả", { min: 10, max: 1500 });

  let link = typeof body.link === "string" ? body.link.trim() : "";
  if (link) {
    if (!/^https?:\/\//i.test(link)) link = "https://" + link;
    try {
      new URL(link);
    } catch {
      throw new HttpError(400, "Link minh chứng không hợp lệ");
    }
    if (link.length > 500) throw new HttpError(400, "Link quá dài");
  }

  const category = typeof body.category === "string" && (CATEGORIES as readonly string[]).includes(body.category)
    ? body.category
    : "Khác";

  const hours = Number(body.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 40) {
    throw new HttpError(400, "Thời gian thực hiện phải từ 0.25 đến 40 giờ");
  }
  const percent = Number(body.percent);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new HttpError(400, "% hoàn thành phải từ 0 đến 100");
  }

  const workDate = isoDate(body.workDate, "Ngày thực hiện");
  // Không cho ghi nhận lùi quá 60 ngày hoặc tương lai quá 1 ngày (lệch múi giờ)
  const diffDays = (Date.parse(workDate) - Date.now()) / 86_400_000;
  if (diffDays > 1 || diffDays < -60) throw new HttpError(400, "Ngày thực hiện không hợp lệ");

  const log = await getStore().addLog({
    projectId: project.id,
    memberId: member.id,
    task,
    description,
    link,
    category,
    hours: Math.round(hours * 4) / 4,
    percent: Math.round(percent),
    workDate,
  });
  return { log };
});
