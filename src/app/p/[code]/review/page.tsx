"use client";

import Link from "next/link";
import { CheckCircle2, Users } from "lucide-react";
import { useProject } from "@/components/ProjectProvider";
import PeerReviewForm from "@/components/PeerReviewForm";
import { Alert, Card, PageTitle } from "@/components/ui";

export default function ReviewPage() {
  const { code, data, refresh } = useProject();
  const others = data.members.filter((m) => m.id !== data.me.id);
  const submittedCount = data.submittedCount;

  return (
    <>
      <PageTitle title="Đánh giá chéo ẩn danh" desc="Chấm điểm 1–5 sao theo 3 tiêu chí cho từng đồng đội. Thực hiện khi dự án gần hoàn thành." />

      {data.me.submitted ? (
        <Card className="mx-auto max-w-lg text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">Bạn đã nộp đánh giá</h2>
          <p className="mt-1 text-sm text-slate-500">
            Cảm ơn bạn! Đã có {submittedCount}/{data.members.length} thành viên nộp đánh giá. Báo cáo sẽ chính xác hơn khi cả nhóm cùng nộp.
          </p>
          <Link
            href={`/p/${code}/report`}
            className="mt-4 inline-block rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Xem báo cáo đóng góp
          </Link>
        </Card>
      ) : others.length === 0 ? (
        <Card className="mx-auto max-w-lg text-center">
          <Users className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 text-sm text-slate-600">Nhóm chưa có thành viên nào khác. Hãy gửi mã nhóm cho đồng đội trước.</p>
          <p className="mt-2 font-mono text-2xl font-bold text-indigo-600">{code}</p>
        </Card>
      ) : (
        <>
          {data.members.length < 4 && (
            <div className="mb-4">
              <Alert tone="warn">Nhóm còn ít thành viên nên đánh giá có thể bị đoán ra người chấm – hãy góp ý lịch sự và trung thực.</Alert>
            </div>
          )}
          <PeerReviewForm onDone={refresh} />
        </>
      )}
    </>
  );
}
