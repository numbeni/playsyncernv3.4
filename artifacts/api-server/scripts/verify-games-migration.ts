import { execSync } from "node:child_process";
import { startTestPg } from "../src/lib/test-pg.ts";

async function verify() {
  const { databaseUrl, stop } = await startTestPg();
  try {
    const out = execSync(
      `psql "${databaseUrl}" -P pager=off -c "\\d games"`,
      { encoding: "utf-8" },
    );
    console.log(out);

    const checks = [
      "title_normalized",
      "games_title_normalized_uniq",
      "status",
      "platform",
    ];
    for (const check of checks) {
      if (!out.includes(check)) {
        throw new Error(`Migration verification failed: missing ${check}`);
      }
    }
    console.log("Migration verification passed: games table schema is correct");
  } finally {
    await stop();
  }
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
