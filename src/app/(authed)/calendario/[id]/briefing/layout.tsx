// Layout enxuto pra rota de briefing — sobrescreve o (authed) layout (sidebar+header).
export default function BriefingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
