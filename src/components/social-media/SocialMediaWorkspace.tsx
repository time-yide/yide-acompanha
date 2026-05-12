"use client";

import { useState } from "react";
import { CalendarDays, List, Plus, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarMonthView } from "./CalendarMonthView";
import { PostsListView } from "./PostsListView";
import { PostFormModal } from "./PostFormModal";
import { AccountsModal } from "./AccountsModal";
import type { SocialPostRow } from "@/lib/social-media/queries";

interface Props {
  clientId: string;
  clientNome: string;
  posts: SocialPostRow[];
  canManage: boolean;
  contas: {
    instagram_business_id: string | null;
    facebook_page_id: string | null;
    linkedin_company_id: string | null;
    gmn_location_id: string | null;
  };
}

export function SocialMediaWorkspace({
  clientId, clientNome, posts, canManage, contas,
}: Props) {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<SocialPostRow | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined);
  const [openAccounts, setOpenAccounts] = useState(false);

  function novoPost() {
    setEditing(null);
    setDefaultDate(undefined);
    setOpenForm(true);
  }
  function novoPostNaData(date: string) {
    setEditing(null);
    setDefaultDate(date);
    setOpenForm(true);
  }
  function editarPost(post: SocialPostRow) {
    setEditing(post);
    setDefaultDate(undefined);
    setOpenForm(true);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button size="sm" onClick={novoPost}>
              <Plus className="h-4 w-4" /> Novo post
            </Button>
          )}
          <div className="inline-flex rounded-md border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`inline-flex h-7 items-center gap-1 rounded px-2 text-xs ${view === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Calendário
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`inline-flex h-7 items-center gap-1 rounded px-2 text-xs ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
          </div>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setOpenAccounts(true)}>
            <LinkIcon className="h-4 w-4" /> Contas
          </Button>
        )}
      </div>

      {view === "calendar" ? (
        <CalendarMonthView
          posts={posts}
          onCreateForDate={novoPostNaData}
          onEditPost={editarPost}
          canManage={canManage}
        />
      ) : (
        <PostsListView
          posts={posts}
          canManage={canManage}
          onEditPost={editarPost}
        />
      )}

      {openForm && (
        <PostFormModal
          open={openForm}
          onOpenChange={setOpenForm}
          clientId={clientId}
          post={editing}
          defaultDate={defaultDate}
        />
      )}
      {openAccounts && (
        <AccountsModal
          open={openAccounts}
          onOpenChange={setOpenAccounts}
          clientId={clientId}
          clientNome={clientNome}
          initial={contas}
        />
      )}
    </>
  );
}
