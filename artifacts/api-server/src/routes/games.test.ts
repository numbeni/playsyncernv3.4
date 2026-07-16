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

async function createAccountForGame(
  baseUrl: string,
  gameId: string,
  email: string,
) {
  const res = await fetch(`${baseUrl}/games/${gameId}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      playstationPassword: "secret",
      emailPassword: "secret",
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to create account for test setup: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as { account: { id: string } };
}

function runSql(databaseUrl: string, sql: string) {
  execSync(`psql "${databaseUrl}" -c "${sql}"`, { stdio: "ignore" });
}

function assertGame(data: GameOrError): GameResponse["game"] {
  assert.ok("game" in data, "expected game response, got error: " + ("error" in data ? data.error : ""));
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

  it("creates a game successfully", async () => {
    const { res, data } = await createGame("FC 26", "PS5_ONLY");
    assert.strictEqual(res.status, 201);
    const game = assertGame(data);
    assert.strictEqual(game.title, "FC 26");
    assert.strictEqual(game.titleNormalized, "fc 26");
    assert.strictEqual(game.platform, "PS5_ONLY");
    assert.strictEqual(game.status, "ACTIVE");
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

    await createAccountForGame(baseUrl, game.id, "platform-lock@example.com");

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

    await createAccountForGame(baseUrl, game.id, "same-platform@example.com");

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

    const { account } = await createAccountForGame(
      baseUrl,
      game.id,
      "soft-delete-lock@example.com",
    );
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

    await createAccountForGame(baseUrl, game.id, "delete-lock@example.com");

    const { res, data } = await deleteGame(game.id);
    assert.strictEqual(res.status, 409);
    assert.ok("error" in data);
    assert.strictEqual(
      data.error,
      "Cannot delete game while accounts exist; mark it inactive instead",
    );
  });

  it("blocks hard delete with a soft-deleted account", async () => {
    const { data: createData } = await createGame("Soft Delete Delete", "PS5_ONLY");
    const game = assertGame(createData);

    const { account } = await createAccountForGame(
      baseUrl,
      game.id,
      "soft-delete-delete@example.com",
    );
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

  it("never creates an account with capacities from a stale platform under concurrency", async () => {
    // The lock winner is nondeterministic, so repeat a few times to exercise
    // both orderings. The invariant is: after both operations complete, the
    // account capacities must match the final committed game platform.
    for (let i = 0; i < 5; i++) {
      const { data: createData } = await createGame(
        `Concurrency Race ${i}`,
        "PS4_ONLY",
      );
      const game = assertGame(createData);

      const accountPromise = createAccountForGame(
        baseUrl,
        game.id,
        `concurrency-${i}@example.com`,
      );
      const updatePromise = updateGame(game.id, { platform: "PS5_ONLY" });

      const [accountResult, updateResult] = await Promise.all([
        accountPromise,
        updatePromise,
      ]);

      const getRes = await fetch(`${baseUrl}/games/${game.id}`);
      const finalGame = (await getRes.json()) as GameResponse;

      const capsRes = await fetch(`${baseUrl}/accounts/${accountResult.account.id}`);
      const capsData = (await capsRes.json()) as {
        capacities: { capacityKind: string }[];
      };
      const kinds = new Set(capsData.capacities.map((c) => c.capacityKind));

      if (updateResult.res.status === 200) {
        // Game update won the lock. Account creation must have observed the new
        // PS5_ONLY platform and created PS5 capacities.
        assert.strictEqual(finalGame.game.platform, "PS5_ONLY");
        assert.ok(kinds.has("Z2_PS5"), "expected PS5 capacities");
        assert.ok(!kinds.has("Z2_PS4"), "did not expect PS4 capacities");
      } else {
        // Account creation won the lock. Game platform change must have been
        // blocked by the account history, leaving PS4 capacities in place.
        assert.strictEqual(updateResult.res.status, 409);
        assert.strictEqual(finalGame.game.platform, "PS4_ONLY");
        assert.ok(kinds.has("Z2_PS4"), "expected PS4 capacities");
        assert.ok(!kinds.has("Z2_PS5"), "did not expect PS5 capacities");
      }
    }
  });
});
