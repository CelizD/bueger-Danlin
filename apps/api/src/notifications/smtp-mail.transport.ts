import {
  Injectable,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import * as net from "node:net";
import type { Socket } from "node:net";
import * as tls from "node:tls";
import type { TLSSocket } from "node:tls";

export type MailAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: MailAttachment[];
};

type SmtpSocket = Socket | TLSSocket;

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function enabled() {
  return [
    "1",
    "true",
    "yes",
    "on",
  ].includes(
    env("EMAIL_NOTIFICATIONS_ENABLED")
      .toLowerCase(),
  );
}

function sanitizeHeader(value: string) {
  if (/[\r\n]/.test(value)) {
    throw new Error(
      "Invalid mail header value.",
    );
  }

  return value;
}

function envelopeAddress(value: string) {
  const match =
    value.match(/<([^<>]+)>/);

  return (
    match?.[1] ?? value
  ).trim();
}

function encodeHeader(value: string) {
  return (
    "=?UTF-8?B?" +
    Buffer.from(value, "utf8")
      .toString("base64") +
    "?="
  );
}

function wrapBase64(
  value: Buffer,
) {
  return (
    value
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") ?? ""
  );
}

function mimeMessage(
  from: string,
  replyTo: string,
  message: MailMessage,
) {
  const safeFrom =
    sanitizeHeader(from);
  const safeReply =
    sanitizeHeader(replyTo);
  const safeTo =
    sanitizeHeader(message.to);
  const safeSubject =
    sanitizeHeader(message.subject);
  const mixed =
    "mix_" +
    randomUUID().replace(/-/g, "");
  const alt =
    "alt_" +
    randomUUID().replace(/-/g, "");

  const lines = [
    "MIME-Version: 1.0",
    "From: " + safeFrom,
    "To: " + safeTo,
    "Reply-To: " + safeReply,
    "Subject: " +
      encodeHeader(safeSubject),
    "Date: " +
      new Date().toUTCString(),
    "Content-Type: multipart/mixed; boundary=\"" +
      mixed +
      "\"",
    "",
    "--" + mixed,
    "Content-Type: multipart/alternative; boundary=\"" +
      alt +
      "\"",
    "",
    "--" + alt,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(
      Buffer.from(
        message.text,
        "utf8",
      ),
    ),
    "",
    "--" + alt,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(
      Buffer.from(
        message.html,
        "utf8",
      ),
    ),
    "",
    "--" + alt + "--",
  ];

  for (
    const attachment of
    message.attachments ?? []
  ) {
    const filename =
      sanitizeHeader(
        attachment.filename,
      );

    lines.push(
      "",
      "--" + mixed,
      "Content-Type: " +
        attachment.contentType +
        "; name=\"" +
        filename +
        "\"",
      "Content-Disposition: attachment; filename=\"" +
        filename +
        "\"",
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(
        attachment.content,
      ),
    );
  }

  lines.push(
    "",
    "--" + mixed + "--",
    "",
  );

  return lines.join("\r\n");
}

async function waitForResponse(
  socket: SmtpSocket,
  expected: number[],
) {
  return new Promise<string>(
    (resolve, reject) => {
      let buffer = "";

      const cleanup = () => {
        clearTimeout(timer);
        socket.off("data", onData);
        socket.off("error", onError);
        socket.off(
          "close",
          onClose,
        );
      };

      const timer = setTimeout(
        () => {
          cleanup();
          reject(
            new Error(
              "SMTP response timeout.",
            ),
          );
        },
        12_000,
      );

      const onError = (
        error: Error,
      ) => {
        cleanup();
        reject(error);
      };

      const onClose = () => {
        cleanup();
        reject(
          new Error(
            "SMTP connection closed unexpectedly.",
          ),
        );
      };

      const onData = (
        chunk: Buffer,
      ) => {
        buffer += chunk.toString(
          "utf8",
        );

        const lines =
          buffer.split(/\r?\n/);

        for (const line of lines) {
          const match =
            /^(\d{3})([ -])/.exec(
              line,
            );

          if (
            !match ||
            match[2] !== " "
          ) {
            continue;
          }

          const status =
            Number(match[1]);

          cleanup();

          if (
            !expected.includes(
              status,
            )
          ) {
            reject(
              new Error(
                "SMTP rejected request with status " +
                  status +
                  ".",
              ),
            );
            return;
          }

          resolve(buffer);
          return;
        }
      };

      socket.on("data", onData);
      socket.on("error", onError);
      socket.on("close", onClose);
    },
  );
}

async function command(
  socket: SmtpSocket,
  value: string,
  expected: number[],
) {
  socket.write(
    value + "\r\n",
    "utf8",
  );

  return waitForResponse(
    socket,
    expected,
  );
}

async function connectTcp(
  host: string,
  port: number,
) {
  const socket =
    net.createConnection({
      host,
      port,
    });

  await new Promise<void>(
    (resolve, reject) => {
      socket.once(
        "connect",
        resolve,
      );
      socket.once(
        "error",
        reject,
      );
    },
  );

  return socket;
}

async function connectTls(
  host: string,
  port: number,
  rejectUnauthorized: boolean,
) {
  const socket = tls.connect({
    host,
    port,
    servername: host,
    rejectUnauthorized,
  });

  await new Promise<void>(
    (resolve, reject) => {
      socket.once(
        "secureConnect",
        resolve,
      );
      socket.once(
        "error",
        reject,
      );
    },
  );

  return socket;
}

async function upgradeTls(
  socket: Socket,
  host: string,
  rejectUnauthorized: boolean,
) {
  const secure = tls.connect({
    socket,
    servername: host,
    rejectUnauthorized,
  });

  await new Promise<void>(
    (resolve, reject) => {
      secure.once(
        "secureConnect",
        resolve,
      );
      secure.once(
        "error",
        reject,
      );
    },
  );

  return secure;
}

async function authenticate(
  socket: SmtpSocket,
  username: string,
  password: string,
) {
  if (!username && !password) {
    return;
  }

  if (!username || !password) {
    throw new Error(
      "MAIL_USERNAME and MAIL_PASSWORD must be configured together.",
    );
  }

  const auth = Buffer.from(
    "\0" +
      username +
      "\0" +
      password,
    "utf8",
  ).toString("base64");

  await command(
    socket,
    "AUTH PLAIN " + auth,
    [235],
  );
}

function dotStuff(
  value: string,
) {
  return value.replace(
    /(^|\r\n)\./g,
    "$1..",
  );
}

@Injectable()
export class SmtpMailTransport {
  isEnabled() {
    return enabled();
  }

  async send(
    message: MailMessage,
  ) {
    if (!enabled()) {
      return {
        sent: false as const,
        disabled: true as const,
      };
    }

    const host =
      env("MAIL_HOST");
    const port =
      Number(env("MAIL_PORT"));
    const security =
      env("MAIL_SECURITY") ||
      "starttls";
    const username =
      env("MAIL_USERNAME");
    const password =
      env("MAIL_PASSWORD");
    const from =
      env("MAIL_FROM");
    const replyTo =
      env("MAIL_REPLY_TO") ||
      env("SUPPORT_EMAIL") ||
      envelopeAddress(from);
    const rejectUnauthorized =
      env(
        "MAIL_REJECT_UNAUTHORIZED",
      ).toLowerCase() !== "false";

    if (
      !host ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      !from
    ) {
      throw new Error(
        "SMTP configuration is incomplete.",
      );
    }

    if (
      ![
        "none",
        "starttls",
        "tls",
      ].includes(security)
    ) {
      throw new Error(
        "MAIL_SECURITY must be none, starttls or tls.",
      );
    }

    let socket: SmtpSocket =
      security === "tls"
        ? await connectTls(
            host,
            port,
            rejectUnauthorized,
          )
        : await connectTcp(
            host,
            port,
          );

    socket.setTimeout(
      15_000,
      () =>
        socket.destroy(
          new Error(
            "SMTP socket timeout.",
          ),
        ),
    );

    try {
      await waitForResponse(
        socket,
        [220],
      );

      await command(
        socket,
        "EHLO burger-danlin",
        [250],
      );

      if (
        security === "starttls"
      ) {
        await command(
          socket,
          "STARTTLS",
          [220],
        );

        socket = await upgradeTls(
          socket as Socket,
          host,
          rejectUnauthorized,
        );

        await command(
          socket,
          "EHLO burger-danlin",
          [250],
        );
      }

      await authenticate(
        socket,
        username,
        password,
      );

      await command(
        socket,
        "MAIL FROM:<" +
          envelopeAddress(from) +
          ">",
        [250],
      );

      await command(
        socket,
        "RCPT TO:<" +
          envelopeAddress(
            message.to,
          ) +
          ">",
        [250, 251],
      );

      await command(
        socket,
        "DATA",
        [354],
      );

      const raw = mimeMessage(
        from,
        replyTo,
        message,
      );

      socket.write(
        dotStuff(raw) +
          "\r\n.\r\n",
        "utf8",
      );

      await waitForResponse(
        socket,
        [250],
      );

      await command(
        socket,
        "QUIT",
        [221],
      ).catch(() => undefined);

      return {
        sent: true as const,
        disabled: false as const,
      };
    } finally {
      socket.end();
    }
  }
}

export const smtpTestExports = {
  mimeMessage,
};
