import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startTestPg, startApiServer } from "../lib/test-pg.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "..", "..", "dist");

type GameResponse = {
  game: {
    id: string;
    title: string;
    titleNormalized: string;
    platform: string;
    status: string;
  };
};

type ErrorResponse = { error: string };

type GameOrError = GameResponse | ErrorResponse;

let seedCounter = 0;

function nextSeed(): string {
  seedCounter += 1;
  return `${Date.now()}_${seedCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Compatibility helper: returns the list of columns currently present in the
 * `accounts` table. This lets the test fixture survive both the post-0002
 * schema (which still has legacy NOT NULL columns) and the future post-0003
 * schema (which will drop them). No production code uses this.
 */
function getAccountColumns(databaseUrl: string): string[] {
  const sql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'accounts' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `;
  const output = execSync(`psql "${databaseUrl}" -At -c "${sql}"`, {
    encoding: "utf-8",
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Seed a minimal Account row directly in the test database so Game guard tests
 * can exercise the "accounts exist for this game" branch.
 *
 * The fixture inspects the actual `accounts` columns and only supplies synthetic
 * values for legacy credential columns while they still exist (post-0002). Once
 * migration 0003 removes those columns, the same INSERT will continue to work
 * without a rewrite. All values are disposable, non-sensitive test data.
 */
function seedAccountForGame(
  databaseUrl: string,
  gameId: string,
): { id: string } {
  const seed = nextSeed();
  const columns = getAccountColumns(databaseUrl);

  const baseColumns = [
    "game_id",
    "account_code",
    "account_number_prefix",
    "account_number_seq",
    "display_number",
  ];

  const legacyColumns = [
    "email",
    "email_normalized",
    "playstation_password_encrypted",
    "email_password_encrypted",
  ];

  const presentLegacyColumns = legacyColumns.filter((col) =>
    columns.includes(col),
  );
  const insertColumns = [...baseColumns, ...presentLegacyColumns];

  const values = [
    `'${gameId}'`,
    `'ACC-${seed}'`,
    `'SEED'`,
    `${seedCounter}`,
    `'SEED-${seed}'`,
    ...presentLegacyColumns.map((col) =>
      col === "email" || col === "email_normalized"
        ? `'seed-${seed}@example.com'`
        : `'x'`,
    ),
  ];

  const sql = `
    INSERT INTO "accounts" (
      ${insertColumns.map((col) => `"${col}"`).join(", ")}
    ) VALUES (
      ${values.join(", ")}
    ) RETURNING "id";
  `;

  const output = execSync(`psql "${databaseUrl}" -c "${sql}"`, {
    encoding: "utf-8",
  });
  const match = output.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  if (!match) throw new Error("Failed to seed account");
  return { id: match[1] };
}

function runSql(databaseUrl: string, sql: string) {
  execSync(`psql "${databaseUrl}" -c "${sql}"`, { stdio: "ignore" });
}

function assertGame(data: GameOrError): GameResponse["game"] {
  assert.ok(
    "game" in data,
    "expected game response, got error: " +
      ("error" in data ? data.error : ""),
  );
  return data.game;
}

describe("Games API", () => {
  let baseUrl: string;
  let databaseUrl: string;
  let stopServer: () => Promise<void>;
  let stopPg: () => Promise<void>;

  before(async () => {
    const { databaseUrl: dbUrl, stop: stopPgFn } = await startTestPg();
    databaseUrl = dbUrl;
    stopPg = stopPgFn;

    // Build the server so the test can run it as a subprocess. The raw
    // TypeScript source is not directly importable from node --test because of
    // directory/no-extension imports used across the codebase.
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
  });

  after(async () => {
    await stopServer();
    await stopPg();
  });

  async function createGame(title: string, platform: string, status?: string) {
    const body: Record<string, string> = { title, platform };
    if (status) body.status = status;
    const res = await fetch(`${baseUrl}/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { res, data: (await res.json()) as GameOrError };
  }

  async function updateGame(id: string, body: object) {
    const res = await fetch(`${baseUrl}/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { res, data: (await res.json()) as GameOrError };
  }

  async function deleteGame(id: string) {
    const res = await fetch(`${baseUrl}/games/${id}`, {
      method: "DELETE",
    });
    return { res, data: (await res.json()) as { ok: boolean } | ErrorResponse };
  }

  it("creates a game successfully and returns a valid game id", async () => {
    const { res, data } = await createGame("FC 26", "PS5_ONLY");
    assert.strictEqual(res.status, 201);
    const game = assertGame(data);
    assert.strictEqual(game.title, "FC 26");
    assert.strictEqual(game.titleNormalized, "fc 26");
    assert.strictEqual(game.platform, "PS5_ONLY");
    assert.strictEqual(game.status, "ACTIVE");

    // The returned game id must be a valid UUID and the game must be
    // retrievable; a follow-up 404 here would mean the create path is broken.
    const getRes = await fetch(`${baseUrl}/games/${game.id}`);
    assert.strictEqual(getRes.status, 200);
    const getData = (await getRes.json()) as GameResponse;
    assert.strictEqual(getData.game.id, game.id);
  });

  it("created game appears in the games list", async () => {
    const { data: createData } = await createGame("Listable Game", "PS5_ONLY");
    const created = assertGame(createData);

    const res = await fetch(`${baseUrl}/games`);
    const data = (await res.json()) as { games: { id: string; title: string }[] };
    assert.strictEqual(res.status, 200);
    const found = data.games.find((g) => g.id === created.id);
    assert.ok(found, "created game should appear in the list");
    assert.strictEqual(found.title, "Listable Game");
  });

  it("POST /games never returns 404 for normal creation failures", async () => {
    // Validation failure must be 400, not 404.
    const whitespaceRes = await fetch(`${baseUrl}/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "   ", platform: "PS5_ONLY" }),
    });
    assert.notStrictEqual(whitespaceRes.status, 404);
    assert.strictEqual(whitespaceRes.status, 400);

    // Duplicate conflict must be 409, not 404.
    await createGame("Unique For 404 Check", "PS5_ONLY");
    const duplicateRes = await fetch(`${baseUrl}/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Unique For 404 Check", platform: "PS4_ONLY" }),
    });
    assert.notStrictEqual(duplicateRes.status, 404);
    assert.strictEqual(duplicateRes.status, 409);
  });

  it("rejects duplicate normalized titles", async () => {
    await createGame("Duplicate Title", "PS5_ONLY");
    const { res, data } = await createGame(" Duplicate Title ", "PS4_ONLY");
    assert.strictEqual(res.status, 409);
    assert.ok("error" in data);
    assert.strictEqual(data.error, "A game with this title already exists");
    assert.ok(!data.error.includes("23505"));
  });

  it("rejects whitespace-only titles on create", async () => {
    const { res, data } = await createGame("   ", "PS5_ONLY");
    assert.strictEqual(res.status, 400);
    assert.ok("error" in data);
  });

  it("rejects whitespace-only titles on update", async () => {
    const { data: createData } = await createGame("Whitespace Update", "PS5_ONLY");
    const game = assertGame(createData);
    const { res, data } = await updateGame(game.id, { title: "\t\n" });
    assert.strictEqual(res.status, 400);
    assert.ok("error" in data);
  });

  it("collapses repeated internal spaces in the stored title", async () => {
    const { res, data } = await createGame("Collapse   Title", "PS5_ONLY");
    assert.strictEqual(res.status, 201);
    const game = assertGame(data);
    assert.strictEqual(game.title, "Collapse Title");
    assert.strictEqual(game.titleNormalized, "collapse title");
  });

  it("rejects invalid UUID with 400", async () => {
    const res = await fetch(`${baseUrl}/games/not-a-uuid`);
    assert.strictEqual(res.status, 400);
    const data = (await res.json()) as ErrorResponse;
    assert.ok(data.error);
  });

  it("returns 404 for missing game", async () => {
    const res = await fetch(
      `${baseUrl}/games/550e8400-e29b-41d4-a716-446655440000`,
    );
    assert.strictEqual(res.status, 404);
  });

  it("allows platform change without account history", async () => {
    const { data: createData } = await createGame("Platform Change", "PS4_ONLY");
    const game = assertGame(createData);
    const { res, data } = await updateGame(game.id, {
      platform: "PS5_ONLY",
    });
    assert.strictEqual(res.status, 200);
    const updated = assertGame(data);
    assert.strictEqual(updated.platform, "PS5_ONLY");
  });

  it("blocks platform change with active account history", async () => {
    const { data: createData } = await createGame("Platform Lock", "PS4_ONLY");
    const game = assertGame(createData);

    seedAccountForGame(databaseUrl, game.id);

    const { res, data } = await updateGame(game.id, { platform: "PS5_ONLY" });
    assert.strictEqual(res.status, 409);
    assert.ok("error" in data);
    assert.strictEqual(
      data.error,
      "Cannot change platform after accounts exist for this game",
    );
  });

  it("allows same-platform update when an account exists", async () => {
    const { data: createData } = await createGame("Same Platform", "PS4_ONLY");
    const game = assertGame(createData);

    seedAccountForGame(databaseUrl, game.id);

    const { res, data } = await updateGame(game.id, {
      platform: "PS4_ONLY",
      status: "INACTIVE",
    });
    assert.strictEqual(res.status, 200);
    const updated = assertGame(data);
    assert.strictEqual(updated.platform, "PS4_ONLY");
    assert.strictEqual(updated.status, "INACTIVE");
  });

  it("blocks platform change with a soft-deleted account", async () => {
    const { data: createData } = await createGame("Soft Delete Lock", "PS4_ONLY");
    const game = assertGame(createData);

    const account = seedAccountForGame(databaseUrl, game.id);
    runSql(
      databaseUrl,
      `UPDATE "accounts" SET "deleted_at" = now() WHERE "id" = '${account.id}';`,
    );

    const { res, data } = await updateGame(game.id, { platform: "PS5_ONLY" });
    assert.strictEqual(res.status, 409);
    assert.ok("error" in data);
    assert.strictEqual(
      data.error,
      "Cannot change platform after accounts exist for this game",
    );
  });

  it("changes status from ACTIVE to INACTIVE", async () => {
    const { data: createData } = await createGame("Status Change", "PS5_ONLY");
    const game = assertGame(createData);
    const { res, data } = await updateGame(game.id, {
      status: "INACTIVE",
    });
    assert.strictEqual(res.status, 200);
    const updated = assertGame(data);
    assert.strictEqual(updated.status, "INACTIVE");
  });

  it("allows hard delete without history", async () => {
    const { data: createData } = await createGame("Delete Allowed", "PS5_ONLY");
    const game = assertGame(createData);
    const { res } = await deleteGame(game.id);
    assert.strictEqual(res.status, 200);
    const getRes = await fetch(`${baseUrl}/games/${game.id}`);
    assert.strictEqual(getRes.status, 404);
  });

  it("blocks hard delete with active account history", async () => {
    const { data: createData } = await createGame("Delete Lock", "PS5_ONLY");
    const game = assertGame(createData);

    seedAccountForGame(databaseUrl, game.id);

    const { res, data } = await deleteGame(game.id);
    assert.strictEqual(res.status, 409);
    assert.ok("error" in data);
    assert.strictEqual(
      data.error,
      "Cannot delete game while accounts exist; mark it inactive instead",
    );
  });

  it("blocks hard delete with a soft-deleted account", async () => {
    const { data: createData } = await createGame(
      "Soft Delete Delete",
      "PS5_ONLY",
    );
    const game = assertGame(createData);

    const account = seedAccountForGame(databaseUrl, game.id);
    runSql(
      databaseUrl,
      `UPDATE "accounts" SET "deleted_at" = now() WHERE "id" = '${account.id}';`,
    );

    const { res, data } = await deleteGame(game.id);
    assert.strictEqual(res.status, 409);
    assert.ok("error" in data);
    assert.strictEqual(
      data.error,
      "Cannot delete game while accounts exist; mark it inactive instead",
    );
  });

  it("enforces global normalized-title uniqueness across soft-deleted games", async () => {
    const { data: createData } = await createGame("Global Unique", "PS5_ONLY");
    const game = assertGame(createData);
    runSql(
      databaseUrl,
      `UPDATE "games" SET "deleted_at" = now() WHERE "id" = '${game.id}';`,
    );

    const { res, data } = await createGame("Global Unique", "PS4_ONLY");
    assert.strictEqual(res.status, 409);
    assert.ok("error" in data);
    assert.strictEqual(data.error, "A game with this title already exists");
  });

  it("lists all games including inactive ones", async () => {
    const { data: g1 } = await createGame("List Inactive", "PS5_ONLY");
    const inactiveGame = assertGame(g1);
    await updateGame(inactiveGame.id, { status: "INACTIVE" });
    await createGame("List Active", "PS5_ONLY");

    const res = await fetch(`${baseUrl}/games`);
    const data = (await res.json()) as { games: { title: string }[] };
    assert.strictEqual(res.status, 200);
    const titles = data.games.map((g) => g.title);
    assert.ok(titles.includes("List Inactive"));
    assert.ok(titles.includes("List Active"));
  });
});
