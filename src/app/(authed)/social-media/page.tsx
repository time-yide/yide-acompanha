import { redirect } from "next/navigation";

// /social-media é a entrada do menu lateral, mas o conteúdo principal
// agora é o Painel Mensal (decisão da sócia). O feed antigo de agendamento
// foi pra /social-media/agendamento, e Painel Mensal mora em /painel.
export default function SocialMediaIndexPage() {
  redirect("/painel");
}
