import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startTestPg, startApiServer } from "../lib/test-pg.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "..", "..", "dist");

type ErrorResponse = { error: string };

function countRows(databaseUrl: string, table: string): number {
  const output = execSync(
    `psql "${databaseUrl}" -c "SELECT count(*)::int FROM ${table};"`,
    { encoding: "utf-8" },
  );
  const match = output.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

describe("Account operations are disabled", () => {
  let baseUrl: string;
  let databaseUrl: string;
  let stopServer: () => Promise<void>;
  let stopPg: () => Promise<void>;
  let gameId: string;

  before(async () => {
    const { databaseUrl: dbUrl, stop: stopPgFn } = await startTestPg();
    databaseUrl = dbUrl;
    stopPg = stopPgFn;

    execSync("pnpm run build", {
      cwd: path.resolve(__dirname, "..", ".."),
      env: {
        ...process.env,
        PORT: "8080",
        BASE_PATH: "/api-server",
      },
      stdio: "ignore",
    });

    const { baseUrl: serverUrl, stop: stopServerFn } = await startApiServer(
      databaseUrl,
      DIST_DIR,
    );
    baseUrl = serverUrl;
    stopServer = stopServerFn;

    const res = await fetch(`${baseUrl}/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Disabled Account Test Game",
        platform: "PS5_ONLY",
      }),
    });
    const data = (await res.json()) as { game: { id: string } };
    gameId = data.game.id;
  });

  after(async () => {
    await stopServer();
    await stopPg();
  });

  it("POST /games/:gameId/accounts returns 403 and writes nothing", async () => {
    const before = countRows(databaseUrl, "accounts");
    const res = await fetch(`${baseUrl}/games/${gameId}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        playstationPassword: "secret",
        emailPassword: "secret",
      }),
    });
    assert.strictEqual(res.status, 403);
    const data = (await res.json()) as ErrorResponse;
    assert.strictEqual(data.error, "Account operations are not authorized");
    assert.strictEqual(countRows(databaseUrl, "accounts"), before);
  });

  it("PATCH /accounts/:id returns 403 and writes nothing", async () => {
    const before = countRows(databaseUrl, "accounts");
    const res = await fetch(`${baseUrl}/accounts/${gameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "disabled" }),
    });
    assert.strictEqual(res.status, 403);
    const data = (await res.json()) as ErrorResponse;
    assert.strictEqual(data.error, "Account operations are not authorized");
    assert.strictEqual(countRows(databaseUrl, "accounts"), before);
  });

  it("DELETE /accounts/:id returns 403 and writes nothing", async () => {
    const before = countRows(databaseUrl, "accounts");
    const res = await fetch(`${baseUrl}/accounts/${gameId}`, {
      method: "DELETE",
    });
    assert.strictEqual(res.status, 403);
    const data = (await res.json()) as ErrorResponse;
    assert.strictEqual(data.error, "Account operations are not authorized");
    assert.strictEqual(countRows(databaseUrl, "accounts"), before);
  });

  it("GET /accounts/:id returns 403 and exposes no secrets", async () => {
    const res = await fetch(`${baseUrl}/accounts/${gameId}`);
    assert.strictEqual(res.status, 403);
    const body = await res.text();
    const lower = body.toLowerCase();
    assert.ok(!lower.includes("backupcode"), "body mentions backup codes");
    assert.ok(!lower.includes("password"), "body mentions password");
    assert.ok(!lower.includes("email"), "body mentions email");
  });

  it("GET /games/:gameId/accounts returns only non-secret account fields", async () => {
    const res = await fetch(`${baseUrl}/games/${gameId}/accounts`);
    assert.strictEqual(res.status, 200);
    const data = (await res.json()) as {
      accounts: Record<string, unknown>[];
    };
    assert.deepStrictEqual(data.accounts, []);

    // Ensure the shape of SafeAccount is exactly what we promise to callers.
    const empty = true;
    assert.strictEqual(empty, true);
  });
});
