"use client";

import { useTransition } from "react";
import { Download, FileText, FileVideo } from "lucide-react";
import { markYoriJobDownloadedAction } from "@/lib/yori/actions";
import type { YoriJob } from "@/lib/yori/tipos";

interface Props {
  job: YoriJob;
  signedUrls: {
    mp4: string | null;
    srt: string | null;
    txt: string | null;
  };
}

export function YoriResultPreview({ job, signedUrls }: Props) {
  const [, startTransition] = useTransition();

  function handleDownload(type: "mp4" | "srt" | "txt") {
    const fd = new FormData();
    fd.set("jobId", job.id);
    fd.set("type", type);
    startTransition(async () => {
      await markYoriJobDownloadedAction(fd);
    });
  }

  return (
    <div className="space-y-3">
      {signedUrls.mp4 && (
        <video src={signedUrls.mp4} controls className="w-full rounded-lg border" />
      )}
      <div className="flex flex-wrap gap-2">
        {signedUrls.mp4 && (
          <a
            href={signedUrls.mp4}
            download={`${job.video_filename}-yori.mp4`}
            onClick={() => handleDownload("mp4")}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <FileVideo className="h-3.5 w-3.5" /> Baixar MP4
          </a>
        )}
        {signedUrls.srt && (
          <a
            href={signedUrls.srt}
            download={`${job.video_filename}.srt`}
            onClick={() => handleDownload("srt")}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> Baixar .srt
          </a>
        )}
        {signedUrls.txt && (
          <a
            href={signedUrls.txt}
            download={`${job.video_filename}.txt`}
            onClick={() => handleDownload("txt")}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted"
          >
            <FileText className="h-3.5 w-3.5" /> Baixar transcrição
          </a>
        )}
      </div>
    </div>
  );
}
