export function DriveCell({ driveUrl }: { driveUrl: string | null }) {
  if (!driveUrl) {
    return <span className="text-[12px] text-muted-foreground/40">–</span>;
  }
  return (
    <a
      href={driveUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[12px] text-primary hover:underline"
      title="Abrir drive em nova aba"
    >
      Abrir
    </a>
  );
}
