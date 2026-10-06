// AZOX Admin Bot — TypeScript (Secured & Validated)
// grammy + @supabase/supabase-js

import { Bot, InlineKeyboard, session } from "grammy";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

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
  privKind?: "story" | "message";
  privRecipients?: number[];
  privLabels?: Record<string, string>;
  privNotes?: string;
  rcpKind?: "story" | "message";
  rcpId?: string;
  rcpMode?: "set" | "add";
}

// ─── BOT ────────────────────────────────────────────
const bot = new Bot<{ session: SessionData }>(BOT_TOKEN);
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
    await ctx.reply("👋 AZOX Admin Bot\n\nCommands:\n/edit_task — Manage tasks\n/message — Send announcement\n/edit_message — Edit announcements\n/share_story — Manage Story\n/edit_story — edit Story\n/story_privacy — Story Privacy\n/edit_story_privacy — Story Privacy\n/massage_privacy — Massage Privacy\n/edit_massage_privacy — Massage Privacy");
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

const STORY_BUCKET = "stories";
const STORY_MAX_BYTES = 20 * 1024 * 1024; // Telegram Bot API download limit
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
  const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`);
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// /share_story — step 1: ask for the media
bot.command("share_story", async (ctx) => {
  if (await denyNonAdmin(ctx)) return;
  ctx.session = { step: "story_media" };
  await ctx.reply(
    "📖 New Story\n\nSend the photo or video (max 20 MB).\nSupported: JPG, PNG, WEBP, MP4, WEBM, MOV.",
    { reply_markup: new InlineKeyboard().text("❌ Cancel", "cancel") }
  );
});

// step 1 (media received)
bot.on(["message:photo", "message:video", "message:animation", "message:document"], async (ctx) => {
  if (!isAdmin(ctx)) return;
  const s = ctx.session;
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
    return ctx.reply("❌ File is larger than 20 MB. Send a smaller one:");
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
  try {
    const buf = await downloadTelegramFile(s.storyFileId);
    if (buf.length > STORY_MAX_BYTES) throw new Error("File is larger than 20 MB");

    const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${s.storyExt}`;
    const { error: upErr } = await supabase.storage
      .from(STORY_BUCKET)
      .upload(path, buf, { contentType: s.storyMime, upsert: false });
    if (upErr) throw new Error(upErr.message);
    uploadedPath = path;

    const publicUrl = supabase.storage.from(STORY_BUCKET).getPublicUrl(path).data.publicUrl;
    const expiresAt = new Date(Date.now() + s.storyHours * 3600_000).toISOString();

    const row: Record<string, unknown> = {
      media_type:     s.storyKind,
      media_path:     path,
      media_url:      publicUrl,
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
      await supabase.storage.from(STORY_BUCKET).remove([uploadedPath]).catch(() => {});
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
  const { data: st } = await supabase.from("stories").select("media_path").eq("id", id).single();
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
    await supabase.storage.from(STORY_BUCKET).remove([st.media_path]).catch(() => {});
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
    "🔒 New Private Story\n\nSend the photo or video (max 20 MB).\nSupported: JPG, PNG, WEBP, MP4, WEBM, MOV.",
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
bot.start();
console.log(`✅ AZOX Admin Bot running (Admin: ${ADMIN_ID})`);
