/* ============ Anchor — encrypted backup ============
   One file, encrypted with a passphrase the user chooses.
   WebCrypto only: PBKDF2-SHA256 → AES-256-GCM. No network, ever.

   File layout:  "ANCHORBK" (8) · version (1) · salt (16) · iv (12) · ciphertext */
"use strict";

const AnchorBackup = (() => {
  const MAGIC = "ANCHORBK";
  const VERSION = 1;
  const ITERATIONS = 310000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function available() {
    return !!(window.crypto && crypto.subtle && crypto.getRandomValues);
  }

  async function deriveKey(passphrase, salt) {
    const base = await crypto.subtle.importKey(
      "raw", enc.encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  /* plain object → Blob (the backup file) */
  async function encrypt(payload, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const plaintext = enc.encode(JSON.stringify(payload));
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
    const header = enc.encode(MAGIC);
    const out = new Uint8Array(header.length + 1 + salt.length + iv.length + cipher.length);
    let o = 0;
    out.set(header, o); o += header.length;
    out[o++] = VERSION;
    out.set(salt, o); o += salt.length;
    out.set(iv, o); o += iv.length;
    out.set(cipher, o);
    return new Blob([out], { type: "application/octet-stream" });
  }

  /* ArrayBuffer (file contents) → plain object. Throws on wrong passphrase. */
  async function decrypt(buffer, passphrase) {
    const bytes = new Uint8Array(buffer);
    const header = dec.decode(bytes.slice(0, MAGIC.length));
    if (header !== MAGIC) throw new Error("not-a-backup");
    const version = bytes[MAGIC.length];
    if (version !== VERSION) throw new Error("unknown-version");
    let o = MAGIC.length + 1;
    const salt = bytes.slice(o, o + 16); o += 16;
    const iv = bytes.slice(o, o + 12); o += 12;
    const cipher = bytes.slice(o);
    const key = await deriveKey(passphrase, salt);
    let plain;
    try {
      plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    } catch {
      throw new Error("wrong-passphrase");
    }
    return JSON.parse(dec.decode(plain));
  }

  /* Blob ⇄ { type, b64 } so audio can ride inside the JSON payload */
  function blobToRecord(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result);
        resolve({ type: blob.type || "application/octet-stream", b64: s.slice(s.indexOf(",") + 1) });
      };
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  function recordToBlob(rec) {
    if (!rec || typeof rec.b64 !== "string") return null;
    const bin = atob(rec.b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: rec.type || "application/octet-stream" });
  }

  function fileName(date) {
    const d = date || new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `anchor-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.anchor`;
  }

  return { available, encrypt, decrypt, blobToRecord, recordToBlob, fileName, ITERATIONS };
})();
