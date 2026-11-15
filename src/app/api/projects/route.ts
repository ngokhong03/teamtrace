import { randomInt } from "crypto";
import { getStore } from "@/lib/store";
import { HttpError, isoDate, readJson, route, str } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Tạo dự án mới + thành viên đầu tiên (trưởng nhóm). */
export const POST = route(async (req: Request) => {
  const body = await readJson(req);
  const name = str(body.name, "Tên dự án", { min: 2, max: 120 });
  const course = str(body.course, "Môn học", { max: 120, optional: true });
  const deadline = isoDate(body.deadline, "Deadline", true);
  const leaderName = str(body.leaderName, "Họ tên", { min: 2, max: 60 });
  const leaderStudentId = str(body.leaderStudentId, "Mã sinh viên", { min: 3, max: 30 });

  const store = getStore();
  let code = "";
  for (let i = 0; i < 10; i++) {
    const c = String(randomInt(100000, 1000000));
    if (!(await store.getProjectByCode(c))) {
      code = c;
      break;
    }
  }
  if (!code) throw new HttpError(500, "Không tạo được mã dự án, vui lòng thử lại");

  const project = await store.createProject({ code, name, course, deadline });
  const leader = await store.addMember(project.id, { name: leaderName, studentId: leaderStudentId, isLeader: true });
  return { code, memberId: leader.id, token: leader.token, name: leader.name };
});
