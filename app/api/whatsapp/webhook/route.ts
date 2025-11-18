import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

if (!VERIFY_TOKEN || !WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
  // eslint-disable-next-line no-console
  console.warn(
    "[WhatsApp Webhook] Missing WHATSAPP_VERIFY_TOKEN / WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID environment variables.",
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

type WhatsappMessage = {
  from: string;
  id: string;
  type: "text" | "image";
  text?: { body: string };
  image?: { id: string; caption?: string; mime_type?: string };
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ status: "invalid_json" }, { status: 400 });
  }

  const message: WhatsappMessage | undefined =
    body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message) {
    return NextResponse.json({ status: "no_message" });
  }

  const from = message.from;
  const textBody =
    message.type === "text"
      ? message.text?.body ?? ""
      : message.type === "image"
        ? message.image?.caption ?? ""
        : "";

  try {
    if (message.type === "image" && message.image?.id) {
      const { obraNumber, folderName } = parseInstruction(textBody);

      if (!obraNumber || !folderName) {
        await replyText(
          from,
          "No entendí la instrucción. Usá algo como: 'obra 12 carpeta planos'.",
        );
        return NextResponse.json({ status: "bad_instruction" });
      }

      const obraId = await findObraIdByNumber(obraNumber);
      if (!obraId) {
        await replyText(
          from,
          `No encontré la obra ${obraNumber}. Verificá el número.`,
        );
        return NextResponse.json({ status: "obra_not_found" });
      }

      const { arrayBuffer, mimeType } = await downloadWhatsappMedia(
        message.image.id,
      );

      const fileName = `${
        Date.now() / 1000
      }-${message.image.id}.${guessExtension(mimeType)}`;

      await uploadToObraFolder(
        obraId,
        folderName,
        fileName,
        arrayBuffer,
        mimeType,
      );

      await replyText(
        from,
        `Listo ✅ Subí tu foto a la obra ${obraNumber} en la carpeta '${folderName}'.`,
      );

      return NextResponse.json({ status: "ok" });
    }

    if (message.type === "text") {
      await replyText(
        from,
        "Mandame una foto con un mensaje tipo: 'obra 12 carpeta planos'.",
      );
      return NextResponse.json({ status: "ok_text" });
    }

    return NextResponse.json({ status: "ignored_type" });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[WhatsApp Webhook] Error handling POST", error);
    await replyText(
      from,
      "Ocurrió un error subiendo tu archivo. Probá de nuevo más tarde.",
    );
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

function parseInstruction(text: string): {
  obraNumber?: number;
  folderName?: string;
} {
  const lower = text.toLowerCase();

  const obraMatch = lower.match(/obra\s+(\d+)/);
  const obraNumber = obraMatch ? Number(obraMatch[1]) : undefined;

  let folderName: string | undefined;
  const carpetaIndex = lower.indexOf("carpeta");
  if (carpetaIndex !== -1) {
    const after = lower.slice(carpetaIndex + "carpeta".length).trim();
    if (after) {
      const cleaned = after
        .split(/[.!?,]/)[0]
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-_]/g, "");
      if (cleaned) {
        folderName = cleaned;
      }
    }
  }

  return { obraNumber, folderName };
}

async function findObraIdByNumber(obraNumber: number): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("obras")
    .select("id")
    .eq("n", obraNumber)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error("[WhatsApp Webhook] Error fetching obra", obraNumber, error);
    return null;
  }

  return (data as { id: string }).id;
}

async function downloadWhatsappMedia(mediaId: string): Promise<{
  arrayBuffer: ArrayBuffer;
  mimeType: string;
}> {
  if (!WHATSAPP_TOKEN) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is not configured");
  }

  const metaRes = await fetch(
    `https://graph.facebook.com/v22.0/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
    },
  );

  if (!metaRes.ok) {
    const text = await metaRes.text();
    throw new Error(
      `Failed to get WhatsApp media metadata: ${metaRes.status} ${text}`,
    );
  }

  const meta = (await metaRes.json()) as {
    url: string;
    mime_type?: string;
  };

  const url = meta.url;
  const mimeType = meta.mime_type ?? "image/jpeg";

  const fileRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    },
  });

  if (!fileRes.ok) {
    const text = await fileRes.text();
    throw new Error(
      `Failed to download WhatsApp media: ${fileRes.status} ${text}`,
    );
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  return { arrayBuffer, mimeType };
}

function guessExtension(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  return "jpg";
}

async function uploadToObraFolder(
  obraId: string,
  folderName: string,
  fileName: string,
  arrayBuffer: ArrayBuffer,
  mimeType: string,
) {
  const supabase = createSupabaseAdminClient();
  const bucket = "obra-documents";
  const filePath = `${obraId}/${folderName}/${fileName}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, arrayBuffer, {
      contentType: mimeType,
    });

  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[WhatsApp Webhook] Error uploading to obra-documents",
      error,
    );
    throw error;
  }
}

async function replyText(to: string, body: string) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    // eslint-disable-next-line no-console
    console.warn(
      "[WhatsApp Webhook] Missing token or phone id, cannot reply",
    );
    return;
  }

  const res = await fetch(
    `https://graph.facebook.com/v22.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    },
  );

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error(
      "[WhatsApp Webhook] Failed sending WhatsApp message",
      res.status,
      await res.text(),
    );
  }
}


