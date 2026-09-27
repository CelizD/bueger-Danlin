import "dotenv/config";
import { readFileSync } from "node:fs";

function setting(name: string) {
  const direct = process.env[name]?.trim();

  if (direct) return direct;

  const file = process.env[`${name}_FILE`]?.trim();

  if (!file) return undefined;

  const value = readFileSync(file, "utf8").trim();
  return value || undefined;
}

async function main() {
  const token = setting("TELEGRAM_BOT_TOKEN");
  const chatId = setting("TELEGRAM_CHAT_ID");

  if (!token || !chatId) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID or their *_FILE variants are required",
    );
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: [
          "✅ Telegram conectado",
          "Burger Danlin puede enviar pedidos y alertas.",
          `Prueba: ${new Date().toISOString()}`,
        ].join("\n"),
        disable_web_page_preview: true,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Telegram test failed with HTTP ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  console.log("Telegram test message sent successfully.");
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
