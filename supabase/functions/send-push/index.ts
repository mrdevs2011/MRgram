// Supabase Edge Function: yangi xabar / guruh xabari / qo'ng'iroq → Web Push
// Database Webhook (INSERT) shu funksiyani chaqiradi. Sozlash: README.md
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_SECRET_KEY")!,
);

const ok = (b = "ok") => new Response(b, { status: 200 });

function preview(r: any): string {
  if (r.type === "voice") return "Ovozli xabar";
  if (r.type === "file") return (r.file_name || "Fayl");
  const t = String(r.text ?? "").trim();
  return t.length > 120 ? t.slice(0, 117) + "..." : t;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("PUSH_WEBHOOK_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch { return ok("bad json"); }
  const { type, table, record: r } = body ?? {};
  if (type !== "INSERT" || !r) return ok("skip");

  let recipients: string[] = [];
  let payload: Record<string, unknown> = {};
  let ttl = 3600;
  let urgency: "high" | "normal" = "normal";

  const { data: sender } = await sb.from("profiles")
    .select("full_name").eq("id", r.sender_id ?? r.caller_id).maybeSingle();
  const senderName = sender?.full_name || "MRspace";

  if (table === "messages") {
    const { data } = await sb.from("chat_members").select("user_id")
      .eq("chat_id", r.chat_id).neq("user_id", r.sender_id);
    recipients = (data ?? []).map((m) => m.user_id);
    payload = { type: "message", title: senderName, body: preview(r), chatId: r.chat_id, fromUid: r.sender_id };
  } else if (table === "group_messages") {
    const { data: g } = await sb.from("groups").select("name, type").eq("id", r.group_id).maybeSingle();
    const { data } = await sb.from("group_members").select("user_id")
      .eq("group_id", r.group_id).neq("user_id", r.sender_id);
    recipients = (data ?? []).map((m) => m.user_id);
    const isChannel = g?.type === "channel";
    payload = {
      type: "group",
      title: g?.name || "Guruh",
      body: isChannel ? preview(r) : `${senderName}: ${preview(r)}`,
      groupId: r.group_id,
      fromUid: r.sender_id,
    };
  } else if (table === "calls") {
    if (r.status !== "ringing") return ok("skip");
    recipients = [r.callee_id];
    payload = { type: "call", title: senderName, body: "Qo'ng'iroq qilmoqda...", fromUid: r.caller_id, callId: r.id };
    ttl = 30; urgency = "high";
  } else {
    return ok("skip");
  }

  if (!recipients.length) return ok("no recipients");

  const { data: rows } = await sb.from("push_tokens").select("token").in("user_id", recipients);
  const msg = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all((rows ?? []).map(async ({ token }) => {
    try {
      await webpush.sendNotification(JSON.parse(token), msg, { TTL: ttl, urgency });
    } catch (e: any) {
      // 404/410 — obuna o'lgan, jadvaldan olib tashlaymiz
      if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(token);
      else console.error("[send-push]", e?.statusCode, e?.body ?? e?.message);
    }
  }));

  if (dead.length) await sb.from("push_tokens").delete().in("token", dead);
  return ok(`sent ${(rows?.length ?? 0) - dead.length}`);
});
