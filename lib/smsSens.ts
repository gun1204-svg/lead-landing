import crypto from "crypto";

function makeSignature(method: string, url: string, timestamp: string) {
  const accessKey = process.env.NCP_ACCESS_KEY!;
  const secretKey = process.env.NCP_SECRET_KEY!;
  const space = " ";
  const newLine = "\n";

  const message = [method, space, url, newLine, timestamp, newLine, accessKey].join("");
  return crypto.createHmac("sha256", secretKey).update(message).digest("base64");
}

export async function sendSms(to: string, content: string) {
  const serviceId = process.env.NCP_SENS_SERVICE_ID!;
  const from = process.env.NCP_SENS_FROM!;

  const method = "POST";
  const urlPath = `/sms/v2/services/${serviceId}/messages`;
  const timestamp = Date.now().toString();
  const signature = makeSignature(method, urlPath, timestamp);

  const res = await fetch(`https://sens.apigw.ntruss.com${urlPath}`, {
    method,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "x-ncp-iam-access-key": process.env.NCP_ACCESS_KEY!,
      "x-ncp-apigw-timestamp": timestamp,
      "x-ncp-apigw-signature-v2": signature,
    },
    body: JSON.stringify({
      type: "SMS",
      from,
      content,
      messages: [{ to }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SENS send failed: ${res.status} ${txt}`);
  }
}
