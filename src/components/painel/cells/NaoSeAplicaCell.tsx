interface Props {
  tooltip?: string;
}

export function NaoSeAplicaCell({ tooltip }: Props) {
  return (
    <span
      title={tooltip ?? "Não se aplica a este pacote"}
      className="inline-flex h-7 w-12 items-center justify-center rounded-md text-[11px] text-muted-foreground/60"
    >
      —
    </span>
  );
}
