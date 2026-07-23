import { describe, it, expect } from "vitest";
import { mapMeetingRow } from "./queries";

describe("mapMeetingRow", () => {
  it("mapeia row do supabase pra MeetingListItem", () => {
    const row = {
      id: "m1", titulo: "Kickoff", status: "completed", source: "app_recording",
      starts_at: "2026-07-20T10:00:00Z", ends_at: "2026-07-20T11:00:00Z",
      duracao_segundos: 3600, owner_user_id: "u1",
      recording_ready: true, transcript_ready: false, summary_ready: false, insights_ready: false,
      lead_id: null, client_id: "c1", tags: ["kickoff"],
      owner: { nome: "Duxx", avatar_url: null },
      client: { nome: "Centra MT" },
    };
    const item = mapMeetingRow(row);
    expect(item.id).toBe("m1");
    expect(item.owner_nome).toBe("Duxx");
    expect(item.client_nome).toBe("Centra MT");
    expect(item.recording_ready).toBe(true);
    expect(item.participantes_count).toBe(0);
  });
});
