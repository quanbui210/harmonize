type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

function getSendGridApiKey() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("SENDGRID_API_KEY is not configured");
  }
  return apiKey;
}

function getSendGridFromEmail() {
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!fromEmail || fromEmail.trim().length === 0) {
    throw new Error("SENDGRID_FROM_EMAIL is not configured");
  }
  return fromEmail;
}

export async function sendEmailWithSendGrid(input: SendEmailInput) {
  const apiKey = getSendGridApiKey();
  const fromEmail = getSendGridFromEmail();

  const response = await fetch(SENDGRID_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: input.to }],
          subject: input.subject,
        },
      ],
      from: {
        email: fromEmail,
        name: "Harmonize AI",
      },
      content: [
        { type: "text/plain", value: input.text },
        { type: "text/html", value: input.html },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `SendGrid email send failed (${response.status}): ${errorBody.slice(0, 400)}`
    );
  }
}
