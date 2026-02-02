export function generateItemId(): string {
  // Generate 6-digit random ID
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateShortCode(): string {
  // Generate 4-character short code
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
