import "dotenv/config";
import { createMailerTransport, mailConfigurationError } from "../src/lib/mailer-transport";

const recipient = process.argv[2]?.trim();
if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
  console.error("Usage: npx tsx scripts/test-email.ts recipient@example.com");
  process.exit(1);
}

const configurationError = mailConfigurationError();
if (configurationError) {
  console.error(configurationError);
  process.exit(1);
}

async function main() {
  const transporter = createMailerTransport();
  try {
    await transporter.verify();
    const result = await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME || "SJAA Student ID System"}" <${process.env.MAIL_FROM_ADDRESS}>`,
      to: recipient,
      subject: "SJAA Student ID System — SMTP test",
      text: "This test message confirms that the SJAA Student ID System can submit email through its configured SMTP server.",
    });
    console.log(`SMTP accepted the test message for ${recipient}.`);
    console.log(`Message ID: ${result.messageId}`);
    console.log("Check the recipient inbox and spam folder to confirm delivery.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMTP error.";
    const secrets = [process.env.MAIL_USERNAME, process.env.MAIL_PASSWORD].filter(
      (secret): secret is string => Boolean(secret),
    );
    const safeMessage = secrets.reduce<string>(
      (current, secret) => current.replaceAll(secret, "[redacted]"),
      message,
    );
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "SMTP_ERROR";
    console.error(`SMTP test failed (${code}): ${safeMessage}`);
    process.exitCode = 1;
  } finally {
    transporter.close();
  }
}

void main();
