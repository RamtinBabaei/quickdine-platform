const encoder = new TextEncoder();
export const digest = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
export async function hashPassword(
  password: string,
  salt = crypto.randomUUID(),
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return `${salt}:${Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}
export async function verifyPassword(password: string, hash: string) {
  const candidate = await hashPassword(password, hash.split(":")[0]);
  let diff = candidate.length ^ hash.length;
  for (let i = 0; i < candidate.length; i++)
    diff |= candidate.charCodeAt(i) ^ (hash.charCodeAt(i) || 0);
  return diff === 0;
}
