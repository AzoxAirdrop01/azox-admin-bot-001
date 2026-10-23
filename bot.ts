// AZOX Admin Bot — TypeScript (Secured & Validated)
// grammy + @supabase/supabase-js

import { Bot, InlineKeyboard, session } from "grammy";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, createHash, createHmac } from "node:crypto";

// ─── ENV ────────────────────────────────────────────
const BOT_TOKEN    = process.env.ADMIN_BOT_TOKEN!;
const ADMIN_ID     = Number(process.env.ADMIN_TELEGRAM_ID!);
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── TYPES ──────────────────────────────────────────
type Platform = "telegram" | "instagram" | "tiktok" | "threads" | "x" | "youtube" | "discord";

interface SessionData {
  step?: string;
  platform?: Platform;
  title?: string;
  url?: string;
  points?: number;
  taskReward?: number;
  msgBody?: string;     // ← for announcements
  editTaskId?: string;
  editField?: string;
  // ── stories ──
  storyFileId?: string;
  storyMime?: string;
  storyKind?: "image" | "video";
  storyExt?: string;
  storyLink?: string;
  storyHours?: number;
  // ── privacy (private stories / private messages) ──
  storyPrivate?: boolean;
  privKind?: "story" | "message" | "chatmsg";
  privRecipients?: number[];
  privLabels?: Record<string, string>;
  privNotes?: string;
  rcpKind?: "story" | "message";
  rcpId?: string;
  rcpMode?: "set" | "add";
  // ── chat messages (the bot writes into users' chats) ──
  cmKind?: "text" | "photo" | "video" | "animation";
  cmFileId?: string;
  cmText?: string;
  cmEntities?: any[];
  cmButtons?: { text: string; url: string }[];
  cmPrivate?: boolean;
  cmEditId?: string;
  // ── ban ──
  banIds?: number[];
  banLabels?: Record<string, string>;
  // ── story tasks ──
  stKind?: "view" | "like" | "comment";
  // ── geo targeting (/promo_story, /search_location) ──
  geoKind?: "promo" | "search";
  geoStoryId?: string;
  geoStoryLabel?: string;
  geoRule?: "include" | "exclude";
  geoSel?: string[];      // selected country codes
  geoZoneSel?: string[];  // selected zone ids (Kurdistan areas)
}

// ─── BOT ────────────────────────────────────────────
// Optional: a self-hosted Telegram Bot API server (lifts the 20 MB download limit of the cloud API).
// Leave TELEGRAM_API_ROOT unset to keep using api.telegram.org.
const TELEGRAM_API_ROOT = (process.env.TELEGRAM_API_ROOT ?? "").trim().replace(/\/+$/, "");
const bot = new Bot<{ session: SessionData }>(
  BOT_TOKEN,
  TELEGRAM_API_ROOT ? { client: { apiRoot: TELEGRAM_API_ROOT } } : undefined
);
bot.use(session({ initial: (): SessionData => ({}) }));

// ─── ADMIN GUARD ────────────────────────────────────
function isAdmin(ctx: any): boolean {
  return ctx.from?.id === ADMIN_ID;
}

async function requireAdmin(ctx: any): Promise<boolean> {
  if (!isAdmin(ctx)) {
    await ctx.reply?.("⛔ Access denied.").catch(() => {});
    await ctx.answerCallbackQuery?.("⛔ Access denied.").catch(() => {});
    return false;
  }
  return true;
}

// ─── VALIDATION ─────────────────────────────────────
function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isValidPoints(str: string): number | null {
  const n = parseInt(str.trim(), 10);
  if (isNaN(n) || n < 0 || n > 100000) return null;
  return n;
}

function isValidTaskReward(str: string): number | null {
  const n = parseInt(str.trim(), 10);
  if (isNaN(n) || n < 0 || n > 100) return null;
  return n;
}

// ─── PLATFORMS ──────────────────────────────────────
const PLATFORMS: Platform[] = ["telegram", "instagram", "tiktok", "threads", "x", "youtube", "discord"];
const PLATFORM_EMOJI: Record<Platform, string> = {
  telegram:  "✈️",
  instagram: "📷",
  tiktok:    "🎵",
  threads:   "🧵",
  x:         "𝕏",
  youtube:   "▶️",
  discord:   "💬",
};

// ─── KEYBOARDS ──────────────────────────────────────
function mainMenuKeyboard() {
  return new InlineKeyboard()
    .text("➕ Add Task",    "menu_add")
    .text("✏️ Edit Task",   "menu_edit").row()
    .text("🚫 Disable Task","menu_disable")
    .text("🗑 Delete Task", "menu_delete").row()
    .text("📋 View Tasks",  "menu_view");
}

function platformKeyboard(prefix: string) {
  const kb = new InlineKeyboard();
  PLATFORMS.forEach((p, i) => {
    kb.text(`${PLATFORM_EMOJI[p]} ${p}`, `${prefix}_${p}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row().text("❌ Cancel", "cancel");
  return kb;
}

// ─── /start & /edit_task ────────────────────────────
bot.command("start", async (ctx) => {
  console.log("[/start] received from:", ctx.from?.id);
  if (isAdmin(ctx)) {
    await ctx.reply("👋 AZOX Admin Bot\n\nCommands:\n/edit_task — Manage tasks\n/message — Send announcement\n/edit_message — Edit announcements\n/share_story — Manage Story\n/edit_story — edit Story\n/story_privacy — Story Privacy\n/edit_story_privacy — Story Privacy\n/massage_privacy — Massage Privacy\n/edit_massage_privacy — Massage Privacy\n/chat_massage — Chat Massage\n/edit_chat_massage — Edit Chat Massage\n/chat_massage_privacy — Chat Massage Privacy\n/edit_chat_massage_privacy — Edit Chat Massage Privacy\n/ban — Ban accounts\n/edit_gps — GPS settings\n/game_fraze — Games ON/OFF\n/game_change — Gaming page Face 1 / Face 2\n/story_task — Story view / like / comment tasks\n/promo_story — Show a Story only in chosen areas\n/search_location — Count users in chosen areas");
  } else {
    await ctx.reply("⛔ Access denied.");
  }
});

bot.command("edit_task", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = {};
  await ctx.reply("🛠 Task Management", { reply_markup: mainMenuKeyboard() });
});

// ─── CANCEL ─────────────────────────────────────────
bot.callbackQuery("cancel", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = {};
  await ctx.editMessageText("✅ Cancelled.");
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("menu_back", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = {};
  await ctx.editMessageText("🛠 Task Management", { reply_markup: mainMenuKeyboard() });
  await ctx.answerCallbackQuery();
});

// ═══════════════════════════════════════════════════
// ➕ ADD TASK FLOW
// ═══════════════════════════════════════════════════

bot.callbackQuery("menu_add", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "add_platform" };
  await ctx.editMessageText("➕ Add Task\n\nChoose platform:", {
    reply_markup: platformKeyboard("add_plat"),
  });
  await ctx.answerCallbackQuery();
});

PLATFORMS.forEach((p) => {
  bot.callbackQuery(`add_plat_${p}`, async (ctx) => {
    if (!await requireAdmin(ctx)) return;
    ctx.session.platform = p;
    ctx.session.step = "add_title";
    await ctx.editMessageText(
      `➕ Add — ${PLATFORM_EMOJI[p]} ${p}\n\nSend the account name:\n(e.g. AZOX Foundation)`
    );
    await ctx.answerCallbackQuery();
  });
});

// ═══════════════════════════════════════════════════
// 📢 /message COMMAND — Announcements
// ═══════════════════════════════════════════════════

bot.command("message", async (ctx) => {
  console.log("[/message] received from:", ctx.from?.id, "admin:", ADMIN_ID);
  if (!await requireAdmin(ctx)) {
    console.log("[/message] access denied");
    return;
  }
  ctx.session = { step: "msg_title" };
  await ctx.reply("📢 New Announcement\n\nSend the title:");
});

// In the text handler, add these steps:
// msg_title → msg_body → msg_confirm
// Already handled in the main text handler below as an extension.

// Add /edit_message command
bot.command("edit_message", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const { data: msgs } = await supabase
    .from("announcements")
    .select("id, title, created_at")
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!msgs || msgs.length === 0) {
    return ctx.reply("📋 No announcements found.");
  }

  const kb = new InlineKeyboard();
  msgs.forEach((m: any) => {
    const date = new Date(m.created_at).toLocaleDateString("en-GB");
    kb.text(`${date} — ${m.title.slice(0, 30)}`, `editmsg_${m.id}`).row();
  });
  kb.text("🗑 Delete a message", "deletemsg_list");

  await ctx.reply("✏️ Edit Announcement — Choose:", { reply_markup: kb });
});

bot.callbackQuery(/^editmsg_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const msgId = ctx.match[1];
  const { data: msg } = await supabase
    .from("announcements").select("*").eq("id", msgId).single();
  if (!msg) return ctx.editMessageText("❌ Not found.");

  ctx.session = { step: "editmsg_field", editTaskId: msgId };
  const kb = new InlineKeyboard()
    .text("📝 Edit Title",   `editmsgfield_${msgId}_title`).row()
    .text("📄 Edit Message", `editmsgfield_${msgId}_message`).row()
    .text("🗑 Delete",       `deletemsg_${msgId}`).row()
    .text("❌ Cancel", "cancel");

  await ctx.editMessageText(
    `📢 "${msg.title}"\n\n${msg.message}\n\nWhat to edit?`,
    { reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^editmsgfield_(.+)_(title|message)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const [, msgId, field] = ctx.match;
  ctx.session = { step: "editmsg_value", editTaskId: msgId, editField: field };
  await ctx.editMessageText(
    field === "title" ? "📝 Send the new title:" : "📄 Send the new message:"
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("deletemsg_list", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const { data: msgs } = await supabase
    .from("announcements")
    .select("id, title, created_at")
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!msgs || msgs.length === 0) {
    await ctx.editMessageText("No announcements.");
    return ctx.answerCallbackQuery();
  }

  const kb = new InlineKeyboard();
  msgs.forEach((m: any) => {
    const date = new Date(m.created_at).toLocaleDateString("en-GB");
    kb.text(`🗑 ${date} — ${m.title.slice(0, 25)}`, `deletemsg_${m.id}`).row();
  });
  kb.text("❌ Cancel", "cancel");
  await ctx.editMessageText("🗑 Choose announcement to delete:", { reply_markup: kb });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^deletemsg_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const msgId = ctx.match[1];
  const { data: msg } = await supabase
    .from("announcements").select("title").eq("id", msgId).single();
  const { error } = await supabase.from("announcements").delete().eq("id", msgId);
  ctx.session = {};
  if (error) {
    await ctx.editMessageText(`❌ Error: ${error.message}`);
  } else {
    await ctx.editMessageText(`✅ "${msg?.title}" deleted.`);
  }
  await ctx.answerCallbackQuery();
});


// NOTE: story commands must be registered BEFORE the text handler below,
// because that handler consumes every text message (commands included).
// ═══════════════════════════════════════════════════
// 📖 STORIES — /share_story & /edit_story
// Media goes to the public Supabase Storage bucket "stories";
// the row in public.stories is what the Mini App reads.
// ═══════════════════════════════════════════════════

const STORY_BUCKET = "stories";                 // public stories (public bucket)
const STORY_BUCKET_PRIVATE = "stories-private"; // private stories (PRIVATE bucket, signed URLs only)
// Max story file size in MB. Default 20 = the cloud Bot API download limit.
// Raising it needs BOTH a self-hosted Bot API server (TELEGRAM_API_ROOT) AND a larger Supabase storage limit.
const STORY_MAX_MB = Math.min(2000, Math.max(1, Number(process.env.STORY_MAX_MB) || 20));
const STORY_MAX_BYTES = STORY_MAX_MB * 1024 * 1024;

// ── Cloudflare R2 storage for story media (S3 API, SigV4) ─────────────────────
// Opt in with STORY_STORAGE=r2 plus R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
// R2 has free egress and no 50 MB cap. Without STORY_STORAGE=r2 the bot keeps using Supabase Storage.
const R2_ACCOUNT_ID = (process.env.R2_ACCOUNT_ID ?? "").trim();
const R2_ACCESS_KEY_ID = (process.env.R2_ACCESS_KEY_ID ?? "").trim();
const R2_SECRET_ACCESS_KEY = (process.env.R2_SECRET_ACCESS_KEY ?? "").trim();
const R2_BUCKET = (process.env.R2_BUCKET ?? "").trim();
const USE_R2 = (process.env.STORY_STORAGE ?? "").trim().toLowerCase() === "r2";
const R2_READY = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);
if (USE_R2 && !R2_READY) {
  console.error("STORY_STORAGE=r2 but R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET are not all set");
}

function r2Headers(method: "PUT" | "DELETE", key: string, payload: Buffer | string, contentType?: string) {
  const hmac = (k: Buffer | string, d: string) => createHmac("sha256", k).update(d).digest();
  const sha = (d: Buffer | string) => createHash("sha256").update(d).digest("hex");
  const enc = (s: string) =>
    encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const scope = `${date}/auto/s3/aws4_request`;
  const path = `/${enc(R2_BUCKET)}/${key.split("/").map(enc).join("/")}`;
  const payloadHash = sha(payload);
  const h: Record<string, string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  const names = Object.keys(h).sort();
  const canonicalHeaders = names.map((n) => `${n}:${h[n]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha(canonicalRequest)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac("AWS4" + R2_SECRET_ACCESS_KEY, date), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const { host: _host, ...send } = h; // fetch sets Host itself
  // Content-Type is sent but not signed (allowed by SigV4 and R2).
  return {
    url: `https://${host}${path}`,
    headers: { ...send, ...(contentType ? { "content-type": contentType } : {}), authorization } as Record<string, string>,
  };
}

async function r2Put(key: string, body: Buffer, contentType: string): Promise<void> {
  if (!R2_READY) throw new Error("R2 is not configured (R2_* variables)");
  const r = r2Headers("PUT", key, body, contentType);
  const res = await fetch(r.url, { method: "PUT", headers: r.headers, body: body as unknown as BodyInit });
  if (!res.ok) throw new Error(`R2 upload failed (HTTP ${res.status})`);
}

async function r2Delete(key: string): Promise<void> {
  if (!R2_READY) throw new Error("R2 is not configured (R2_* variables)");
  const r = r2Headers("DELETE", key, "");
  const res = await fetch(r.url, { method: "DELETE", headers: r.headers });
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed (HTTP ${res.status})`);
}
const STORY_MIN_HOURS = 1;
const STORY_MAX_HOURS = 120;
const STORY_MAX_LINK_LENGTH = 2048;
const STORY_DURATION_PROMPT =
  `⏱ How many hours should the story stay visible?\n\nTap a button or send a number from ${STORY_MIN_HOURS} to ${STORY_MAX_HOURS}:`;

const STORY_MIMES: Record<string, { kind: "image" | "video"; ext: string }> = {
  "image/jpeg":      { kind: "image", ext: "jpg" },
  "image/png":       { kind: "image", ext: "png" },
  "image/webp":      { kind: "image", ext: "webp" },
  "video/mp4":       { kind: "video", ext: "mp4" },
  "video/webm":      { kind: "video", ext: "webm" },
  "video/quicktime": { kind: "video", ext: "mov" },
};

// Same rule as requireAdmin, but safe for text commands from non-admins
// (answerCallbackQuery throws when the update is not a callback query).
async function denyNonAdmin(ctx: any): Promise<boolean> {
  if (isAdmin(ctx)) return false;
  await ctx.reply("⛔ Access denied.").catch(() => {});
  return true;
}

function isValidStoryUrl(str: string): boolean {
  return str.length <= STORY_MAX_LINK_LENGTH && isValidUrl(str);
}

function parseStoryHours(str: string): number | null {
  const t = str.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = parseInt(t, 10);
  if (n < STORY_MIN_HOURS || n > STORY_MAX_HOURS) return null;
  return n;
}

function storyLinkKeyboard() {
  return new InlineKeyboard()
    .text("⏭ Skip (no link)", "sty_skip_link")
    .text("❌ Cancel", "cancel");
}

function storyDurationKeyboard() {
  const kb = new InlineKeyboard();
  [6, 12, 24, 48, 72, 120].forEach((h, i) => {
    kb.text(`${h}h`, `sty_dur_${h}`);
    if (i % 3 === 2) kb.row();
  });
  kb.text("❌ Cancel", "cancel");
  return kb;
}

function storyPreview(s: SessionData) {
  const expires = new Date(Date.now() + (s.storyHours ?? 0) * 3600_000);
  const kb = new InlineKeyboard()
    .text("✅ Publish story", "sty_confirm")
    .text("❌ Cancel", "cancel");
  const text =
    `📖 Story preview:\n\n` +
    `Type: ${s.storyKind === "video" ? "🎬 Video" : "🖼 Image"}\n` +
    `Link: ${s.storyLink ?? "None"}\n` +
    `Duration: ${s.storyHours}h\n` +
    `Ends: ${expires.toISOString().replace("T", " ").slice(0, 16)} UTC`;
  return { text, kb };
}

function storyTimeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const file = await bot.api.getFile(fileId);
  if (!file.file_path) throw new Error("Telegram returned no file path");
  // A local Bot API server started with --local returns an absolute path on its own disk.
  if (TELEGRAM_API_ROOT && file.file_path.startsWith("/")) {
    try {
      const { readFile } = await import("node:fs/promises");
      return await readFile(file.file_path);
    } catch {
      // not on this machine — fall through to HTTP
    }
  }
  const base = TELEGRAM_API_ROOT || "https://api.telegram.org";
  const rel = file.file_path.replace(/^\/+/, "");
  const res = await fetch(`${base}/file/bot${BOT_TOKEN}/${rel}`);
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// /share_story — step 1: ask for the media
bot.command("share_story", async (ctx) => {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = { step: "story_media" };
  await ctx.reply(
    `📖 New Story\n\nSend the photo or video (max ${STORY_MAX_MB} MB).\nSupported: JPG, PNG, WEBP, MP4, WEBM, MOV.`,
    { reply_markup: new InlineKeyboard().text("❌ Cancel", "cancel") }
  );
});

// step 1 (media received)
bot.on(["message:photo", "message:video", "message:animation", "message:document"], async (ctx) => {
  if (!isAdmin(ctx)) return;
  const s = ctx.session;
  if (s.step === "cm_content") return handleChatMediaContent(ctx, s);
  if (s.step !== "story_media") return;

  const m: any = ctx.message;
  let fileId: string | undefined;
  let size: number | undefined;
  let mime: string | undefined;

  if (m.photo?.length) {
    const biggest = m.photo[m.photo.length - 1];
    fileId = biggest.file_id;
    size = biggest.file_size;
    mime = "image/jpeg"; // Telegram always re-encodes photos as JPEG
  } else if (m.video) {
    fileId = m.video.file_id;
    size = m.video.file_size;
    mime = m.video.mime_type ?? "video/mp4";
  } else if (m.animation) {
    fileId = m.animation.file_id;
    size = m.animation.file_size;
    mime = m.animation.mime_type ?? "video/mp4";
  } else if (m.document) {
    fileId = m.document.file_id;
    size = m.document.file_size;
    mime = m.document.mime_type;
  }

  const type = mime ? STORY_MIMES[mime] : undefined;
  if (!fileId || !type) {
    return ctx.reply("❌ Unsupported file. Send a JPG, PNG, WEBP, MP4, WEBM or MOV.");
  }
  if (size !== undefined && size > STORY_MAX_BYTES) {
    return ctx.reply(`❌ File is larger than ${STORY_MAX_MB} MB. Send a smaller one:`);
  }

  s.storyFileId = fileId;
  s.storyMime = mime;
  s.storyKind = type.kind;
  s.storyExt = type.ext;
  s.step = "story_link";
  await ctx.reply(
    `✅ ${type.kind === "video" ? "Video" : "Image"} received.\n\n🔗 Send a link (https://...) that opens when people tap the story, or tap Skip:`,
    { reply_markup: storyLinkKeyboard() }
  );
});

// step 2 (skip link) → step 3
bot.callbackQuery("sty_skip_link", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const s = ctx.session;
  if (s.step !== "story_link") {
    await ctx.editMessageText("❌ Session expired. Use /share_story again.");
    return ctx.answerCallbackQuery();
  }
  s.storyLink = undefined;
  s.step = "story_duration";
  await ctx.editMessageText(STORY_DURATION_PROMPT, { reply_markup: storyDurationKeyboard() });
  await ctx.answerCallbackQuery();
});

// step 3 (duration preset) → preview
bot.callbackQuery(/^sty_dur_(\d+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const s = ctx.session;
  const hours = parseStoryHours(ctx.match[1]);
  if (s.step !== "story_duration" || hours === null) {
    await ctx.editMessageText("❌ Session expired. Use /share_story again.");
    return ctx.answerCallbackQuery();
  }
  s.storyHours = hours;
  if (s.storyPrivate) {
    s.step = "priv_to";
    s.privKind = "story";
    await ctx.editMessageText(PRIV_PROMPT, { reply_markup: cancelOnlyKeyboard() });
    return ctx.answerCallbackQuery();
  }
  s.step = "story_confirm";
  const p = storyPreview(s);
  await ctx.editMessageText(p.text, { reply_markup: p.kb });
  await ctx.answerCallbackQuery();
});

// step 4: publish (download from Telegram → Storage → row)
// Used by BOTH the public ("sty_confirm") and the private ("psty_confirm") buttons.
async function publishStory(ctx: any, isPrivate: boolean) {
  const s: SessionData = ctx.session;
  const expectedStep = isPrivate ? "priv_confirm" : "story_confirm";
  if (
    s.step !== expectedStep || !s.storyFileId || !s.storyMime ||
    !s.storyKind || !s.storyExt || !s.storyHours ||
    (isPrivate && (s.privKind !== "story" || !s.privRecipients?.length))
  ) {
    await ctx.editMessageText(`❌ Session expired. Use ${isPrivate ? "/story_privacy" : "/share_story"} again.`);
    return ctx.answerCallbackQuery();
  }
  await ctx.answerCallbackQuery({ text: "Publishing…" });

  let uploadedPath: string | null = null;
  const bucket = isPrivate ? STORY_BUCKET_PRIVATE : STORY_BUCKET;
  try {
    const buf = await downloadTelegramFile(s.storyFileId);
    if (buf.length > STORY_MAX_BYTES) throw new Error(`File is larger than ${STORY_MAX_MB} MB`);

    const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${s.storyExt}`;
    if (USE_R2) {
      await r2Put(path, buf, s.storyMime);
    } else {
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, buf, { contentType: s.storyMime, upsert: false });
      if (upErr) throw new Error(upErr.message);
    }
    uploadedPath = path;

    // Private media has NO public URL: the Mini App server signs a short-lived URL for recipients.
    // R2 media (public or private) is always signed by the Mini App server; media_url is only a placeholder.
    const publicUrl = USE_R2
      ? (isPrivate ? "" : `r2://${path}`)
      : isPrivate
        ? ""
        : supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const expiresAt = new Date(Date.now() + s.storyHours * 3600_000).toISOString();

    const row: Record<string, unknown> = {
      media_type:     s.storyKind,
      media_path:     path,
      media_url:      publicUrl,
      media_store:    USE_R2 ? "r2" : "supabase",
      link_url:       s.storyLink ?? null,
      duration_hours: s.storyHours,
      expires_at:     expiresAt,
      created_by:     ADMIN_ID,
    };

    let recipientCount = 0;
    if (isPrivate) {
      const { data: created, error: insErr } = await supabase
        .from("stories")
        .insert({ ...row, is_private: true })
        .select("id")
        .single();
      if (insErr || !created) throw new Error(insErr?.message ?? "Could not create the story");
      const { error: rErr } = await supabase
        .from("story_recipients")
        .insert(s.privRecipients!.map((id) => ({ story_id: created.id, telegram_id: id })));
      if (rErr) {
        await supabase.from("stories").delete().eq("id", created.id);
        throw new Error(rErr.message);
      }
      recipientCount = s.privRecipients!.length;
    } else {
      const { error: insErr } = await supabase.from("stories").insert(row);
      if (insErr) throw new Error(insErr.message);
    }

    const hours = s.storyHours;
    const linkLine = s.storyLink ? `\n🔗 ${s.storyLink}` : "";
    ctx.session = {};
    await ctx.editMessageText(
      isPrivate
        ? `✅ Private story published for ${hours}h to ${recipientCount} account${recipientCount === 1 ? "" : "s"}!${linkLine}`
        : `✅ Story published for ${hours}h!${linkLine}`
    );
  } catch (e: any) {
    if (uploadedPath) {
      if (USE_R2) await r2Delete(uploadedPath).catch(() => {});
      else await supabase.storage.from(bucket).remove([uploadedPath]).catch(() => {});
    }
    const p = isPrivate ? privateStoryPreview(s) : storyPreview(s);
    await ctx.editMessageText(`❌ Could not publish: ${e?.message ?? e}\n\n${p.text}`, { reply_markup: p.kb });
  }
}

bot.callbackQuery("sty_confirm", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  await publishStory(ctx, false);
});

bot.callbackQuery("psty_confirm", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  await publishStory(ctx, true);
});

// /edit_story — list the latest stories
bot.command("edit_story", async (ctx) => {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = {};
  const { data: stories, error } = await supabase
    .from("stories")
    .select("id, media_type, link_url, created_at, expires_at")
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return ctx.reply("❌ Error: " + error.message);
  if (!stories || stories.length === 0) {
    return ctx.reply("📖 No stories yet. Use /share_story to publish one.");
  }

  const kb = new InlineKeyboard();
  stories.forEach((st: any) => {
    const active = new Date(st.expires_at).getTime() > Date.now();
    const kind = st.media_type === "video" ? "🎬" : "🖼";
    const link = st.link_url ? " 🔗" : "";
    kb.text(`${active ? "🟢" : "⚪️"} ${kind} ${storyTimeLeft(st.expires_at)}${link}`, `sty_pick_${st.id}`).row();
  });
  kb.text("❌ Cancel", "cancel");
  await ctx.reply("✏️ Edit Story — choose:", { reply_markup: kb });
});

// pick one story
bot.callbackQuery(/^sty_pick_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const id = ctx.match[1];
  const { data: st } = await supabase.from("stories").select("*").eq("id", id).single();
  if (!st) {
    await ctx.editMessageText("❌ Story not found.");
    return ctx.answerCallbackQuery();
  }
  ctx.session = {};
  const kb = new InlineKeyboard().text("✏️ Edit link", `sty_link_${id}`).row();
  if (st.link_url) kb.text("❌ Remove link", `sty_unlink_${id}`).row();
  kb.text("🗑 Delete story", `sty_del_${id}`).row().text("❌ Cancel", "cancel");

  await ctx.editMessageText(
    `📖 Story\n\n` +
    `Type: ${st.media_type === "video" ? "🎬 Video" : "🖼 Image"}\n` +
    `Link: ${st.link_url ?? "None"}\n` +
    `Duration: ${st.duration_hours}h\n` +
    `Status: ${storyTimeLeft(st.expires_at)}`,
    { reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});

// edit link
bot.callbackQuery(/^sty_link_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "story_edit_link", editTaskId: ctx.match[1] };
  await ctx.editMessageText(
    "🔗 Send the new link (https://...):",
    { reply_markup: new InlineKeyboard().text("❌ Cancel", "cancel") }
  );
  await ctx.answerCallbackQuery();
});

// remove link
bot.callbackQuery(/^sty_unlink_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const { error } = await supabase
    .from("stories")
    .update({ link_url: null })
    .eq("id", ctx.match[1]);
  ctx.session = {};
  await ctx.editMessageText(error ? `❌ Error: ${error.message}` : "✅ Link removed from the story.");
  await ctx.answerCallbackQuery();
});

// delete (asks first)
bot.callbackQuery(/^sty_del_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const id = ctx.match[1];
  const kb = new InlineKeyboard()
    .text("🗑 YES — Delete story", `sty_delyes_${id}`).row()
    .text("❌ Cancel", "cancel");
  await ctx.editMessageText(
    "⚠️ Delete this story?\n\nThe media, views, likes and comments will be removed. This CANNOT be undone.",
    { reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^sty_delyes_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const id = ctx.match[1];
  const { data: st } = await supabase.from("stories").select("media_path, is_private, media_store").eq("id", id).single();
  if (!st) {
    await ctx.editMessageText("❌ Story not found.");
    return ctx.answerCallbackQuery();
  }
  // Row first (cascades views/likes/comments); then the file.
  const { error } = await supabase.from("stories").delete().eq("id", id);
  ctx.session = {};
  if (error) {
    await ctx.editMessageText(`❌ Error: ${error.message}`);
  } else {
    // A private story is removed from the private bucket AND (cleaning up stories that were
    // published before the private bucket existed) from the public one.
    if ((st as any).media_store === "r2") {
      await r2Delete(st.media_path).catch(() => {});
    } else {
      const buckets = st.is_private ? [STORY_BUCKET_PRIVATE, STORY_BUCKET] : [STORY_BUCKET];
      for (const b of buckets) {
        await supabase.storage.from(b).remove([st.media_path]).catch(() => {});
      }
    }
    await ctx.editMessageText("✅ Story deleted.");
  }
  await ctx.answerCallbackQuery();
});


// ═══════════════════════════════════════════════════
// 🔒 PRIVATE STORIES & PRIVATE MESSAGES
// /story_privacy, /edit_story_privacy, /massage_privacy, /edit_massage_privacy
// A private item is visible ONLY to the Telegram ids stored in
// public.story_recipients / public.announcement_recipients.
// ═══════════════════════════════════════════════════

const PRIV_MAX_RECIPIENTS = 200;
const PRIV_SHOW_MAX = 15;
const PRIV_PROMPT =
  "👥 Who should see it?\n\n" +
  "Send the Telegram ID(s) or @username(s) of the accounts.\n" +
  "You can send several, separated by spaces, commas or new lines.\n\n" +
  "Example:\n138753984 @s5cius\n\n" +
  "ℹ️ A @username is found only if that person opened the Mini App once. Otherwise send their numeric ID.";

type ParsedRecipients = { ids: number[]; usernames: string[]; invalid: string[] };
type ResolvedRecipients = {
  ids: number[];
  labels: Record<string, string>;
  unresolved: string[];
  invalid: string[];
  tooMany: boolean;
};

function parseRecipientTokens(raw: string): ParsedRecipients {
  const ids = new Set<number>();
  const usernames = new Map<string, string>();
  const invalid: string[] = [];
  for (const piece of raw.split(/[\s,;،]+/)) {
    let tok = piece.trim().replace(/^<+|>+$/g, "");
    if (!tok) continue;
    const link = tok.match(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z][A-Za-z0-9_]{2,31})\/?$/i);
    if (link) tok = "@" + link[1];
    if (/^\d{1,13}$/.test(tok)) {
      const n = Number(tok);
      if (Number.isSafeInteger(n) && n > 0) ids.add(n);
      else invalid.push(tok);
      continue;
    }
    const m = tok.match(/^@?([A-Za-z][A-Za-z0-9_]{2,31})$/);
    if (m) {
      usernames.set(m[1]!.toLowerCase(), m[1]!);
      continue;
    }
    invalid.push(tok);
  }
  return { ids: [...ids], usernames: [...usernames.values()], invalid };
}

function userLabel(u: any): string {
  const name = [u.first_name].filter(Boolean).join(" ").trim();
  const handle = u.username ? `@${String(u.username).replace(/^@/, "")}` : "";
  return [name, handle && (name ? `(${handle})` : handle)].filter(Boolean).join(" ");
}

async function resolveRecipients(raw: string): Promise<ResolvedRecipients> {
  const p = parseRecipientTokens(raw);
  const ids = new Set<number>(p.ids);
  const labels: Record<string, string> = {};
  const unresolved: string[] = [];

  if (p.usernames.length) {
    // ilike can widen on "_" so the exact (case-insensitive) match is enforced below.
    const { data } = await supabase
      .from("users")
      .select("telegram_id, username, first_name")
      .or(p.usernames.map((n) => `username.ilike.${n}`).join(","));
    const byName = new Map<string, any>();
    (data ?? []).forEach((u: any) => {
      if (u.username) byName.set(String(u.username).toLowerCase(), u);
    });
    for (const name of p.usernames) {
      const u = byName.get(name.toLowerCase());
      if (u) ids.add(Number(u.telegram_id));
      else unresolved.push("@" + name);
    }
  }
  if (ids.size && ids.size <= PRIV_MAX_RECIPIENTS) {
    const { data } = await supabase
      .from("users")
      .select("telegram_id, username, first_name")
      .in("telegram_id", [...ids]);
    (data ?? []).forEach((u: any) => {
      labels[String(u.telegram_id)] = userLabel(u);
    });
  }
  return {
    ids: [...ids],
    labels,
    unresolved,
    invalid: p.invalid,
    tooMany: ids.size > PRIV_MAX_RECIPIENTS,
  };
}

function recipientNotes(r: { unresolved: string[]; invalid: string[] }): string {
  let out = "";
  if (r.unresolved.length) {
    out += `\n⚠️ Not found: ${r.unresolved.join(", ")} — they must open the Mini App once, or send their numeric ID.`;
  }
  if (r.invalid.length) {
    out += `\n⚠️ Ignored (invalid): ${r.invalid.slice(0, 10).join(", ")}`;
  }
  return out;
}

function recipientsBlock(ids: number[], labels: Record<string, string>): string {
  const lines = ids.slice(0, PRIV_SHOW_MAX).map((id) => {
    const l = labels[String(id)];
    return l ? `• ${id} — ${l}` : `• ${id} (not in the app yet)`;
  });
  if (ids.length > PRIV_SHOW_MAX) lines.push(`…and ${ids.length - PRIV_SHOW_MAX} more`);
  return `👥 Recipients (${ids.length}):\n${lines.join("\n")}`;
}

function privConfirmKeyboard(confirmData: string, n: number, verb: string) {
  return new InlineKeyboard()
    .text(`✅ ${verb} to ${n} account${n === 1 ? "" : "s"}`, confirmData).row()
    .text("✏️ Change recipients", "priv_change").row()
    .text("❌ Cancel", "cancel");
}

function privateStoryPreview(s: SessionData) {
  const expires = new Date(Date.now() + (s.storyHours ?? 0) * 3600_000);
  const text =
    `🔒 Private story preview:\n\n` +
    `Type: ${s.storyKind === "video" ? "🎬 Video" : "🖼 Image"}\n` +
    `Link: ${s.storyLink ?? "None"}\n` +
    `Duration: ${s.storyHours}h\n` +
    `Ends: ${expires.toISOString().replace("T", " ").slice(0, 16)} UTC\n\n` +
    recipientsBlock(s.privRecipients ?? [], s.privLabels ?? {}) +
    (s.privNotes ?? "");
  return { text, kb: privConfirmKeyboard("psty_confirm", (s.privRecipients ?? []).length, "Publish") };
}

function privateMessagePreview(s: SessionData) {
  const text =
    `🔒 Private message preview:\n\n📌 ${s.title}\n\n${s.msgBody}\n\n` +
    recipientsBlock(s.privRecipients ?? [], s.privLabels ?? {}) +
    (s.privNotes ?? "");
  return { text, kb: privConfirmKeyboard("pmsg_confirm", (s.privRecipients ?? []).length, "Send privately") };
}

const cancelOnlyKeyboard = () => new InlineKeyboard().text("❌ Cancel", "cancel");

// ── commands ───────────────────────────────────────
bot.command(["story_privacy"], async (ctx) => {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = { step: "story_media", storyPrivate: true };
  await ctx.reply(
    `🔒 New Private Story\n\nSend the photo or video (max ${STORY_MAX_MB} MB).\nSupported: JPG, PNG, WEBP, MP4, WEBM, MOV.`,
    { reply_markup: cancelOnlyKeyboard() }
  );
});

bot.command(["massage_privacy", "message_privacy"], async (ctx) => {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = { step: "pmsg_title", privKind: "message" };
  await ctx.reply("🔒 New Private Message\n\nSend the title:", { reply_markup: cancelOnlyKeyboard() });
});

// ── recipients step → preview ──────────────────────
bot.callbackQuery("priv_change", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const s = ctx.session;
  if (s.step === "priv_confirm") s.step = "priv_to";
  else if (s.step === "rcp_confirm") s.step = "rcp_edit";
  else {
    await ctx.editMessageText("❌ Session expired. Start again.");
    return ctx.answerCallbackQuery();
  }
  await ctx.editMessageText(PRIV_PROMPT, { reply_markup: cancelOnlyKeyboard() });
  await ctx.answerCallbackQuery();
});

async function handlePrivateRecipientsText(ctx: any, s: SessionData, text: string) {
  const res = await resolveRecipients(text);
  if (res.tooMany) {
    return ctx.reply(`❌ Too many accounts (max ${PRIV_MAX_RECIPIENTS}). Send a shorter list:`, {
      reply_markup: cancelOnlyKeyboard(),
    });
  }
  if (!res.ids.length) {
    return ctx.reply(
      "❌ No valid account found." + recipientNotes(res) + "\n\nSend Telegram IDs or @usernames again:",
      { reply_markup: cancelOnlyKeyboard() }
    );
  }
  s.privRecipients = res.ids;
  s.privLabels = res.labels;
  s.privNotes = recipientNotes(res);

  if (s.step === "priv_to") {
    s.step = "priv_confirm";
    if (s.privKind === "chatmsg") return sendCmConfirm(ctx, s);
    const p = s.privKind === "story" ? privateStoryPreview(s) : privateMessagePreview(s);
    return ctx.reply(p.text, { reply_markup: p.kb });
  }
  // rcp_edit (edit recipients of an existing private item)
  s.step = "rcp_confirm";
  const verb = s.rcpMode === "add" ? "Add" : "Replace with";
  return ctx.reply(
    `${s.rcpMode === "add" ? "➕ Add these recipients" : "🔁 Replace recipients with"}:\n\n` +
      recipientsBlock(res.ids, res.labels) + (s.privNotes ?? ""),
    { reply_markup: privConfirmKeyboard("prcp_apply", res.ids.length, verb) }
  );
}

// ── publish a private MESSAGE ──────────────────────
bot.callbackQuery("pmsg_confirm", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const s = ctx.session;
  if (
    s.step !== "priv_confirm" || s.privKind !== "message" || !s.title || !s.msgBody ||
    !s.privRecipients?.length
  ) {
    await ctx.editMessageText("❌ Session expired. Use /massage_privacy again.");
    return ctx.answerCallbackQuery();
  }
  const { data: row, error } = await supabase
    .from("announcements")
    .insert({ title: s.title, message: s.msgBody, is_private: true })
    .select("id")
    .single();
  if (error || !row) {
    const p = privateMessagePreview(s);
    await ctx.editMessageText(`❌ Error: ${error?.message ?? "no row"}\n\n${p.text}`, { reply_markup: p.kb });
    return ctx.answerCallbackQuery();
  }
  const { error: rErr } = await supabase
    .from("announcement_recipients")
    .insert(s.privRecipients.map((id) => ({ announcement_id: row.id, telegram_id: id })));
  if (rErr) {
    await supabase.from("announcements").delete().eq("id", row.id);
    const p = privateMessagePreview(s);
    await ctx.editMessageText(`❌ Could not save recipients: ${rErr.message}\n\n${p.text}`, { reply_markup: p.kb });
    return ctx.answerCallbackQuery();
  }
  const n = s.privRecipients.length;
  const title = s.title;
  ctx.session = {};
  await ctx.editMessageText(`✅ Private message sent to ${n} account${n === 1 ? "" : "s"}!\n\n📌 ${title}`);
  await ctx.answerCallbackQuery();
});

// ── edit PRIVATE MESSAGES ──────────────────────────
bot.command(["edit_massage_privacy", "edit_message_privacy"], async (ctx) => {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = {};
  const { data: msgs, error } = await supabase
    .from("announcements")
    .select("id, title, created_at")
    .eq("is_private", true)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return ctx.reply("❌ Error: " + error.message);
  if (!msgs || msgs.length === 0) {
    return ctx.reply("🔒 No private messages yet. Use /massage_privacy to send one.");
  }
  const { data: rc } = await supabase
    .from("announcement_recipients")
    .select("announcement_id")
    .in("announcement_id", msgs.map((m: any) => m.id));
  const counts = new Map<string, number>();
  (rc ?? []).forEach((r: any) => counts.set(r.announcement_id, (counts.get(r.announcement_id) ?? 0) + 1));

  const kb = new InlineKeyboard();
  msgs.forEach((m: any) => {
    const date = new Date(m.created_at).toLocaleDateString("en-GB");
    kb.text(`🔒 ${date} — ${m.title.slice(0, 22)} (${counts.get(m.id) ?? 0})`, `pmsg_pick_${m.id}`).row();
  });
  kb.text("❌ Cancel", "cancel");
  await ctx.reply("✏️ Edit Private Message — choose:", { reply_markup: kb });
});

bot.callbackQuery(/^pmsg_pick_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const id = ctx.match[1]!;
  const { data: m } = await supabase
    .from("announcements").select("id, title, message, created_at").eq("id", id).eq("is_private", true).single();
  if (!m) {
    await ctx.editMessageText("❌ Not found.");
    return ctx.answerCallbackQuery();
  }
  const { count } = await supabase
    .from("announcement_recipients").select("telegram_id", { count: "exact", head: true }).eq("announcement_id", id);
  ctx.session = {};
  const kb = new InlineKeyboard()
    .text("📝 Edit Title", `editmsgfield_${id}_title`).row()
    .text("📄 Edit Message", `editmsgfield_${id}_message`).row()
    .text("👥 Recipients", `prcp_msg_${id}`).row()
    .text("🗑 Delete", `deletemsg_${id}`).row()
    .text("❌ Cancel", "cancel");
  await ctx.editMessageText(
    `🔒 "${m.title}"\n\n${String(m.message).slice(0, 400)}\n\n👥 ${count ?? 0} recipient(s)\n\nWhat to edit?`,
    { reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});

// ── edit PRIVATE STORIES ───────────────────────────
bot.command(["edit_story_privacy"], async (ctx) => {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = {};
  const { data: stories, error } = await supabase
    .from("stories")
    .select("id, media_type, link_url, created_at, expires_at")
    .eq("is_private", true)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return ctx.reply("❌ Error: " + error.message);
  if (!stories || stories.length === 0) {
    return ctx.reply("🔒 No private stories yet. Use /story_privacy to publish one.");
  }
  const { data: rc } = await supabase
    .from("story_recipients")
    .select("story_id")
    .in("story_id", stories.map((st: any) => st.id));
  const counts = new Map<string, number>();
  (rc ?? []).forEach((r: any) => counts.set(r.story_id, (counts.get(r.story_id) ?? 0) + 1));

  const kb = new InlineKeyboard();
  stories.forEach((st: any) => {
    const active = new Date(st.expires_at).getTime() > Date.now();
    const kind = st.media_type === "video" ? "🎬" : "🖼";
    kb.text(`${active ? "🟢" : "⚪️"} ${kind} ${storyTimeLeft(st.expires_at)} (${counts.get(st.id) ?? 0}👥)`, `psty_pick_${st.id}`).row();
  });
  kb.text("❌ Cancel", "cancel");
  await ctx.reply("✏️ Edit Private Story — choose:", { reply_markup: kb });
});

bot.callbackQuery(/^psty_pick_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const id = ctx.match[1]!;
  const { data: st } = await supabase.from("stories").select("*").eq("id", id).eq("is_private", true).single();
  if (!st) {
    await ctx.editMessageText("❌ Story not found.");
    return ctx.answerCallbackQuery();
  }
  const { count } = await supabase
    .from("story_recipients").select("telegram_id", { count: "exact", head: true }).eq("story_id", id);
  ctx.session = {};
  const kb = new InlineKeyboard().text("✏️ Edit link", `sty_link_${id}`).row();
  if (st.link_url) kb.text("❌ Remove link", `sty_unlink_${id}`).row();
  kb.text("👥 Recipients", `prcp_story_${id}`).row()
    .text("🗑 Delete story", `sty_del_${id}`).row()
    .text("❌ Cancel", "cancel");
  await ctx.editMessageText(
    `🔒 Private story\n\n` +
    `Type: ${st.media_type === "video" ? "🎬 Video" : "🖼 Image"}\n` +
    `Link: ${st.link_url ?? "None"}\n` +
    `Duration: ${st.duration_hours}h\n` +
    `Status: ${storyTimeLeft(st.expires_at)}\n` +
    `👥 ${count ?? 0} recipient(s)`,
    { reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});

// ── recipients of an existing private item ─────────
function recipientTable(kind: string) {
  return kind === "story"
    ? { table: "story_recipients", col: "story_id", parent: "stories", back: "psty_pick_" }
    : { table: "announcement_recipients", col: "announcement_id", parent: "announcements", back: "pmsg_pick_" };
}

bot.callbackQuery(/^prcp_(story|msg)_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const kind = ctx.match[1]!;
  const id = ctx.match[2]!;
  const t = recipientTable(kind);
  const { data: rows, error } = await supabase.from(t.table).select("telegram_id").eq(t.col, id);
  if (error) {
    await ctx.editMessageText("❌ Error: " + error.message);
    return ctx.answerCallbackQuery();
  }
  const ids = (rows ?? []).map((r: any) => Number(r.telegram_id));
  const labels: Record<string, string> = {};
  if (ids.length) {
    const { data: users } = await supabase
      .from("users").select("telegram_id, username, first_name").in("telegram_id", ids.slice(0, 200));
    (users ?? []).forEach((u: any) => { labels[String(u.telegram_id)] = userLabel(u); });
  }
  ctx.session = {};
  const kb = new InlineKeyboard()
    .text("🔁 Replace list", `prcpset_${kind}_${id}`).row()
    .text("➕ Add accounts", `prcpadd_${kind}_${id}`).row()
    .text("🔙 Back", `${t.back}${id}`).row()
    .text("❌ Cancel", "cancel");
  await ctx.editMessageText(
    ids.length ? recipientsBlock(ids, labels) : "👥 No recipients (nobody can see it).",
    { reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^prcp(set|add)_(story|msg)_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = {
    step: "rcp_edit",
    rcpMode: ctx.match[1] === "add" ? "add" : "set",
    rcpKind: ctx.match[2] === "story" ? "story" : "message",
    rcpId: ctx.match[3]!,
  };
  await ctx.editMessageText(PRIV_PROMPT, { reply_markup: cancelOnlyKeyboard() });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("prcp_apply", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const s = ctx.session;
  if (s.step !== "rcp_confirm" || !s.rcpKind || !s.rcpId || !s.rcpMode || !s.privRecipients?.length) {
    await ctx.editMessageText("❌ Session expired. Start again.");
    return ctx.answerCallbackQuery();
  }
  const t = recipientTable(s.rcpKind === "story" ? "story" : "msg");
  // The item must still exist and still be private.
  const { data: parent } = await supabase.from(t.parent).select("id").eq("id", s.rcpId).eq("is_private", true).single();
  if (!parent) {
    ctx.session = {};
    await ctx.editMessageText("❌ That private item no longer exists.");
    return ctx.answerCallbackQuery();
  }
  const rows = s.privRecipients.map((id) => ({ [t.col]: s.rcpId, telegram_id: id }));
  const up = await supabase.from(t.table).upsert(rows, { onConflict: `${t.col},telegram_id`, ignoreDuplicates: true });
  if (up.error) {
    await ctx.editMessageText("❌ Error: " + up.error.message);
    return ctx.answerCallbackQuery();
  }
  if (s.rcpMode === "set") {
    const del = await supabase.from(t.table).delete().eq(t.col, s.rcpId)
      .not("telegram_id", "in", `(${s.privRecipients.join(",")})`);
    if (del.error) {
      await ctx.editMessageText("❌ Error: " + del.error.message);
      return ctx.answerCallbackQuery();
    }
  }
  const { count } = await supabase.from(t.table).select("telegram_id", { count: "exact", head: true }).eq(t.col, s.rcpId);
  ctx.session = {};
  await ctx.editMessageText(`✅ Recipients updated — ${count ?? 0} account(s) can see it.`);
  await ctx.answerCallbackQuery();
});

// ═══════════════════════════════════════════════════
// 💬 CHAT MESSAGES — messages the BOT itself sends into users' Telegram chats
// /chat_massage, /edit_chat_massage, /chat_massage_privacy, /edit_chat_massage_privacy
// Content = text OR photo/video/GIF (+caption), with formatting + links replayed exactly
// as typed, and optional URL buttons. Every delivery is stored so it can be edited,
// deleted, resumed after a restart, or extended to more accounts.
// ═══════════════════════════════════════════════════

type CmButton = { text: string; url: string };
type CmKind = "text" | "photo" | "video" | "animation";
type CmRow = {
  kind: CmKind;
  media_file_id: string | null;
  body: string | null;
  entities: any[];
  buttons: CmButton[];
};

const CM_MAX_TEXT = 4096;
const CM_MAX_CAPTION = 1024;
const CM_MAX_BUTTONS = 4;
const CM_LABEL_MAX = 40;
const MINI_APP_LINK = process.env.MINI_APP_LINK ?? "https://t.me/AZOX_Airdrop_bot/AZOX_Airdrop";
// Telegram allows ~30 messages/second for a bot; 50 ms between sends = 20/s with headroom.
const CM_SEND_DELAY_MS = Number(process.env.CHAT_SEND_DELAY_MS ?? 50);
const CM_ALLOWED_ENTITIES = new Set([
  "bold", "italic", "underline", "strikethrough", "spoiler", "code", "pre", "text_link", "url",
  "blockquote", "expandable_blockquote", "mention", "hashtag", "cashtag", "bot_command", "email", "phone_number",
]);

const CM_CONTENT_PROMPT =
  "Send the message now:\n" +
  "• Text (format it and add links as you like), or\n" +
  "• a Photo / Video / GIF with an optional caption.\n\n" +
  `Limits: text ${CM_MAX_TEXT} characters, caption ${CM_MAX_CAPTION}.`;
const CM_BUTTONS_PROMPT =
  "🔗 Buttons (optional)\n\n" +
  `Send up to ${CM_MAX_BUTTONS} buttons, one per line:\nLabel | https://link\n\n` +
  "To open the Mini App use:\nOpen App | app\n\nOr tap Skip.";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

function cleanEntities(entities: any[] | undefined): any[] {
  return (entities ?? []).filter((e) => e && CM_ALLOWED_ENTITIES.has(e.type));
}

function parseButtons(raw: string): { buttons: CmButton[]; errors: string[] } {
  const buttons: CmButton[] = [];
  const errors: string[] = [];
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > CM_MAX_BUTTONS) errors.push(`Maximum ${CM_MAX_BUTTONS} buttons.`);
  for (const line of lines.slice(0, CM_MAX_BUTTONS)) {
    const i = line.indexOf("|");
    if (i < 1) { errors.push(`"${line.slice(0, 40)}" → use: Label | https://link`); continue; }
    const label = line.slice(0, i).trim();
    let target = line.slice(i + 1).trim();
    if (target.toLowerCase() === "app") target = MINI_APP_LINK;
    if (!label || label.length > CM_LABEL_MAX) { errors.push(`"${label.slice(0, 20)}" → label must be 1–${CM_LABEL_MAX} characters`); continue; }
    if (!/^https:\/\/\S+$/i.test(target) || target.length > 2048) { errors.push(`"${label}" → the link must start with https://`); continue; }
    buttons.push({ text: label, url: target });
  }
  return { buttons, errors };
}

function cmMarkup(buttons: CmButton[] | null | undefined): any {
  if (!buttons?.length) return undefined;
  return { inline_keyboard: buttons.map((b) => [{ text: b.text, url: b.url }]) };
}

function tgErr(e: any) {
  return {
    code: e?.error_code as number | undefined,
    desc: String(e?.description ?? e?.message ?? e).slice(0, 200),
    retry: e?.parameters?.retry_after as number | undefined,
  };
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      const t = tgErr(e);
      if (attempt < 3 && (t.code === 429 || e?.name === "HttpError")) {
        await sleep((t.retry ?? 1) * 1000 + (t.retry ? 250 : 0));
        continue;
      }
      throw e;
    }
  }
}

function sendCampaignMessage(chatId: number, row: CmRow): Promise<any> {
  const reply_markup = cmMarkup(row.buttons);
  const entities = row.entities?.length ? row.entities : undefined;
  if (row.kind === "text") {
    return bot.api.sendMessage(chatId, row.body ?? "", { entities, reply_markup } as any);
  }
  const opts: any = { caption: row.body || undefined, caption_entities: entities, reply_markup };
  if (row.kind === "photo") return bot.api.sendPhoto(chatId, row.media_file_id!, opts);
  if (row.kind === "video") return bot.api.sendVideo(chatId, row.media_file_id!, opts);
  return bot.api.sendAnimation(chatId, row.media_file_id!, opts);
}

function sessionRow(s: SessionData): CmRow {
  return {
    kind: s.cmKind!,
    media_file_id: s.cmFileId ?? null,
    body: s.cmText ?? null,
    entities: s.cmEntities ?? [],
    buttons: s.cmButtons ?? [],
  };
}

async function allUserIds(): Promise<number[]> {
  const ids: number[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("users")
      .select("telegram_id")
      .gt("telegram_id", 0)
      .order("telegram_id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    (data ?? []).forEach((u: any) => ids.push(Number(u.telegram_id)));
    if (!data || data.length < 1000) break;
  }
  return ids;
}

// One heavy job at a time (keeps the whole bot under Telegram's global rate limit).
let cmQueue: Promise<void> = Promise.resolve();
function enqueueCm(task: () => Promise<void>): Promise<void> {
  cmQueue = cmQueue.then(task).catch((e) => console.error("[chat-message job]", e));
  return cmQueue;
}

async function safeNotify(chatId: number, text: string, edit?: number) {
  try {
    if (edit) await bot.api.editMessageText(chatId, edit, text);
    else await bot.api.sendMessage(chatId, text);
  } catch { /* progress/notice only */ }
}

type Notify = { chatId: number; messageId?: number };

async function countStatus(id: string, status: string): Promise<number> {
  const { count } = await supabase
    .from("chat_message_deliveries")
    .select("telegram_id", { count: "exact", head: true })
    .eq("chat_message_id", id)
    .eq("status", status);
  return count ?? 0;
}

// Sends every PENDING delivery of a campaign (also used to resume after a restart).
async function runSendCampaign(id: string, notify?: Notify): Promise<void> {
  const { data: row } = await supabase.from("chat_messages").select("*").eq("id", id).single();
  if (!row || row.status !== "sending") return;
  const seen = new Set<number>(); // never retry a user in this run, even if the DB write fails
  let done = 0;
  let lastEdit = 0;
  const total = Number(row.total_count) || 0;

  for (;;) {
    const { data: batch } = await supabase
      .from("chat_message_deliveries")
      .select("telegram_id")
      .eq("chat_message_id", id)
      .eq("status", "pending")
      .order("telegram_id", { ascending: true })
      .limit(50);
    const fresh = (batch ?? []).filter((d: any) => !seen.has(Number(d.telegram_id)));
    if (!fresh.length) break;
    for (const d of fresh) {
      const uid = Number(d.telegram_id);
      seen.add(uid);
      let upd: Record<string, unknown>;
      try {
        const msg = await withRetry(() => sendCampaignMessage(uid, row as CmRow));
        upd = { status: "sent", message_id: msg.message_id, error: null };
      } catch (e) {
        const t = tgErr(e);
        upd = { status: t.code === 403 ? "blocked" : "failed", error: t.desc };
      }
      const { error: uErr } = await supabase
        .from("chat_message_deliveries")
        .update({ ...upd, updated_at: nowIso() })
        .eq("chat_message_id", id)
        .eq("telegram_id", uid);
      if (uErr) console.error("[chat-message] could not record delivery", uid, uErr.message);
      done++;
      if (notify?.messageId && Date.now() - lastEdit > 4000) {
        lastEdit = Date.now();
        await safeNotify(notify.chatId, `📤 Sending… ${done}/${total}`, notify.messageId);
      }
      await sleep(CM_SEND_DELAY_MS);
    }
  }

  const sent = await countStatus(id, "sent");
  const blocked = await countStatus(id, "blocked");
  const failed = await countStatus(id, "failed");
  await supabase
    .from("chat_messages")
    .update({ status: "sent", sent_count: sent, blocked_count: blocked, failed_count: failed })
    .eq("id", id);
  if (notify) {
    const text =
      `✅ Chat message delivered\n\n📨 Sent: ${sent}\n🚫 Not reachable: ${blocked}` +
      `\n⚠️ Failed: ${failed}\n👥 Total: ${total}\n\n` +
      "ℹ️ \"Not reachable\" = the user never started the bot or blocked it.";
    if (notify.messageId) await safeNotify(notify.chatId, `📤 Done ${total}/${total}`, notify.messageId);
    await safeNotify(notify.chatId, text);
  }
}

async function resumeCampaigns(): Promise<void> {
  const { data } = await supabase.from("chat_messages").select("id").eq("status", "sending");
  for (const c of data ?? []) {
    console.log("[chat-message] resuming campaign", c.id);
    void enqueueCm(() => runSendCampaign(c.id));
  }
}

function applyEdit(mode: "text" | "buttons" | "delete", chatId: number, messageId: number, row: any): Promise<any> {
  if (mode === "delete") return bot.api.deleteMessage(chatId, messageId);
  const reply_markup = cmMarkup(row.buttons) ?? { inline_keyboard: [] };
  const entities = row.entities?.length ? row.entities : undefined;
  if (mode === "buttons") return bot.api.editMessageReplyMarkup(chatId, messageId, { reply_markup } as any);
  if (row.kind === "text") return bot.api.editMessageText(chatId, messageId, row.body ?? "", { entities, reply_markup } as any);
  return bot.api.editMessageCaption(chatId, messageId, { caption: row.body ?? "", caption_entities: entities, reply_markup } as any);
}

// Edits / deletes the message in every chat where it was delivered.
async function runEditCampaign(id: string, mode: "text" | "buttons" | "delete", notify?: Notify): Promise<void> {
  const { data: row } = await supabase.from("chat_messages").select("*").eq("id", id).single();
  if (!row) return;
  let ok = 0;
  let failed = 0;
  let last = 0;
  for (;;) {
    const { data: page } = await supabase
      .from("chat_message_deliveries")
      .select("telegram_id, message_id")
      .eq("chat_message_id", id)
      .eq("status", "sent")
      .gt("telegram_id", last)
      .order("telegram_id", { ascending: true })
      .limit(100);
    if (!page?.length) break;
    for (const d of page) {
      const uid = Number(d.telegram_id);
      last = uid;
      try {
        await withRetry(() => applyEdit(mode, uid, Number(d.message_id), row));
        ok++;
        if (mode === "delete") {
          await supabase.from("chat_message_deliveries").update({ status: "deleted", updated_at: nowIso() })
            .eq("chat_message_id", id).eq("telegram_id", uid);
        }
      } catch (e) {
        if (/message is not modified/i.test(tgErr(e).desc)) ok++;
        else failed++;
      }
      await sleep(CM_SEND_DELAY_MS);
    }
  }
  if (mode === "delete") await supabase.from("chat_messages").update({ status: "deleted", deleted_at: nowIso() }).eq("id", id);
  if (notify) {
    const label = mode === "delete" ? "deleted" : "updated";
    await safeNotify(
      notify.chatId,
      `✅ Chat message ${label} in ${ok} chat(s)` + (failed ? `\n⚠️ ${failed} could not be ${label}` + (mode === "delete" ? " (Telegram only allows deleting messages younger than 48 hours)" : "") : "")
    );
  }
}

async function createCampaign(s: SessionData, isPrivate: boolean, recipients: number[]): Promise<{ id: string; total: number }> {
  const { data: row, error } = await supabase
    .from("chat_messages")
    .insert({
      kind: s.cmKind,
      media_file_id: s.cmFileId ?? null,
      body: s.cmText ?? null,
      entities: s.cmEntities ?? [],
      buttons: s.cmButtons ?? [],
      is_private: isPrivate,
      status: "sending",
      created_by: ADMIN_ID,
      total_count: recipients.length,
    })
    .select("id")
    .single();
  if (error || !row) throw new Error(error?.message ?? "could not create the message");
  for (let i = 0; i < recipients.length; i += 500) {
    const chunk = recipients.slice(i, i + 500).map((uid) => ({ chat_message_id: row.id, telegram_id: uid }));
    const { error: dErr } = await supabase.from("chat_message_deliveries").insert(chunk);
    if (dErr) {
      await supabase.from("chat_messages").delete().eq("id", row.id);
      throw new Error(dErr.message);
    }
  }
  return { id: row.id as string, total: recipients.length };
}

// ── composing a new chat message ───────────────────
async function startChatCompose(ctx: any, isPrivate: boolean) {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = { step: "cm_content", cmPrivate: isPrivate };
  await ctx.reply(
    (isPrivate ? "🔒 New Private Chat Message (only the accounts you choose)\n\n" : "💬 New Chat Message (to ALL users)\n\n") + CM_CONTENT_PROMPT,
    { reply_markup: cancelOnlyKeyboard() }
  );
}
bot.command(["chat_massage", "chat_message"], (ctx) => startChatCompose(ctx, false));
bot.command(["chat_massage_privacy", "chat_message_privacy"], (ctx) => startChatCompose(ctx, true));

async function askButtons(ctx: any, s: SessionData) {
  s.step = "cm_buttons";
  const kb = new InlineKeyboard().text("⏭ Skip (no buttons)", "cm_skip_buttons").row().text("❌ Cancel", "cancel");
  await ctx.reply(CM_BUTTONS_PROMPT, { reply_markup: kb });
}

async function handleChatTextContent(ctx: any, s: SessionData) {
  const raw: string = ctx.message.text; // raw (not trimmed): entity offsets must stay valid
  if (raw.length > CM_MAX_TEXT) {
    return ctx.reply(`❌ Too long (${raw.length}/${CM_MAX_TEXT}). Send a shorter text:`, { reply_markup: cancelOnlyKeyboard() });
  }
  s.cmKind = "text";
  s.cmText = raw;
  s.cmEntities = cleanEntities(ctx.message.entities);
  s.cmFileId = undefined;
  return askButtons(ctx, s);
}

async function handleChatMediaContent(ctx: any, s: SessionData) {
  const m: any = ctx.message;
  let kind: CmKind | null = null;
  let fileId: string | undefined;
  if (m.photo?.length) { kind = "photo"; fileId = m.photo[m.photo.length - 1].file_id; }
  else if (m.video) { kind = "video"; fileId = m.video.file_id; }
  else if (m.animation) { kind = "animation"; fileId = m.animation.file_id; }
  if (!kind || !fileId) {
    return ctx.reply("❌ Send a photo, a video, a GIF, or plain text.", { reply_markup: cancelOnlyKeyboard() });
  }
  const caption: string = m.caption ?? "";
  if (caption.length > CM_MAX_CAPTION) {
    return ctx.reply(`❌ Caption too long (${caption.length}/${CM_MAX_CAPTION}). Send it again with a shorter caption:`, { reply_markup: cancelOnlyKeyboard() });
  }
  s.cmKind = kind;
  s.cmFileId = fileId;
  s.cmText = caption || undefined;
  s.cmEntities = cleanEntities(m.caption_entities);
  return askButtons(ctx, s);
}

async function afterButtons(ctx: any, s: SessionData) {
  if (s.cmPrivate) {
    s.step = "priv_to";
    s.privKind = "chatmsg";
    return ctx.reply(PRIV_PROMPT, { reply_markup: cancelOnlyKeyboard() });
  }
  return sendCmConfirm(ctx, s);
}

async function handleChatButtonsText(ctx: any, s: SessionData) {
  const { buttons, errors } = parseButtons(ctx.message.text);
  if (errors.length) {
    return ctx.reply("❌ " + errors.join("\n❌ ") + "\n\nSend the buttons again, or tap Skip:", {
      reply_markup: new InlineKeyboard().text("⏭ Skip (no buttons)", "cm_skip_buttons").row().text("❌ Cancel", "cancel"),
    });
  }
  s.cmButtons = buttons;
  return afterButtons(ctx, s);
}

bot.callbackQuery("cm_skip_buttons", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const s = ctx.session;
  if (s.step !== "cm_buttons") {
    await ctx.editMessageText("❌ Session expired. Start again.");
    return ctx.answerCallbackQuery();
  }
  s.cmButtons = [];
  await ctx.answerCallbackQuery();
  await afterButtons(ctx, s);
});

// The preview IS the real message, sent to the admin exactly as users will receive it.
async function sendCmConfirm(ctx: any, s: SessionData) {
  const isPrivate = !!s.cmPrivate;
  try {
    await sendCampaignMessage(ctx.chat.id, sessionRow(s));
  } catch (e) {
    const t = tgErr(e);
    s.step = "cm_content";
    s.cmKind = undefined; s.cmText = undefined; s.cmFileId = undefined; s.cmEntities = undefined; s.cmButtons = undefined;
    return ctx.reply(`❌ Telegram rejected this message: ${t.desc}\n\nSend the message again:`, { reply_markup: cancelOnlyKeyboard() });
  }
  let n: number;
  try {
    n = isPrivate ? (s.privRecipients ?? []).length : (await allUserIds()).length;
  } catch (e: any) {
    return ctx.reply("❌ Could not read the users: " + e.message);
  }
  if (!n) return ctx.reply("❌ There are no users to send to.");
  s.step = isPrivate ? "priv_confirm" : "cm_confirm";
  const kb = new InlineKeyboard().text(`✅ Send to ${n} account${n === 1 ? "" : "s"}`, "cm_send").row();
  if (isPrivate) kb.text("✏️ Change recipients", "priv_change").row();
  kb.text("❌ Cancel", "cancel");
  await ctx.reply(
    "👆 This is exactly what " + (isPrivate ? "the chosen accounts" : "every user") + " will receive." +
      (isPrivate ? "\n\n" + recipientsBlock(s.privRecipients ?? [], s.privLabels ?? {}) + (s.privNotes ?? "") : `\n\n👥 ${n} users`) +
      "\n\nℹ️ Only users who started the bot can receive it; the rest are reported as not reachable.",
    { reply_markup: kb }
  );
}

bot.callbackQuery("cm_send", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const s = ctx.session;
  const isPrivate = !!s.cmPrivate;
  const okStep = isPrivate ? "priv_confirm" : "cm_confirm";
  if (s.step !== okStep || !s.cmKind || (isPrivate && (s.privKind !== "chatmsg" || !s.privRecipients?.length))) {
    await ctx.editMessageText("❌ Session expired. Start again.");
    return ctx.answerCallbackQuery();
  }
  let recipients: number[];
  try {
    recipients = isPrivate ? s.privRecipients! : await allUserIds();
  } catch (e: any) {
    await ctx.editMessageText("❌ Could not read the users: " + e.message);
    return ctx.answerCallbackQuery();
  }
  if (!recipients.length) {
    await ctx.editMessageText("❌ There are no users to send to.");
    return ctx.answerCallbackQuery();
  }
  let created: { id: string; total: number };
  try {
    created = await createCampaign(s, isPrivate, recipients);
  } catch (e: any) {
    await ctx.editMessageText("❌ Could not start: " + e.message);
    return ctx.answerCallbackQuery();
  }
  const chatId = ctx.chat!.id;
  const mid = ctx.callbackQuery.message?.message_id;
  ctx.session = {};
  await ctx.editMessageText(`📤 Sending to ${created.total} account${created.total === 1 ? "" : "s"}…`);
  await ctx.answerCallbackQuery({ text: "Sending…" });
  void enqueueCm(() => runSendCampaign(created.id, { chatId, messageId: mid }));
});

// ── editing sent chat messages ─────────────────────
async function listCampaigns(ctx: any, isPrivate: boolean) {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = {};
  const { data: rows, error } = await supabase
    .from("chat_messages")
    .select("id, kind, body, created_at, status, total_count, sent_count")
    .eq("is_private", isPrivate)
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return ctx.reply("❌ Error: " + error.message);
  if (!rows || rows.length === 0) {
    return ctx.reply(isPrivate ? "🔒 No private chat messages yet. Use /chat_massage_privacy." : "💬 No chat messages yet. Use /chat_massage.");
  }
  const icon: Record<string, string> = { text: "💬", photo: "🖼", video: "🎬", animation: "🎞" };
  const kb = new InlineKeyboard();
  rows.forEach((r: any) => {
    const date = new Date(r.created_at).toLocaleDateString("en-GB");
    const label = String(r.body ?? `(${r.kind})`).replace(/\s+/g, " ").slice(0, 18);
    kb.text(`${icon[r.kind] ?? "💬"} ${date} — ${label} (${r.sent_count}/${r.total_count})`, `cmpick_${r.id}`).row();
  });
  kb.text("❌ Cancel", "cancel");
  await ctx.reply(isPrivate ? "✏️ Edit Private Chat Message — choose:" : "✏️ Edit Chat Message — choose:", { reply_markup: kb });
}
bot.command(["edit_chat_massage", "edit_chat_message"], (ctx) => listCampaigns(ctx, false));
bot.command(["edit_chat_massage_privacy", "edit_chat_message_privacy"], (ctx) => listCampaigns(ctx, true));

bot.callbackQuery(/^cmpick_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const id = ctx.match[1]!;
  const { data: r } = await supabase.from("chat_messages").select("*").eq("id", id).single();
  if (!r || r.status === "deleted") {
    await ctx.editMessageText("❌ Not found.");
    return ctx.answerCallbackQuery();
  }
  ctx.session = {};
  const btns = (r.buttons ?? []).map((b: CmButton) => `• ${b.text} → ${b.url}`).join("\n") || "None";
  const kb = new InlineKeyboard()
    .text("✏️ Edit text", `cmedtext_${id}`).row()
    .text("🔗 Edit buttons", `cmedbtn_${id}`).row();
  if (r.is_private) kb.text("➕ Send to more accounts", `cmmore_${id}`).row();
  kb.text("🗑 Delete for everyone", `cmdel_${id}`).row().text("❌ Cancel", "cancel");
  await ctx.editMessageText(
    `${r.is_private ? "🔒" : "💬"} Chat message (${r.kind})\n\n${String(r.body ?? "(no text)").slice(0, 300)}\n\n` +
      `Buttons:\n${btns}\n\n📨 ${r.sent_count}/${r.total_count} delivered · 🚫 ${r.blocked_count} not reachable · ⚠️ ${r.failed_count} failed` +
      (r.status === "sending" ? "\n⏳ Still sending…" : ""),
    { reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^cmedtext_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "cm_edit_text", cmEditId: ctx.match[1]! };
  await ctx.editMessageText("✏️ Send the new text (or caption). It replaces the old one in every chat.\nFormatting and links are kept.", { reply_markup: cancelOnlyKeyboard() });
  await ctx.answerCallbackQuery();
});
bot.callbackQuery(/^cmedbtn_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "cm_edit_buttons", cmEditId: ctx.match[1]! };
  await ctx.editMessageText("🔗 Send the new buttons, one per line:\nLabel | https://link\n(Open the Mini App with: Open App | app)\n\nSend none to remove all buttons.", { reply_markup: cancelOnlyKeyboard() });
  await ctx.answerCallbackQuery();
});

async function handleChatEditText(ctx: any, s: SessionData) {
  const id = s.cmEditId!;
  const raw: string = ctx.message.text;
  const { data: r } = await supabase.from("chat_messages").select("kind, status").eq("id", id).single();
  if (!r || r.status === "deleted") { ctx.session = {}; return ctx.reply("❌ Not found."); }
  const max = r.kind === "text" ? CM_MAX_TEXT : CM_MAX_CAPTION;
  if (raw.length > max) return ctx.reply(`❌ Too long (${raw.length}/${max}). Send a shorter text:`, { reply_markup: cancelOnlyKeyboard() });
  const { error } = await supabase.from("chat_messages").update({ body: raw, entities: cleanEntities(ctx.message.entities) }).eq("id", id);
  ctx.session = {};
  if (error) return ctx.reply("❌ Error: " + error.message);
  const chatId = ctx.chat.id;
  await ctx.reply("✏️ Updating the message in every chat…");
  void enqueueCm(() => runEditCampaign(id, "text", { chatId }));
}

async function handleChatEditButtons(ctx: any, s: SessionData) {
  const id = s.cmEditId!;
  const raw: string = ctx.message.text.trim();
  let buttons: CmButton[] = [];
  if (!/^(none|no|remove)$/i.test(raw)) {
    const p = parseButtons(raw);
    if (p.errors.length) return ctx.reply("❌ " + p.errors.join("\n❌ ") + "\n\nSend the buttons again, or send none:", { reply_markup: cancelOnlyKeyboard() });
    buttons = p.buttons;
  }
  const { data: r } = await supabase.from("chat_messages").select("status").eq("id", id).single();
  if (!r || r.status === "deleted") { ctx.session = {}; return ctx.reply("❌ Not found."); }
  const { error } = await supabase.from("chat_messages").update({ buttons }).eq("id", id);
  ctx.session = {};
  if (error) return ctx.reply("❌ Error: " + error.message);
  const chatId = ctx.chat.id;
  await ctx.reply(buttons.length ? "🔗 Updating the buttons in every chat…" : "🔗 Removing the buttons from every chat…");
  void enqueueCm(() => runEditCampaign(id, "buttons", { chatId }));
}

bot.callbackQuery(/^cmdel_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const id = ctx.match[1]!;
  const kb = new InlineKeyboard().text("🗑 YES — Delete for everyone", `cmdelyes_${id}`).row().text("❌ Cancel", "cancel");
  await ctx.editMessageText(
    "⚠️ Delete this message from every user's chat?\n\nTelegram only lets a bot delete messages younger than 48 hours; older ones stay in the chat. This CANNOT be undone.",
    { reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});
bot.callbackQuery(/^cmdelyes_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const id = ctx.match[1]!;
  const { data: r } = await supabase.from("chat_messages").select("status").eq("id", id).single();
  if (!r || r.status === "deleted") {
    await ctx.editMessageText("❌ Not found.");
    return ctx.answerCallbackQuery();
  }
  const chatId = ctx.chat!.id;
  ctx.session = {};
  await ctx.editMessageText("🗑 Deleting from every chat…");
  await ctx.answerCallbackQuery();
  void enqueueCm(() => runEditCampaign(id, "delete", { chatId }));
});

// private campaigns: send the same message to more accounts later
bot.callbackQuery(/^cmmore_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "cm_more", cmEditId: ctx.match[1]! };
  await ctx.editMessageText(PRIV_PROMPT, { reply_markup: cancelOnlyKeyboard() });
  await ctx.answerCallbackQuery();
});

async function handleChatMoreRecipients(ctx: any, s: SessionData, text: string) {
  const res = await resolveRecipients(text);
  if (res.tooMany) return ctx.reply(`❌ Too many accounts (max ${PRIV_MAX_RECIPIENTS}).`, { reply_markup: cancelOnlyKeyboard() });
  if (!res.ids.length) {
    return ctx.reply("❌ No valid account found." + recipientNotes(res) + "\n\nSend Telegram IDs or @usernames again:", { reply_markup: cancelOnlyKeyboard() });
  }
  s.privRecipients = res.ids;
  s.privLabels = res.labels;
  s.privNotes = recipientNotes(res);
  s.step = "cm_more_confirm";
  const kb = new InlineKeyboard()
    .text(`✅ Send to ${res.ids.length} more`, "cm_more_apply").row()
    .text("❌ Cancel", "cancel");
  await ctx.reply("➕ Send this message also to:\n\n" + recipientsBlock(res.ids, res.labels) + (s.privNotes ?? "") +
    "\n\nAccounts that already received it are skipped.", { reply_markup: kb });
}

bot.callbackQuery("cm_more_apply", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const s = ctx.session;
  if (s.step !== "cm_more_confirm" || !s.cmEditId || !s.privRecipients?.length) {
    await ctx.editMessageText("❌ Session expired. Start again.");
    return ctx.answerCallbackQuery();
  }
  const id = s.cmEditId;
  const { data: parent } = await supabase.from("chat_messages").select("id, status, total_count").eq("id", id).eq("is_private", true).single();
  if (!parent || parent.status === "deleted") {
    ctx.session = {};
    await ctx.editMessageText("❌ That private message no longer exists.");
    return ctx.answerCallbackQuery();
  }
  // upsert + ignoreDuplicates: existing deliveries (already sent) are untouched
  const rows = s.privRecipients.map((uid) => ({ chat_message_id: id, telegram_id: uid }));
  const up = await supabase.from("chat_message_deliveries").upsert(rows, { onConflict: "chat_message_id,telegram_id", ignoreDuplicates: true });
  if (up.error) {
    await ctx.editMessageText("❌ Error: " + up.error.message);
    return ctx.answerCallbackQuery();
  }
  const { count } = await supabase.from("chat_message_deliveries").select("telegram_id", { count: "exact", head: true }).eq("chat_message_id", id);
  await supabase.from("chat_messages").update({ status: "sending", total_count: count ?? parent.total_count }).eq("id", id);
  const chatId = ctx.chat!.id;
  const mid = ctx.callbackQuery.message?.message_id;
  ctx.session = {};
  await ctx.editMessageText("📤 Sending to the new accounts…");
  await ctx.answerCallbackQuery({ text: "Sending…" });
  void enqueueCm(() => runSendCampaign(id, { chatId, messageId: mid }));
});

// ═══════════════════════════════════════════════════
// 🚫 /ban — block accounts from the Mini App
// ═══════════════════════════════════════════════════
const BAN_LIST_MAX = 20;

function banMenuKeyboard() {
  return new InlineKeyboard()
    .text("🚫 Ban accounts", "ban_start").row()
    .text("📋 Banned list", "ban_list").row()
    .text("❌ Cancel", "cancel");
}

const BAN_MENU_TEXT =
  "🚫 Ban\n\nA banned account cannot use the Mini App at all.\nYou can unban from the banned list.";

const BAN_PROMPT =
  "🚫 Which accounts do you want to ban?\n\n" +
  "Send the Telegram ID(s) or @username(s), separated by spaces, commas or new lines.\n\n" +
  "Example:\n138753984 @username";

bot.command("ban", async (ctx) => {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = {};
  await ctx.reply(BAN_MENU_TEXT, { reply_markup: banMenuKeyboard() });
});

bot.callbackQuery("ban_start", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "ban_to" };
  await ctx.editMessageText(BAN_PROMPT, { reply_markup: cancelOnlyKeyboard() });
  await ctx.answerCallbackQuery();
});

async function handleBanText(ctx: any, s: SessionData, text: string) {
  const r = await resolveRecipients(text);
  if (r.tooMany) {
    return ctx.reply(`❌ Too many accounts (max ${PRIV_MAX_RECIPIENTS}). Send fewer:`, { reply_markup: cancelOnlyKeyboard() });
  }
  let selfSkipped = false;
  const ids = r.ids.filter((id) => {
    if (id === ADMIN_ID) { selfSkipped = true; return false; }
    return true;
  });
  const notes = recipientNotes(r) + (selfSkipped ? "\n⚠️ Your own account was skipped — you cannot ban yourself." : "");
  if (!ids.length) {
    return ctx.reply("❌ No valid account found." + notes + "\n\nSend again:", { reply_markup: cancelOnlyKeyboard() });
  }
  s.banIds = ids;
  s.banLabels = r.labels;
  s.step = "ban_confirm";
  const kb = new InlineKeyboard()
    .text(`🚫 Ban ${ids.length} account${ids.length === 1 ? "" : "s"}`, "ban_apply").row()
    .text("✏️ Change accounts", "ban_start").row()
    .text("❌ Cancel", "cancel");
  return ctx.reply(`🚫 Ban preview\n\n${recipientsBlock(ids, r.labels)}${notes}\n\nThese accounts will be blocked from the Mini App.`, { reply_markup: kb });
}

bot.callbackQuery("ban_apply", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const s = ctx.session;
  const ids = (s.banIds ?? []).filter((id) => id !== ADMIN_ID);
  if (s.step !== "ban_confirm" || !ids.length) {
    ctx.session = {};
    await ctx.editMessageText("⚠️ Nothing to ban. Start again with /ban.").catch(() => {});
    return ctx.answerCallbackQuery();
  }
  const rows = ids.map((id) => ({ telegram_id: id, banned_by: ADMIN_ID }));
  const { error } = await supabase.from("banned_users").upsert(rows, { onConflict: "telegram_id" });
  ctx.session = {};
  if (error) {
    await ctx.editMessageText("❌ Error: " + error.message);
  } else {
    await ctx.editMessageText(`✅ Banned ${ids.length} account${ids.length === 1 ? "" : "s"}.\n\nUse /ban → Banned list to unban.`);
  }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("ban_list", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = {};
  const { data, error } = await supabase
    .from("banned_users")
    .select("telegram_id, banned_at")
    .order("banned_at", { ascending: false })
    .limit(BAN_LIST_MAX);
  if (error) {
    await ctx.editMessageText("❌ Error: " + error.message);
    return ctx.answerCallbackQuery();
  }
  const rows = data ?? [];
  if (!rows.length) {
    await ctx.editMessageText("📋 No banned accounts.", { reply_markup: new InlineKeyboard().text("⬅️ Back", "ban_menu") });
    return ctx.answerCallbackQuery();
  }
  const { data: users } = await supabase
    .from("users")
    .select("telegram_id, username, first_name")
    .in("telegram_id", rows.map((r: any) => r.telegram_id));
  const labels: Record<string, string> = {};
  (users ?? []).forEach((u: any) => { labels[String(u.telegram_id)] = userLabel(u); });
  const kb = new InlineKeyboard();
  rows.forEach((r: any) => {
    const l = labels[String(r.telegram_id)];
    kb.text(`♻️ Unban ${r.telegram_id}${l ? " — " + l.slice(0, 24) : ""}`, `unban_${r.telegram_id}`).row();
  });
  kb.text("⬅️ Back", "ban_menu");
  await ctx.editMessageText(`📋 Banned accounts (${rows.length}${rows.length === BAN_LIST_MAX ? "+" : ""}) — tap to unban:`, { reply_markup: kb });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("ban_menu", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = {};
  await ctx.editMessageText(BAN_MENU_TEXT, { reply_markup: banMenuKeyboard() });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^unban_(\d+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const id = Number(ctx.match[1]);
  const { error } = await supabase.from("banned_users").delete().eq("telegram_id", id);
  if (error) {
    await ctx.answerCallbackQuery("Error: " + error.message.slice(0, 150));
    return;
  }
  await ctx.answerCallbackQuery("♻️ Unbanned " + id);
  await ctx.editMessageText(`♻️ Account ${id} unbanned.`, { reply_markup: new InlineKeyboard().text("📋 Banned list", "ban_list") });
});

// ═══════════════════════════════════════════════════
// 📍 /edit_gps — one global location policy
// ═══════════════════════════════════════════════════
type GpsMode = "off" | "optional" | "required" | "once";
const GPS_MODE_LABEL: Record<GpsMode, string> = {
  off: "Off",
  optional: "Optional",
  required: "Required",
  once: "Once",
};

async function readGps(): Promise<{ mode: GpsMode; force: boolean; forceOnce: boolean; stats: { total: number; withLoc: number; banned: number } | null; error?: string }> {
  const { data, error } = await supabase
    .from("gps_settings")
    .select("mode, force_existing, force_existing_once")
    .eq("id", 1)
    .maybeSingle();
  if (error) return { mode: "off", force: false, forceOnce: false, stats: null, error: error.message };
  const st = await supabase.rpc("gps_stats");
  const d: any = st.data;
  const stats = st.error || !d
    ? null
    : { total: Number(d.users_total ?? 0), withLoc: Number(d.users_with_location ?? 0), banned: Number(d.banned ?? 0) };
  const mode = (["off", "optional", "required", "once"].includes((data as any)?.mode) ? (data as any).mode : "off") as GpsMode;
  return { mode, force: !!(data as any)?.force_existing, forceOnce: !!(data as any)?.force_existing_once, stats };
}

// Per-area GPS policy: ON = required, FREE = optional, OFF = not needed.
// Replaces the global mode for users whose latest GPS fix is inside the area.
type GpsAreaMode = "on" | "free" | "off" | null;
type GpsArea = { id: string; title: string; mode: GpsAreaMode; users: number };

async function readGpsAreas(): Promise<GpsArea[]> {
  const { data, error } = await supabase.rpc("get_area_gps_modes");
  if (error || !Array.isArray(data)) return [];
  return (data as any[]).map((a) => ({
    id: String(a.id),
    title: String(a.title ?? a.id),
    mode: a.mode === "on" || a.mode === "free" || a.mode === "off" ? a.mode : null,
    users: Number(a.users) || 0,
  }));
}

function gpsKeyboard(mode: GpsMode, force: boolean, forceOnce: boolean, areas: GpsArea[] = []) {
  const mark = (m: GpsMode) => (mode === m ? "✅ " : "") + GPS_MODE_LABEL[m];
  const kb = new InlineKeyboard()
    .text(mark("off"), "gps_mode_off")
    .text(mark("optional"), "gps_mode_optional")
    .text(mark("required"), "gps_mode_required").row()
    .text(mark("once"), "gps_mode_once").row()
    .text(`Force existing users: ${force ? "ON ✅" : "OFF"}`, "gps_force_toggle").row()
    .text(`Force existing users once: ${forceOnce ? "ON ✅" : "OFF"}`, "gps_force_once_toggle").row();
  for (const a of areas) {
    const m = (x: GpsAreaMode, label: string) => (a.mode === x ? "✅ " : "") + label;
    kb.text(`📍 ${a.title}`, "gpsa_noop").row()
      .text(m("on", "ON"), `gpsa_${a.id}_on`)
      .text(m("free", "FREE"), `gpsa_${a.id}_free`)
      .text(m("off", "OFF"), `gpsa_${a.id}_off`)
      .text(a.mode === null ? "✅ Global" : "↩️ Global", `gpsa_${a.id}_follow`)
      .row();
  }
  return kb.text("❌ Close", "cancel");
}

async function gpsMenuText(g: Awaited<ReturnType<typeof readGps>>, areas: GpsArea[] = []) {
  const areaLabel = (m: GpsAreaMode) =>
    m === "on" ? "ON (required)" : m === "free" ? "FREE (optional)" : m === "off" ? "OFF (not needed)" : "Global";
  const areaBlock = areas.length
    ? "\n\n🗺 Areas (replace the global mode for users whose last GPS fix is inside the area):\n" +
      areas.map((a) => `• ${a.title}: ${areaLabel(a.mode)} — ${a.users} user(s) located there`).join("\n") +
      "\nON = must share location · FREE = optional · OFF = never asked · Global = follow the mode above." +
      "\nA user whose location is unknown, or whose last fix is outside the area, follows the global mode."
    : "";
  const stats = g.stats
    ? `\n\n👥 Users with a saved location: ${g.stats.withLoc} / ${g.stats.total}\n🚫 Banned accounts: ${g.stats.banned}`
    : "";
  return (
    "📍 GPS settings\n\n" +
    `Mode: ${GPS_MODE_LABEL[g.mode]}\n` +
    `Force existing users: ${g.force ? "ON" : "OFF"} (applies to Required)\n` +
    `Force existing users once: ${g.forceOnce ? "ON" : "OFF"} (applies to Once)` +
    stats +
    areaBlock +
    "\n\n• Off — location is never requested.\n" +
    "• Optional — the app asks in the background; users can still enter if they decline.\n" +
    "• Required — new users must share location every time they enter. Existing users are not affected unless \"Force existing users\" is ON.\n" +
    "• Once — a user must share location only until one location is saved; after that the app never asks again. Existing users are asked only in the background unless \"Force existing users once\" is ON.\n\n" +
    "Devices that cannot share location (desktop, web, old Telegram) always enter. Telegram shows its own permission prompt; a user who refuses cannot enter while Required applies to them."
  );
}

async function renderGpsMenu(ctx: any, edit: boolean) {
  const g = await readGps();
  if (g.error) {
    const msg = "❌ Error: " + g.error;
    return edit ? ctx.editMessageText(msg).catch(() => {}) : ctx.reply(msg);
  }
  const areas = await readGpsAreas();
  const text = await gpsMenuText(g, areas);
  const kb = gpsKeyboard(g.mode, g.force, g.forceOnce, areas);
  if (edit) {
    await ctx.editMessageText(text, { reply_markup: kb }).catch(() => {});
  } else {
    await ctx.reply(text, { reply_markup: kb });
  }
}

bot.command("edit_gps", async (ctx) => {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = {};
  await renderGpsMenu(ctx, false);
});

bot.callbackQuery(/^gps_mode_(off|optional|required|once)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const mode = ctx.match[1] as GpsMode;
  const { error } = await supabase.rpc("set_gps_mode", { p_mode: mode, p_admin: ADMIN_ID });
  if (error) {
    await ctx.answerCallbackQuery("Error: " + error.message.slice(0, 150));
    return;
  }
  await renderGpsMenu(ctx, true);
  await ctx.answerCallbackQuery("Mode: " + GPS_MODE_LABEL[mode]);
});

bot.callbackQuery("gpsa_noop", async (ctx) => {
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^gpsa_([a-z0-9_]+)_(on|free|off|follow)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const area = ctx.match[1];
  const mode = ctx.match[2];
  const { error } = await supabase.rpc("set_area_gps_mode", { p_area: area, p_mode: mode, p_admin: ADMIN_ID });
  if (error) {
    await ctx.answerCallbackQuery("Error: " + error.message.slice(0, 150));
    return;
  }
  await renderGpsMenu(ctx, true);
  await ctx.answerCallbackQuery(
    mode === "on" ? "Area GPS: ON (required)" :
    mode === "free" ? "Area GPS: FREE (optional)" :
    mode === "off" ? "Area GPS: OFF" : "Area follows the global mode"
  );
});

bot.callbackQuery("gps_force_once_toggle", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const cur = await readGps();
  if (cur.error) {
    await ctx.answerCallbackQuery("Error: " + cur.error.slice(0, 150));
    return;
  }
  const next = !cur.forceOnce;
  const { error } = await supabase.rpc("set_gps_force_existing_once", { p_force: next, p_admin: ADMIN_ID });
  if (error) {
    await ctx.answerCallbackQuery("Error: " + error.message.slice(0, 150));
    return;
  }
  await renderGpsMenu(ctx, true);
  await ctx.answerCallbackQuery("Force existing users once: " + (next ? "ON" : "OFF"));
});

bot.callbackQuery("gps_force_toggle", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const cur = await readGps();
  if (cur.error) {
    await ctx.answerCallbackQuery("Error: " + cur.error.slice(0, 150));
    return;
  }
  const next = !cur.force;
  const { error } = await supabase.rpc("set_gps_force_existing", { p_force: next, p_admin: ADMIN_ID });
  if (error) {
    await ctx.answerCallbackQuery("Error: " + error.message.slice(0, 150));
    return;
  }
  await renderGpsMenu(ctx, true);
  await ctx.answerCallbackQuery("Force existing users: " + (next ? "ON" : "OFF"));
});

// ═══════════════════════════════════════════════════
// 🎮 /game_fraze — ON/OFF switch per game (cuts server load / cost)
// ═══════════════════════════════════════════════════
const GAME_SWITCHES: { id: string; label: string }[] = [
  { id: "main-tap", label: "Main Tap" },
  { id: "shoot", label: "AZOX Shoot" },
  { id: "video-ads", label: "AZOX Word" },
  { id: "snake", label: "AZOX Snake" },
  { id: "tak-bom", label: "AZOX Tak Bom" },
  { id: "question-day", label: "AZOX Question Day" },
  { id: "box", label: "AZOX Box" },
  { id: "global-button", label: "The global button" },
  { id: "clicker", label: "Clicker frenzy" },
];

async function readGameSwitches(): Promise<{ sw: Record<string, boolean>; error?: string }> {
  const { data, error } = await supabase.rpc("get_game_switches");
  if (error) return { sw: {}, error: error.message };
  const raw: any = data ?? {};
  const sw: Record<string, boolean> = {};
  // a missing row means ON (same default the app uses)
  for (const g of GAME_SWITCHES) sw[g.id] = raw[g.id] !== false;
  return { sw };
}

function gameSwitchKeyboard(sw: Record<string, boolean>) {
  const kb = new InlineKeyboard();
  for (const g of GAME_SWITCHES) {
    kb.text(`${g.label} — ${sw[g.id] ? "ON ✅" : "OFF 🔴"}`, `gf_${g.id}`).row();
  }
  return kb.text("❌ Close", "cancel");
}

function gameSwitchText(sw: Record<string, boolean>) {
  const off = GAME_SWITCHES.filter((g) => !sw[g.id]).map((g) => g.label);
  return (
    "🎮 Game switches\n\n" +
    "Tap a game to turn it ON or OFF.\n" +
    "OFF = the game is locked in the app and its rewards/requests are blocked on the server, so it adds no load.\n\n" +
    (off.length ? `🔴 Currently OFF: ${off.join(", ")}\n\n` : "✅ All games are ON.\n\n") +
    "The change reaches users within about a minute."
  );
}

async function renderGameSwitches(ctx: any, edit: boolean) {
  const g = await readGameSwitches();
  if (g.error) {
    const msg = "❌ Error: " + g.error;
    return edit ? ctx.editMessageText(msg).catch(() => {}) : ctx.reply(msg);
  }
  const text = gameSwitchText(g.sw);
  const kb = gameSwitchKeyboard(g.sw);
  if (edit) {
    await ctx.editMessageText(text, { reply_markup: kb }).catch(() => {});
  } else {
    await ctx.reply(text, { reply_markup: kb });
  }
}

bot.command(["game_fraze", "game_freeze"], async (ctx) => {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = {};
  await renderGameSwitches(ctx, false);
});

bot.callbackQuery(/^gf_(main-tap|shoot|video-ads|snake|tak-bom|question-day|box|global-button|clicker)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const id = ctx.match[1];
  const label = GAME_SWITCHES.find((g) => g.id === id)!.label;
  const cur = await readGameSwitches();
  if (cur.error) {
    await ctx.answerCallbackQuery("Error: " + cur.error.slice(0, 150));
    return;
  }
  const next = !cur.sw[id];
  const { error } = await supabase.rpc("set_game_enabled", { p_game: id, p_enabled: next, p_admin: ADMIN_ID });
  if (error) {
    await ctx.answerCallbackQuery("Error: " + error.message.slice(0, 150));
    return;
  }
  await renderGameSwitches(ctx, true);
  await ctx.answerCallbackQuery(`${label}: ${next ? "ON" : "OFF"}`);
});

// ═══════════════════════════════════════════════════
// 🎭 /game_change — choose which face the Gaming page shows
//   Face 1 = the games page (referral: +4000 for the referrer only)
//   Face 2 = logo + personal referral link + friend picker
//            (referrer +5000; friend picked from Telegram → friend +3000, 10 tasks each)
// ═══════════════════════════════════════════════════
type Face = 1 | 2;

async function readGamingFace(): Promise<{ face: Face; error?: string }> {
  const { data, error } = await supabase.rpc("get_gaming_face");
  if (error) return { face: 1, error: error.message };
  return { face: Number(data) === 2 ? 2 : 1 };
}

function faceText(face: Face) {
  return (
    "🎭 Gaming page face\n\n" +
    `Now showing: ${face === 1 ? "Face 1 — Games" : "Face 2 — Referral"}\n` +
    `Hidden: ${face === 1 ? "Face 2" : "Face 1"}\n\n` +
    "Face 1 — Games page. Referral pays the referrer 4000 points only.\n" +
    "Face 2 — AZOX logo + personal referral link. Referrer 5000 points; if the referrer picked the friend from Telegram: friend 3000 points and 10 tasks each.\n\n" +
    "The change reaches users within about a minute."
  );
}

function faceKeyboard(face: Face) {
  return new InlineKeyboard()
    .text(`${face === 1 ? "✅ " : ""}Face 1 — Games`, "face_1").row()
    .text(`${face === 2 ? "✅ " : ""}Face 2 — Referral`, "face_2").row()
    .text("❌ Close", "cancel");
}

async function renderFaceMenu(ctx: any, edit: boolean) {
  const f = await readGamingFace();
  if (f.error) {
    const msg = "❌ Error: " + f.error;
    return edit ? ctx.editMessageText(msg).catch(() => {}) : ctx.reply(msg);
  }
  const text = faceText(f.face);
  const kb = faceKeyboard(f.face);
  if (edit) {
    await ctx.editMessageText(text, { reply_markup: kb }).catch(() => {});
  } else {
    await ctx.reply(text, { reply_markup: kb });
  }
}

bot.command("game_change", async (ctx) => {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = {};
  await renderFaceMenu(ctx, false);
});

bot.callbackQuery(/^face_(1|2)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const face = Number(ctx.match[1]) as Face;
  const { error } = await supabase.rpc("set_gaming_face", { p_face: face, p_admin: ADMIN_ID });
  if (error) {
    await ctx.answerCallbackQuery("Error: " + error.message.slice(0, 150));
    return;
  }
  await renderFaceMenu(ctx, true);
  await ctx.answerCallbackQuery(`Face ${face} is now showing`);
});

// ═══════════════════════════════════════════════════
// 📖 /story_task — tasks given for Story engagement
//   Each kind (view / like / comment) can be ON or OFF and pays 1–200 task units.
//   A user is paid once per story per kind (repeat comments, un-like/re-like never pay again).
// ═══════════════════════════════════════════════════
type StKind = "view" | "like" | "comment";
const ST_KINDS: { id: StKind; label: string }[] = [
  { id: "view", label: "👁 Views" },
  { id: "like", label: "❤️ Likes" },
  { id: "comment", label: "💬 Comments" },
];
type StSettings = Record<StKind, { enabled: boolean; units: number }>;

async function readStoryTask(): Promise<{ s?: StSettings; error?: string }> {
  const { data, error } = await supabase.rpc("get_story_task_settings");
  if (error || !data) return { error: error?.message ?? "no data" };
  const d: any = data;
  const s = {} as StSettings;
  for (const k of ST_KINDS) {
    s[k.id] = { enabled: d?.[k.id]?.enabled === true, units: Number(d?.[k.id]?.units) || 1 };
  }
  return { s };
}

function storyTaskText(s: StSettings) {
  const lines = ST_KINDS.map(
    (k) => `${k.label}: ${s[k.id].enabled ? "ON ✅" : "OFF 🔴"} — ${s[k.id].units} task(s)`
  ).join("\n");
  return (
    "📖 Story tasks\n\n" +
    lines + "\n\n" +
    "• ON/OFF — turn the reward on or off.\n" +
    "• ✏️ — set how many tasks each user gets (1 to 200).\n\n" +
    "A user is paid once per story for each kind. Repeating a comment, or un-liking and liking again, never pays twice. " +
    "Changing the number only affects future payouts."
  );
}

function storyTaskKeyboard(s: StSettings) {
  const kb = new InlineKeyboard();
  for (const k of ST_KINDS) {
    kb.text(`${k.label} — ${s[k.id].enabled ? "ON ✅" : "OFF 🔴"}`, `st_toggle_${k.id}`)
      .text(`✏️ ${s[k.id].units}`, `st_units_${k.id}`)
      .row();
  }
  return kb.text("❌ Close", "cancel");
}

async function renderStoryTaskMenu(ctx: any, edit: boolean) {
  const r = await readStoryTask();
  if (!r.s) {
    const msg = "❌ Error: " + (r.error ?? "unknown");
    return edit ? ctx.editMessageText(msg).catch(() => {}) : ctx.reply(msg);
  }
  const text = storyTaskText(r.s);
  const kb = storyTaskKeyboard(r.s);
  if (edit) {
    await ctx.editMessageText(text, { reply_markup: kb }).catch(() => {});
  } else {
    await ctx.reply(text, { reply_markup: kb });
  }
}

bot.command("story_task", async (ctx) => {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = {};
  await renderStoryTaskMenu(ctx, false);
});

bot.callbackQuery(/^st_toggle_(view|like|comment)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const kind = ctx.match[1] as StKind;
  const cur = await readStoryTask();
  if (!cur.s) {
    await ctx.answerCallbackQuery("Error: " + (cur.error ?? "").slice(0, 150));
    return;
  }
  const next = !cur.s[kind].enabled;
  const { error } = await supabase.rpc("set_story_task", {
    p_kind: kind, p_enabled: next, p_units: null, p_admin: ADMIN_ID,
  });
  if (error) {
    await ctx.answerCallbackQuery("Error: " + error.message.slice(0, 150));
    return;
  }
  await renderStoryTaskMenu(ctx, true);
  await ctx.answerCallbackQuery(`${kind}: ${next ? "ON" : "OFF"}`);
});

bot.callbackQuery(/^st_units_(view|like|comment)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const kind = ctx.match[1] as StKind;
  const label = ST_KINDS.find((k) => k.id === kind)!.label;
  ctx.session = { step: "st_units", stKind: kind };
  await ctx.editMessageText(
    `${label}\n\nSend how many tasks each user gets — a whole number from 1 to 200:`,
    { reply_markup: cancelOnlyKeyboard() }
  ).catch(() => {});
  await ctx.answerCallbackQuery();
});

async function handleStoryTaskUnits(ctx: any, s: SessionData, text: string) {
  const kind = s.stKind;
  if (!kind) { ctx.session = {}; return; }
  if (!/^\d{1,3}$/.test(text)) {
    return ctx.reply("❌ Send a whole number from 1 to 200:", { reply_markup: cancelOnlyKeyboard() });
  }
  const n = parseInt(text, 10);
  if (n < 1 || n > 200) {
    return ctx.reply("❌ The number must be from 1 to 200:", { reply_markup: cancelOnlyKeyboard() });
  }
  const { error } = await supabase.rpc("set_story_task", {
    p_kind: kind, p_enabled: null, p_units: n, p_admin: ADMIN_ID,
  });
  ctx.session = {};
  if (error) return ctx.reply("❌ Error: " + error.message);
  await ctx.reply(`✅ ${ST_KINDS.find((k) => k.id === kind)!.label}: ${n} task(s) per user.`);
  await renderStoryTaskMenu(ctx, false);
}

// ═══════════════════════════════════════════════════
// 🌍 /promo_story and /search_location — geo targeting
//   Both commands share one selection screen:
//   • ON/OFF buttons for region groups and the Kurdistan zones
//   • a fixed numbered list of countries (1..250) — type numbers like  1 . 2 . 4 . 73  (or -5 to remove)
//   /promo_story   → Save writes the rule on the chosen story (set_story_geo_rule)
//   /search_location → Count shows how many registered users are in the chosen area (count_geo_users)
//   The catalog lives in the database tables geo_countries, geo_groups, geo_zones.
// ═══════════════════════════════════════════════════
type GeoCountry = { num: number; code: string; name: string };
type GeoGroup = { id: string; title: string; sort: number; codes: string[] };
type GeoZone = { id: string; title: string; sort: number };
type GeoCatalog = {
  countries: GeoCountry[];
  groups: GeoGroup[];
  zones: GeoZone[];
  byNum: Map<number, GeoCountry>;
  byCode: Map<string, GeoCountry>;
};

let geoCatalogCache: { at: number; data: GeoCatalog } | null = null;

async function loadGeoCatalog(): Promise<GeoCatalog> {
  if (geoCatalogCache && Date.now() - geoCatalogCache.at < 10 * 60 * 1000) {
    return geoCatalogCache.data;
  }
  const [c, g, z] = await Promise.all([
    supabase.from("geo_countries").select("num, code, name").order("num", { ascending: true }).limit(1000),
    supabase.from("geo_groups").select("id, title, sort, codes").order("sort", { ascending: true }).limit(200),
    supabase.from("geo_zones").select("id, title, sort").order("sort", { ascending: true }).limit(50),
  ]);
  if (c.error) throw new Error(c.error.message);
  if (g.error) throw new Error(g.error.message);
  if (z.error) throw new Error(z.error.message);
  const countries = (c.data ?? []) as GeoCountry[];
  const data: GeoCatalog = {
    countries,
    groups: (g.data ?? []) as GeoGroup[],
    zones: (z.data ?? []) as GeoZone[],
    byNum: new Map(countries.map((x) => [x.num, x])),
    byCode: new Map(countries.map((x) => [x.code, x])),
  };
  geoCatalogCache = { at: Date.now(), data };
  return data;
}

function geoSelected(s: SessionData) {
  return {
    codes: new Set<string>(s.geoSel ?? []),
    zones: new Set<string>(s.geoZoneSel ?? []),
  };
}

// A group shows ON when every country in it is selected.
function geoGroupOn(sel: Set<string>, grp: GeoGroup) {
  return grp.codes.length > 0 && grp.codes.every((c) => sel.has(c));
}

function geoSummaryText(s: SessionData, cat: GeoCatalog) {
  const { codes, zones } = geoSelected(s);
  const lines: string[] = [];

  const zoneNames = cat.zones.filter((z) => zones.has(z.id)).map((z) => z.title);
  lines.push("🏔 Kurdistan zones: " + (zoneNames.length ? zoneNames.join(", ") : "—"));

  const groupNames = cat.groups.filter((g) => geoGroupOn(codes, g)).map((g) => g.title);
  lines.push("🗺 Groups ON: " + (groupNames.length ? groupNames.join(", ") : "—"));

  const names = [...codes].map((c) => cat.byCode.get(c)).filter(Boolean) as GeoCountry[];
  names.sort((a, b) => a.num - b.num);
  const shown = names.slice(0, 40).map((n) => `${n.num} ${n.name}`);
  const more = names.length > 40 ? ` … +${names.length - 40} more` : "";
  lines.push(`🌍 Countries selected: ${names.length}` + (names.length ? "\n" + shown.join(", ") + more : ""));

  return lines.join("\n");
}

function geoMenuText(s: SessionData, cat: GeoCatalog) {
  const summary = geoSummaryText(s, cat);
  if (s.geoKind === "promo") {
    const mode = s.geoRule === "exclude"
      ? "🚫 Mode: EVERYONE EXCEPT the selection (the selected areas will NOT see the story)"
      : "✅ Mode: ONLY the selection (only the selected areas see the story)";
    return (
      "🎯 Promo Story — " + (s.geoStoryLabel ?? "") + "\n\n" +
      mode + "\n\n" + summary + "\n\n" +
      "• Tap a button to turn a group ON/OFF.\n" +
      "• 🔢 Numbers — type country numbers, e.g. 1 . 2 . 4 . 73  (use -5 to remove one).\n" +
      "• 📋 Country list — see the numbers.\n" +
      "• A user whose location is unknown: hidden in ONLY mode, shown in EVERYONE EXCEPT mode.\n" +
      "• 🌐 Everyone — removes the filter from this story."
    );
  }
  return (
    "🔎 Search location\n\n" + summary + "\n\n" +
    "• Tap a button to turn a group ON/OFF.\n" +
    "• 🔢 Numbers — type country numbers, e.g. 1 . 2 . 4 . 73  (use -5 to remove one).\n" +
    "• 📋 Country list — see the numbers.\n" +
    "• Then tap 🔎 Count users."
  );
}

function geoKeyboard(s: SessionData, cat: GeoCatalog) {
  const { codes, zones } = geoSelected(s);
  const kb = new InlineKeyboard();

  // Kurdistan zones first
  cat.zones.forEach((z, i) => {
    kb.text(`${zones.has(z.id) ? "ON ✅" : "OFF ⚪️"} ${z.title}`, `geo_z_${z.id}`);
    if (i % 2 === 1) kb.row();
  });
  if (cat.zones.length % 2 === 1) kb.row();

  // Region groups
  cat.groups.forEach((g, i) => {
    kb.text(`${geoGroupOn(codes, g) ? "ON ✅" : "OFF ⚪️"} ${g.title}`, `geo_g_${g.id}`);
    if (i % 2 === 1) kb.row();
  });
  if (cat.groups.length % 2 === 1) kb.row();

  kb.text("🔢 Numbers", "geo_nums").text("📋 Country list", "geo_list_0").row();
  if (s.geoKind === "promo") {
    kb.text(s.geoRule === "exclude" ? "🚫 Mode: Everyone except" : "✅ Mode: Only selection", "geo_mode").row();
  }
  kb.text("🧹 Clear selection", "geo_clear");
  if (s.geoKind === "promo") {
    kb.text("🌐 Everyone", "geo_all").row().text("💾 Save", "geo_save");
  } else {
    kb.row().text("🔎 Count users", "geo_run");
  }
  return kb.text("❌ Close", "cancel");
}

async function renderGeoMenu(ctx: any, edit: boolean) {
  let cat: GeoCatalog;
  try {
    cat = await loadGeoCatalog();
  } catch (e: any) {
    const msg = "❌ Error loading the location list: " + (e?.message ?? e);
    return edit ? ctx.editMessageText(msg).catch(() => {}) : ctx.reply(msg);
  }
  const s: SessionData = ctx.session ?? {};
  const text = geoMenuText(s, cat);
  const kb = geoKeyboard(s, cat);
  if (edit) {
    await ctx.editMessageText(text, { reply_markup: kb }).catch(() => {});
  } else {
    await ctx.reply(text, { reply_markup: kb });
  }
}

// Session guard: the selection lives in memory, so a bot restart clears it.
async function geoSessionOk(ctx: any) {
  if (ctx.session?.geoKind === "search") return true;
  if (ctx.session?.geoKind === "promo" && ctx.session?.geoStoryId) return true;
  await ctx.answerCallbackQuery("Session expired — run the command again").catch(() => {});
  return false;
}

// ── /promo_story — pick a story ──
bot.command("promo_story", async (ctx) => {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = {};
  const { data: stories, error } = await supabase
    .from("stories")
    .select("id, media_type, link_url, created_at, expires_at, is_private, geo_rule")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return ctx.reply("❌ Error: " + error.message);
  if (!stories || stories.length === 0) {
    return ctx.reply("📖 No stories yet. Use /share_story to publish one.");
  }

  const kb = new InlineKeyboard();
  stories.forEach((st: any) => {
    const active = new Date(st.expires_at).getTime() > Date.now();
    const kind = st.media_type === "video" ? "🎬" : "🖼";
    const priv = st.is_private ? " 🔒" : "";
    const geo = st.geo_rule ? " 🎯" : "";
    kb.text(`${active ? "🟢" : "⚪️"} ${kind} ${storyTimeLeft(st.expires_at)}${priv}${geo}`, `geo_pick_${st.id}`).row();
  });
  kb.text("❌ Cancel", "cancel");
  await ctx.reply(
    "🎯 Promo Story — choose a story.\n🎯 = already limited to some areas.",
    { reply_markup: kb }
  );
});

bot.callbackQuery(/^geo_pick_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const id = ctx.match[1];
  const { data: st, error } = await supabase
    .from("stories")
    .select("id, media_type, expires_at, geo_rule")
    .eq("id", id)
    .single();
  if (error || !st) {
    await ctx.editMessageText("❌ Story not found.").catch(() => {});
    return ctx.answerCallbackQuery();
  }

  let cat: GeoCatalog;
  try {
    cat = await loadGeoCatalog();
  } catch (e: any) {
    await ctx.editMessageText("❌ Error loading the location list: " + (e?.message ?? e)).catch(() => {});
    return ctx.answerCallbackQuery();
  }

  // Start from the rule already saved on the story (if any)
  const rule: any = (st as any).geo_rule;
  const mode: "include" | "exclude" = rule?.mode === "exclude" ? "exclude" : "include";
  const validCodes = ((rule?.countries ?? []) as string[]).filter((c) => cat.byCode.has(c));
  const validZones = ((rule?.zones ?? []) as string[]).filter((z) => cat.zones.some((x) => x.id === z));

  const kind = (st as any).media_type === "video" ? "🎬" : "🖼";
  ctx.session = {
    geoKind: "promo",
    geoStoryId: id,
    geoStoryLabel: `${kind} ${storyTimeLeft((st as any).expires_at)}`,
    geoRule: mode,
    geoSel: validCodes,
    geoZoneSel: validZones,
  };
  await renderGeoMenu(ctx, true);
  await ctx.answerCallbackQuery();
});

// ── /search_location (and the typo alias /search_locatio) ──
async function startGeoSearch(ctx: any) {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = { geoKind: "search", geoSel: [], geoZoneSel: [] };
  await renderGeoMenu(ctx, false);
}
bot.command("search_location", startGeoSearch);
bot.command("search_locatio", startGeoSearch);

// ── toggles ──
bot.callbackQuery(/^geo_z_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  if (!await geoSessionOk(ctx)) return;
  const id = ctx.match[1];
  const cat = await loadGeoCatalog().catch(() => null);
  if (!cat || !cat.zones.some((z) => z.id === id)) return ctx.answerCallbackQuery("Unknown zone");
  const zones = new Set<string>(ctx.session.geoZoneSel ?? []);
  if (zones.has(id)) zones.delete(id); else zones.add(id);
  ctx.session.geoZoneSel = [...zones];
  await renderGeoMenu(ctx, true);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^geo_g_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  if (!await geoSessionOk(ctx)) return;
  const id = ctx.match[1];
  const cat = await loadGeoCatalog().catch(() => null);
  const grp = cat?.groups.find((g) => g.id === id);
  if (!cat || !grp) return ctx.answerCallbackQuery("Unknown group");
  const sel = new Set<string>(ctx.session.geoSel ?? []);
  if (geoGroupOn(sel, grp)) {
    grp.codes.forEach((c) => sel.delete(c));
  } else {
    grp.codes.forEach((c) => sel.add(c));
  }
  ctx.session.geoSel = [...sel];
  await renderGeoMenu(ctx, true);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("geo_mode", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  if (!await geoSessionOk(ctx)) return;
  ctx.session.geoRule = ctx.session.geoRule === "exclude" ? "include" : "exclude";
  await renderGeoMenu(ctx, true);
  await ctx.answerCallbackQuery(ctx.session.geoRule === "exclude" ? "Everyone except the selection" : "Only the selection");
});

bot.callbackQuery("geo_clear", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  if (!await geoSessionOk(ctx)) return;
  ctx.session.geoSel = [];
  ctx.session.geoZoneSel = [];
  await renderGeoMenu(ctx, true);
  await ctx.answerCallbackQuery("Selection cleared");
});

// ── numbered country list (paginated, sent as a separate message) ──
const GEO_LIST_PAGE = 60;

async function renderGeoList(ctx: any, page: number) {
  const cat = await loadGeoCatalog();
  const pages = Math.max(1, Math.ceil(cat.countries.length / GEO_LIST_PAGE));
  const p = Math.min(Math.max(page, 0), pages - 1);
  const slice = cat.countries.slice(p * GEO_LIST_PAGE, (p + 1) * GEO_LIST_PAGE);
  const sel = new Set<string>(ctx.session?.geoSel ?? []);
  const lines = slice.map((c) => `${sel.has(c.code) ? "✅" : "▫️"} ${c.num}. ${c.name}`).join("\n");
  const text = `📋 Countries — page ${p + 1}/${pages}\n\n${lines}`;
  const kb = new InlineKeyboard();
  if (p > 0) kb.text("◀️ Prev", `geo_list_${p - 1}`);
  if (p < pages - 1) kb.text("Next ▶️", `geo_list_${p + 1}`);
  kb.row().text("✖️ Close list", "geo_list_close");
  return { text, kb };
}

bot.callbackQuery(/^geo_list_(\d+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const page = parseInt(ctx.match[1], 10);
  let r;
  try {
    r = await renderGeoList(ctx, page);
  } catch (e: any) {
    return ctx.answerCallbackQuery("Error: " + String(e?.message ?? e).slice(0, 150));
  }
  // The menu button opens a new message; the page buttons edit that list message.
  const fromMenu = page === 0 && !(ctx.callbackQuery.message?.text ?? "").startsWith("📋 Countries");
  if (fromMenu) {
    await ctx.reply(r.text, { reply_markup: r.kb });
  } else {
    await ctx.editMessageText(r.text, { reply_markup: r.kb }).catch(() => {});
  }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("geo_list_close", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  await ctx.deleteMessage().catch(() => {});
  await ctx.answerCallbackQuery();
});

// ── typed numbers ──
bot.callbackQuery("geo_nums", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  if (!await geoSessionOk(ctx)) return;
  ctx.session.step = "geo_nums";
  await ctx.reply(
    "🔢 Send country numbers, for example:\n1 . 2 . 4 . 73 . 8\n\n" +
    "• Numbers add countries.\n" +
    "• A minus sign removes: -5 . -8\n" +
    "• Separators: dot, comma, space or Arabic comma.\n" +
    "• Use 📋 Country list to see the numbers (1 to 250).",
    { reply_markup: cancelOnlyKeyboard() }
  );
  await ctx.answerCallbackQuery();
});

// Arabic-Indic (٠-٩) and Persian (۰-۹) digits → ASCII; fancy minus signs → "-"
function geoNormalizeDigits(t: string) {
  return t
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[−–—]/g, "-");
}

async function handleGeoNums(ctx: any, s: SessionData, text: string) {
  if (s.geoKind !== "promo" && s.geoKind !== "search") { ctx.session = {}; return; }
  const cat = await loadGeoCatalog().catch(() => null);
  if (!cat) return ctx.reply("❌ Error loading the location list. Try again.");

  const tokens = geoNormalizeDigits(text).split(/[\s.,،;؛]+/).filter(Boolean);
  if (tokens.length === 0) {
    return ctx.reply("❌ Send numbers like: 1 . 2 . 4 . 73", { reply_markup: cancelOnlyKeyboard() });
  }

  const add: GeoCountry[] = [];
  const remove: GeoCountry[] = [];
  const bad: string[] = [];
  for (const tok of tokens) {
    const m = /^(-?)(\d{1,3})$/.exec(tok);
    if (!m) { bad.push(tok); continue; }
    const c = cat.byNum.get(parseInt(m[2], 10));
    if (!c) { bad.push(tok); continue; }
    (m[1] ? remove : add).push(c);
  }
  if (bad.length) {
    return ctx.reply(
      "❌ Not valid: " + bad.slice(0, 15).join(" , ") + (bad.length > 15 ? " …" : "") +
      `\nNumbers must be 1 to ${cat.countries.length}. Nothing was changed — send it again:`,
      { reply_markup: cancelOnlyKeyboard() }
    );
  }

  const sel = new Set<string>(s.geoSel ?? []);
  add.forEach((c) => sel.add(c.code));
  remove.forEach((c) => sel.delete(c.code));
  ctx.session.geoSel = [...sel];
  ctx.session.step = undefined;

  const parts: string[] = [];
  if (add.length) parts.push("➕ " + [...new Set(add.map((c) => c.name))].join(", "));
  if (remove.length) parts.push("➖ " + [...new Set(remove.map((c) => c.name))].join(", "));
  await ctx.reply("✅ Updated\n" + parts.join("\n"));
  await renderGeoMenu(ctx, false);
}

// ── promo: save / everyone ──
bot.callbackQuery("geo_save", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  if (!await geoSessionOk(ctx)) return;
  const s: SessionData = ctx.session;
  if (s.geoKind !== "promo" || !s.geoStoryId) return ctx.answerCallbackQuery("Run /promo_story again");

  const countries = [...new Set(s.geoSel ?? [])];
  const zones = [...new Set(s.geoZoneSel ?? [])];
  if (countries.length === 0 && zones.length === 0) {
    return ctx.answerCallbackQuery("Nothing selected. Pick an area, or tap 🌐 Everyone.");
  }
  const mode = s.geoRule === "exclude" ? "exclude" : "include";
  const { error } = await supabase.rpc("set_story_geo_rule", {
    p_story_id: s.geoStoryId,
    p_rule: { mode, countries, zones },
  });
  if (error) {
    return ctx.answerCallbackQuery("Error: " + error.message.slice(0, 150));
  }
  const cat = await loadGeoCatalog().catch(() => null);
  const summary = cat ? geoSummaryText(s, cat) : "";
  const label = s.geoStoryLabel ?? "";
  ctx.session = {};
  await ctx.editMessageText(
    "✅ Saved — " + label + "\n\n" +
    (mode === "exclude"
      ? "🚫 EVERYONE EXCEPT the selection sees this story."
      : "✅ ONLY the selection sees this story.") +
    "\n\n" + summary
  ).catch(() => {});
  await ctx.answerCallbackQuery("Saved");
});

bot.callbackQuery("geo_all", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  if (!await geoSessionOk(ctx)) return;
  const s: SessionData = ctx.session;
  if (s.geoKind !== "promo" || !s.geoStoryId) return ctx.answerCallbackQuery("Run /promo_story again");
  const { error } = await supabase.rpc("set_story_geo_rule", {
    p_story_id: s.geoStoryId,
    p_rule: null,
  });
  if (error) {
    return ctx.answerCallbackQuery("Error: " + error.message.slice(0, 150));
  }
  const label = s.geoStoryLabel ?? "";
  ctx.session = {};
  await ctx.editMessageText("✅ " + label + "\n\n🌐 This story is now visible to everyone.").catch(() => {});
  await ctx.answerCallbackQuery("Everyone");
});

// ── search: count users ──
bot.callbackQuery("geo_run", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  if (!await geoSessionOk(ctx)) return;
  const s: SessionData = ctx.session;
  const countries = [...new Set(s.geoSel ?? [])];
  const zones = [...new Set(s.geoZoneSel ?? [])];
  if (countries.length === 0 && zones.length === 0) {
    return ctx.answerCallbackQuery("Nothing selected. Pick an area first.");
  }
  const { data, error } = await supabase.rpc("count_geo_users", {
    p_countries: countries,
    p_zones: zones,
  });
  if (error || !data) {
    return ctx.answerCallbackQuery("Error: " + (error?.message ?? "no data").slice(0, 150));
  }
  const d: any = data;
  const cat = await loadGeoCatalog().catch(() => null);
  const total = Number(d.total) || 0;
  const known = Number(d.known) || 0;
  const matched = Number(d.matched) || 0;
  const pct = known > 0 ? ((matched / known) * 100).toFixed(1) : "0";

  const lines: string[] = [
    "🔎 Search result",
    "",
    `👥 Users in the selected area: ${matched}`,
    `📍 Users with a known location: ${known} (${pct}% of them are in the area)`,
    `❓ Unknown location: ${Math.max(0, total - known)}`,
    `🧮 All registered users: ${total}`,
  ];
  const byZone: Record<string, number> = d.by_zone ?? {};
  const zoneLines = (cat?.zones ?? []).filter((z) => byZone[z.id] != null)
    .map((z) => `• ${z.title}: ${byZone[z.id]}`);
  if (zoneLines.length) lines.push("", "🏔 Kurdistan zones:", ...zoneLines);
  const byCountry: any[] = Array.isArray(d.by_country) ? d.by_country : [];
  if (byCountry.length) {
    lines.push("", "🌍 Top countries:", ...byCountry.map((c) => `• ${c.name}: ${c.count}`));
  }
  lines.push("", "A user counts once, even if they match several selected areas.");
  if (known === 0) {
    lines.push("", "⚠️ No user has a saved location yet. Locations are saved when a user opens the Mini App.");
  }

  const kb = new InlineKeyboard().text("⬅️ Back to selection", "geo_back").text("❌ Close", "cancel");
  await ctx.editMessageText(lines.join("\n"), { reply_markup: kb }).catch(() => {});
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("geo_back", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  if (!await geoSessionOk(ctx)) return;
  await renderGeoMenu(ctx, true);
  await ctx.answerCallbackQuery();
});

// ─── TEXT HANDLER (all steps) ───────────────────────
bot.on("message:text", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const s = ctx.session;
  const text = ctx.message.text.trim();

  // STORY: link (optional)
  if (s.step === "story_link") {
    if (!isValidStoryUrl(text)) {
      return ctx.reply(
        "❌ Invalid URL. Must start with https:// or http://\nSend it again, or tap Skip:",
        { reply_markup: storyLinkKeyboard() }
      );
    }
    s.storyLink = text;
    s.step = "story_duration";
    return ctx.reply(STORY_DURATION_PROMPT, { reply_markup: storyDurationKeyboard() });
  }

  // STORY: duration typed by hand
  if (s.step === "story_duration") {
    const hours = parseStoryHours(text);
    if (hours === null) {
      return ctx.reply(
        `❌ Invalid. Send a whole number from ${STORY_MIN_HOURS} to ${STORY_MAX_HOURS}:`,
        { reply_markup: storyDurationKeyboard() }
      );
    }
    s.storyHours = hours;
    if (s.storyPrivate) {
      s.step = "priv_to";
      s.privKind = "story";
      return ctx.reply(PRIV_PROMPT, { reply_markup: cancelOnlyKeyboard() });
    }
    s.step = "story_confirm";
    const p = storyPreview(s);
    return ctx.reply(p.text, { reply_markup: p.kb });
  }

  // BAN
  if (s.step === "ban_to") return handleBanText(ctx, s, text);

  // STORY TASKS: number of tasks per kind
  if (s.step === "st_units") return handleStoryTaskUnits(ctx, s, text);

  // GEO TARGETING: country numbers typed by hand
  if (s.step === "geo_nums") return handleGeoNums(ctx, s, text);

  // CHAT MESSAGES (the bot writes into users' chats)
  if (s.step === "cm_content") return handleChatTextContent(ctx, s);
  if (s.step === "cm_buttons") return handleChatButtonsText(ctx, s);
  if (s.step === "cm_edit_text") return handleChatEditText(ctx, s);
  if (s.step === "cm_edit_buttons") return handleChatEditButtons(ctx, s);
  if (s.step === "cm_more") return handleChatMoreRecipients(ctx, s, text);

  // PRIVATE MESSAGE: title
  if (s.step === "pmsg_title") {
    if (text.length < 2 || text.length > 100) {
      return ctx.reply("❌ Title must be 2–100 characters:", { reply_markup: cancelOnlyKeyboard() });
    }
    s.title = text;
    s.step = "pmsg_body";
    return ctx.reply("✅ Title saved.\n\nSend the message:", { reply_markup: cancelOnlyKeyboard() });
  }

  // PRIVATE MESSAGE: body → recipients
  if (s.step === "pmsg_body") {
    s.msgBody = text;
    s.step = "priv_to";
    s.privKind = "message";
    return ctx.reply(PRIV_PROMPT, { reply_markup: cancelOnlyKeyboard() });
  }

  // PRIVATE: recipients (new private story / message) and EDIT recipients
  if (s.step === "priv_to" || s.step === "rcp_edit") {
    return handlePrivateRecipientsText(ctx, s, text);
  }

  // STORY EDIT: new link
  if (s.step === "story_edit_link" && s.editTaskId) {
    if (!isValidStoryUrl(text)) {
      return ctx.reply("❌ Invalid URL. Must start with https:// or http://\nTry again:");
    }
    const { error } = await supabase
      .from("stories")
      .update({ link_url: text })
      .eq("id", s.editTaskId);
    ctx.session = {};
    if (error) return ctx.reply("❌ Error: " + error.message);
    return ctx.reply("✅ Story link updated!");
  }

  // ADD: title
  if (s.step === "add_title") {
    if (text.length < 2 || text.length > 80) {
      return ctx.reply("❌ Name must be 2–80 characters. Try again:");
    }
    s.title = text;
    s.step  = "add_url";
    return ctx.reply(`✅ Name: ${text}\n\nSend the account URL (must start with https://):`);
  }

  // ADD: url
  if (s.step === "add_url") {
    if (!isValidUrl(text)) {
      return ctx.reply("❌ Invalid URL. Must start with https:// or http://\nTry again:");
    }
    s.url  = text;
    s.step = "add_points";
    return ctx.reply(`✅ URL saved.\n\nHow many points? (1–100000):`);
  }

  // ADD: points
  if (s.step === "add_points") {
    const pts = isValidPoints(text);
    if (pts === null) {
      return ctx.reply("❌ Invalid. Enter a number between 1 and 100000:");
    }
    s.points = pts;
    s.step   = "add_tasks";
    return ctx.reply(
      `✅ Points: +${pts}\n\nHow many Tasks to reward?\n(0 = no task reward, 1 = +1 Task, 2 = +2 Tasks...)\n\nEnter a number between 0 and 100:`
    );
  }

  // ADD: task reward ← NEW STEP
  if (s.step === "add_tasks") {
    const reward = isValidTaskReward(text);
    if (reward === null) {
      return ctx.reply("❌ Invalid. Enter a number between 0 and 100:");
    }
    s.taskReward = reward;
    s.step       = "add_confirm";
    const kb = new InlineKeyboard()
      .text("✅ Confirm & Add", "add_confirm")
      .text("❌ Cancel", "cancel");
    const taskLine = reward > 0 ? `\nTask Reward: +${reward} Task(s)` : "\nTask Reward: None";
    return ctx.reply(
      `📋 New Task:\n\n` +
      `Platform: ${PLATFORM_EMOJI[s.platform!]} ${s.platform}\n` +
      `Title: ${s.title}\n` +
      `URL: ${s.url}\n` +
      `Points: +${s.points}` +
      taskLine,
      { reply_markup: kb }
    );
  }


  // MESSAGE: title
  if (s.step === "msg_title") {
    if (text.length < 2 || text.length > 100) {
      return ctx.reply("❌ Title must be 2–100 characters:");
    }
    s.title = text;
    s.step  = "msg_body";
    return ctx.reply("✅ Title saved.\n\nSend the announcement message:");
  }

  // MESSAGE: body
  if (s.step === "msg_body") {
    s.msgBody = text;
    s.step    = "msg_confirm";
    const kb = new InlineKeyboard()
      .text("✅ Send to all users", "msg_confirm")
      .text("❌ Cancel", "cancel");
    return ctx.reply(
      `📢 Preview:\n\n📌 ${s.title}\n\n${text}`,
      { reply_markup: kb }
    );
  }

  // EDIT MESSAGE: new value
  if (s.step === "editmsg_value" && s.editTaskId && s.editField) {
    const { error } = await supabase
      .from("announcements")
      .update({ [s.editField]: text })
      .eq("id", s.editTaskId);
    ctx.session = {};
    if (error) return ctx.reply("❌ Error: " + error.message);
    return ctx.reply("✅ Announcement updated!");
  }

  // EDIT: new value
  if (s.step === "edit_value" && s.editTaskId && s.editField) {
    let value: string | number = text;

    if (s.editField === "points") {
      const pts = isValidPoints(text);
      if (pts === null) return ctx.reply("❌ Invalid. Enter a number between 1 and 100000:");
      value = pts;
    }
    if (s.editField === "task_reward") {
      const reward = isValidTaskReward(text);
      if (reward === null) return ctx.reply("❌ Invalid. Enter a number between 0 and 100:");
      value = reward;
    }
    if (s.editField === "url" && !isValidUrl(text)) {
      return ctx.reply("❌ Invalid URL. Must start with https://\nTry again:");
    }
    if (s.editField === "title" && (text.length < 2 || text.length > 80)) {
      return ctx.reply("❌ Name must be 2–80 characters. Try again:");
    }

    const { error } = await supabase
      .from("tasks")
      .update({ [s.editField]: value })
      .eq("id", s.editTaskId);

    ctx.session = {};
    if (error) return ctx.reply(`❌ Error: ${error.message}`);
    return ctx.reply("✅ Task updated successfully!");
  }
});

// Confirm add
bot.callbackQuery("add_confirm", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const s = ctx.session;

  if (!s.platform || !s.title || !s.url || s.points === undefined) {
    await ctx.editMessageText("❌ Session expired. Use /edit_task again.");
    return ctx.answerCallbackQuery();
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("platform", s.platform)
    .ilike("title", s.title)
    .limit(1);

  if (existing && existing.length > 0) {
    ctx.session = {};
    await ctx.editMessageText(`⚠️ A task named "${s.title}" already exists in ${s.platform}.\n\nNo duplicate added.`);
    return ctx.answerCallbackQuery();
  }

  // Get next sort_order
  const { data: last } = await supabase
    .from("tasks")
    .select("sort_order")
    .eq("platform", s.platform)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = (last?.[0]?.sort_order ?? 0) + 1;
  const taskReward = s.taskReward ?? 0;

  const { error } = await supabase.from("tasks").insert({
    platform:    s.platform,
    title:       s.title,
    url:         s.url,
    points:      s.points,
    task_reward: taskReward,
    status:      "active",
    sort_order:  nextOrder,
  });

  ctx.session = {};
  if (error) {
    await ctx.editMessageText(`❌ Error saving task: ${error.message}`);
  } else {
    const taskLine = taskReward > 0 ? ` & +${taskReward} Task(s)` : "";
    await ctx.editMessageText(
      `✅ Task added!\n\n${PLATFORM_EMOJI[s.platform!]} ${s.title}\n+${s.points} pts${taskLine}`
    );
  }
  await ctx.answerCallbackQuery();
});

// ═══════════════════════════════════════════════════
// ✏️ EDIT TASK FLOW
// ═══════════════════════════════════════════════════

bot.callbackQuery("menu_edit", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "edit_platform" };
  await ctx.editMessageText("✏️ Edit Task\n\nChoose platform:", {
    reply_markup: platformKeyboard("edit_plat"),
  });
  await ctx.answerCallbackQuery();
});

PLATFORMS.forEach((p) => {
  bot.callbackQuery(`edit_plat_${p}`, async (ctx) => {
    if (!await requireAdmin(ctx)) return;
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, points, task_reward, status")
      .eq("platform", p)
      .order("sort_order");

    if (!tasks || tasks.length === 0) {
      await ctx.editMessageText(`No tasks for ${PLATFORM_EMOJI[p]} ${p}.`);
      return ctx.answerCallbackQuery();
    }

    ctx.session = { step: "edit_task", platform: p };
    const kb = new InlineKeyboard();
    tasks.forEach((t: any) => {
      const icon = t.status === "active" ? "🟢" : "🔴";
      const taskInfo = t.task_reward > 0 ? ` +${t.task_reward}T` : "";
      kb.text(`${icon} ${t.title} (+${t.points}${taskInfo})`, `editsel_${t.id}`).row();
    });
    kb.text("❌ Cancel", "cancel");

    await ctx.editMessageText(
      `✏️ ${PLATFORM_EMOJI[p]} ${p} — Choose task:`,
      { reply_markup: kb }
    );
    await ctx.answerCallbackQuery();
  });
});

bot.callbackQuery(/^editsel_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const taskId = ctx.match[1];
  const { data: task } = await supabase
    .from("tasks").select("*").eq("id", taskId).single();

  if (!task) {
    await ctx.editMessageText("❌ Task not found.");
    return ctx.answerCallbackQuery();
  }

  ctx.session = { step: "edit_field", editTaskId: taskId };
  const kb = new InlineKeyboard()
    .text("📝 Title",       `editfield_${taskId}_title`).row()
    .text("🔗 URL",         `editfield_${taskId}_url`).row()
    .text("🎯 Points",      `editfield_${taskId}_points`).row()
    .text("⚡ Task Reward", `editfield_${taskId}_task_reward`).row()
    .text(
      task.status === "active" ? "🔴 Disable" : "🟢 Enable",
      `edittoggle_${taskId}`
    ).row()
    .text("❌ Cancel", "cancel");

  const taskLine = task.task_reward > 0 ? `\nTask Reward: +${task.task_reward} Task(s)` : "\nTask Reward: None";
  await ctx.editMessageText(
    `✏️ Editing: ${task.title}\n` +
    `Points: +${task.points}` +
    taskLine + `\n` +
    `Status: ${task.status === "active" ? "🟢 Active" : "🔴 Disabled"}`,
    { reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^editfield_(.+)_(title|url|points|task_reward)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const [, taskId, field] = ctx.match;
  ctx.session = { step: "edit_value", editTaskId: taskId, editField: field };
  const labels: Record<string, string> = {
    title:       "📝 Send the new title (2–80 chars):",
    url:         "🔗 Send the new URL (https://...):",
    points:      "🎯 Send the new points (1–100000):",
    task_reward: "⚡ Send the new task reward (0–100):\n(0 = no task reward)",
  };
  await ctx.editMessageText(labels[field]!);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^edittoggle_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const taskId = ctx.match[1];
  const { data: task } = await supabase
    .from("tasks").select("status, title").eq("id", taskId).single();

  if (!task) {
    await ctx.editMessageText("❌ Task not found.");
    return ctx.answerCallbackQuery();
  }

  const newStatus = task.status === "active" ? "disabled" : "active";
  await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
  ctx.session = {};
  await ctx.editMessageText(
    `✅ "${task.title}" is now ${newStatus === "active" ? "🟢 Active" : "🔴 Disabled"}`
  );
  await ctx.answerCallbackQuery();
});

// ═══════════════════════════════════════════════════
// 🚫 DISABLE TASK
// ═══════════════════════════════════════════════════

bot.callbackQuery("menu_disable", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "disable_platform" };
  await ctx.editMessageText("🚫 Disable Task\n\nChoose platform:", {
    reply_markup: platformKeyboard("dis_plat"),
  });
  await ctx.answerCallbackQuery();
});

PLATFORMS.forEach((p) => {
  bot.callbackQuery(`dis_plat_${p}`, async (ctx) => {
    if (!await requireAdmin(ctx)) return;
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, points")
      .eq("platform", p)
      .eq("status", "active")
      .order("sort_order");

    if (!tasks || tasks.length === 0) {
      await ctx.editMessageText(`No active tasks in ${PLATFORM_EMOJI[p]} ${p}.`);
      return ctx.answerCallbackQuery();
    }

    const kb = new InlineKeyboard();
    tasks.forEach((t: any) => {
      kb.text(`${t.title} (+${t.points})`, `disconfirm_${t.id}`).row();
    });
    kb.text("❌ Cancel", "cancel");

    await ctx.editMessageText(
      `🚫 Disable — ${PLATFORM_EMOJI[p]} ${p}\nChoose task:`,
      { reply_markup: kb }
    );
    await ctx.answerCallbackQuery();
  });
});

bot.callbackQuery(/^disconfirm_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const taskId = ctx.match[1];
  const { data: task } = await supabase
    .from("tasks").select("title").eq("id", taskId).single();

  await supabase.from("tasks").update({ status: "disabled" }).eq("id", taskId);
  ctx.session = {};
  await ctx.editMessageText(
    `🚫 "${task?.title}" disabled.\nUse ✏️ Edit → Enable to restore.`
  );
  await ctx.answerCallbackQuery();
});

// ═══════════════════════════════════════════════════
// 🗑 DELETE TASK
// ═══════════════════════════════════════════════════

bot.callbackQuery("menu_delete", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "delete_platform" };
  await ctx.editMessageText(
    "🗑 Delete Task (permanent)\n\n⚠️ Consider 🚫 Disable instead.\n\nChoose platform:",
    { reply_markup: platformKeyboard("del_plat") }
  );
  await ctx.answerCallbackQuery();
});

PLATFORMS.forEach((p) => {
  bot.callbackQuery(`del_plat_${p}`, async (ctx) => {
    if (!await requireAdmin(ctx)) return;
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, points, status")
      .eq("platform", p)
      .order("sort_order");

    if (!tasks || tasks.length === 0) {
      await ctx.editMessageText(`No tasks in ${PLATFORM_EMOJI[p]} ${p}.`);
      return ctx.answerCallbackQuery();
    }

    const kb = new InlineKeyboard();
    tasks.forEach((t: any) => {
      const icon = t.status === "active" ? "🟢" : "🔴";
      kb.text(`${icon} ${t.title} (+${t.points})`, `delsel_${t.id}`).row();
    });
    kb.text("❌ Cancel", "cancel");

    await ctx.editMessageText(
      `🗑 ${PLATFORM_EMOJI[p]} ${p} — Choose task to DELETE:`,
      { reply_markup: kb }
    );
    await ctx.answerCallbackQuery();
  });
});

bot.callbackQuery(/^delsel_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const taskId = ctx.match[1];
  const { data: task } = await supabase
    .from("tasks").select("title, points, platform").eq("id", taskId).single();

  if (!task) {
    await ctx.editMessageText("❌ Task not found.");
    return ctx.answerCallbackQuery();
  }

  const kb = new InlineKeyboard()
    .text("🗑 YES — Delete permanently", `delconfirm_${taskId}`).row()
    .text("🚫 Disable instead (safer)",  `disconfirm_${taskId}`).row()
    .text("❌ Cancel", "cancel");

  await ctx.editMessageText(
    `⚠️ DELETE "${task.title}"?\nPoints: +${task.points}\n\nThis CANNOT be undone.`,
    { reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^delconfirm_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const taskId = ctx.match[1];
  const { data: task } = await supabase
    .from("tasks").select("title").eq("id", taskId).single();

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  ctx.session = {};

  if (error) {
    await ctx.editMessageText(`❌ Error: ${error.message}`);
  } else {
    await ctx.editMessageText(`✅ "${task?.title}" permanently deleted.`);
  }
  await ctx.answerCallbackQuery();
});

// ═══════════════════════════════════════════════════
// 📋 VIEW TASKS
// ═══════════════════════════════════════════════════

bot.callbackQuery("menu_view", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .order("platform")
    .order("sort_order");

  if (!tasks || tasks.length === 0) {
    await ctx.editMessageText("📋 No tasks found.", {
      reply_markup: new InlineKeyboard().text("🔙 Back", "menu_back"),
    });
    return ctx.answerCallbackQuery();
  }

  let msg = "📋 All Tasks:\n\n";
  let cur = "";
  tasks.forEach((t: any) => {
    if (t.platform !== cur) {
      cur = t.platform;
      msg += `${PLATFORM_EMOJI[t.platform as Platform]} ${t.platform.toUpperCase()}\n`;
    }
    const icon = t.status === "active" ? "🟢" : "🔴";
    const taskInfo = t.task_reward > 0 ? ` +${t.task_reward}T` : "";
    msg += `  ${icon} ${t.title} (+${t.points}${taskInfo})\n`;
  });

  await ctx.editMessageText(msg, {
    reply_markup: new InlineKeyboard().text("🔙 Back", "menu_back"),
  });
  await ctx.answerCallbackQuery();
});


bot.callbackQuery("msg_confirm", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const s = ctx.session;
  if (!s.title || !s.msgBody) {
    await ctx.editMessageText("❌ Session expired. Use /message again.");
    return ctx.answerCallbackQuery();
  }
  const { error } = await supabase.from("announcements").insert({
    title:   s.title,
    message: s.msgBody,
  });
  ctx.session = {};
  if (error) {
    await ctx.editMessageText("❌ Error: " + error.message);
  } else {
    await ctx.editMessageText("✅ Announcement sent!\n\n📌 " + s.title);
  }
  await ctx.answerCallbackQuery();
});


// ─── START ──────────────────────────────────────────
void resumeCampaigns();
bot.start();
console.log(`✅ AZOX Admin Bot running (Admin: ${ADMIN_ID})`);
