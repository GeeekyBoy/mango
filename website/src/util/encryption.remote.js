// A function that encrypts a string using RSA encryption
import crypto from "crypto";

const algorithm = "aes-256-cbc";
const iv = crypto.randomBytes(16);
const secretKey = "vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3";

export async function encrypt(msg) {
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
  let encryptedMsg = cipher.update(msg, "utf8", "hex");
  encryptedMsg += cipher.final("hex");
  return encryptedMsg;
}

export async function decrypt(encryptedMsg) {
  try  {
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
    let decryptedMsg = decipher.update(encryptedMsg, "hex", "utf8");
    decryptedMsg += decipher.final("utf8");
    return decryptedMsg;
  } catch (err) {
    throw new Error("Invalid encrypted message");
  }
}

