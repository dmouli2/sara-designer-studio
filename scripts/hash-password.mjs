// One-off CLI helper to bcrypt-hash a password for manual staff seeding/resets.
// Usage: node scripts/hash-password.mjs <plaintext-password>
import bcrypt from "bcryptjs";

const plain = process.argv[2];
if (!plain) {
  console.error("Usage: node scripts/hash-password.mjs <plaintext-password>");
  process.exit(1);
}

const hash = await bcrypt.hash(plain, 10);
console.log(hash);
