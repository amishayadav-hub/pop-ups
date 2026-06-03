import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import * as path from "path";
import * as fs from "fs";

const KEY_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  path.join(__dirname, "service-account.json");

if (!fs.existsSync(KEY_PATH)) {
  console.error(
    `Service account key not found at ${KEY_PATH}.\n` +
      `Download one from Firebase console → Project settings → Service accounts → Generate new private key.`,
  );
  process.exit(1);
}

const [, , emailArg, passwordArg] = process.argv;

if (!emailArg || !passwordArg) {
  console.error("Usage: npm run create-admin <email> <password>");
  console.error("Example: npm run create-admin amisha.yadav@anveshan.farm Sup3rSecret!");
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const password = passwordArg;

if (password.length < 6) {
  console.error("Password must be at least 6 characters (Firebase requirement).");
  process.exit(1);
}

initializeApp({ credential: cert(KEY_PATH) });
const adminAuth = getAuth();

async function main() {
  let uid: string;
  let created = false;

  try {
    const existing = await adminAuth.getUserByEmail(email);
    uid = existing.uid;
    await adminAuth.updateUser(uid, { password, emailVerified: true });
    console.log(`✓ Updated existing user: ${email}  (uid: ${uid})`);
  } catch (e: any) {
    if (e?.code === "auth/user-not-found") {
      const created_user = await adminAuth.createUser({
        email,
        password,
        emailVerified: true,
      });
      uid = created_user.uid;
      created = true;
      console.log(`✓ Created new user: ${email}  (uid: ${uid})`);
    } else {
      throw e;
    }
  }

  await adminAuth.setCustomUserClaims(uid, { admin: true });
  console.log(`✓ Granted admin custom claim`);

  console.log("\n=================================================");
  console.log(`  ${created ? "NEW ADMIN CREATED" : "ADMIN UPDATED"}`);
  console.log("=================================================");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  uid:      ${uid}`);
  console.log("=================================================\n");
  console.log("Sign in at the dashboard with the email/password above.");
  console.log("If you were already signed in, sign out and sign in again");
  console.log("(token needs to refresh to pick up the new claim).\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
