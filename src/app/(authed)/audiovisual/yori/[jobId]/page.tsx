import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { canUseYori, isYoriEnabled } from "@/lib/yori/feature-flag";
import { getJob } from "@/lib/yori/queries";
import { getSignedUrl } from "@/lib/yori/storage";
import { YoriJobStatus } from "@/components/yori/YoriJobStatus";
import { YoriResultPreview } from "@/components/yori/YoriResultPreview";

export const dynamic = "force-dynamic";

export default async function YoriJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const user = await requireAuth();
  if (!canUseYori(user.role)) redirect("/audiovisual");
  if (!isYoriEnabled()) redirect("/audiovisual");

  const job = await getJob(jobId);
  if (!job) notFound();
  if (job.user_id !== user.id) redirect("/audiovisual/yori");

  const signedUrls = job.status === "done"
    ? {
        mp4: job.mp4_path ? await getSignedUrl("yori-outputs", job.mp4_path) : null,
        srt: job.srt_path ? await getSignedUrl("yori-outputs", job.srt_path) : null,
        txt: job.txt_path ? await getSignedUrl("yori-outputs", job.txt_path) : null,
      }
    : { mp4: null, srt: null, txt: null };

  return (
    <div className="max-w-3xl space-y-4">
      <Link
        href="/audiovisual/yori"
        prefetch={false}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar
      </Link>
      <div>
        <h1 className="text-xl font-bold tracking-tight">{job.video_filename}</h1>
        <p className="text-xs text-muted-foreground">
          Criado em {new Date(job.created_at).toLocaleString("pt-BR")}
        </p>
      </div>

      {job.status === "done" ? (
        <YoriResultPreview job={job} signedUrls={signedUrls} />
      ) : (
        <YoriJobStatus initialJob={job} />
      )}
    </div>
  );
}
