import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db, gamesTable, accountsTable } from "@workspace/db";
import {
  cleanGameTitle,
  normalizeGameTitle,
  prepareGameTitle,
  GameTitleError,
} from "@workspace/db/helpers";
import { eq, desc, count, isNull } from "drizzle-orm";
import { z } from "zod";
import { p } from "../lib/req-param";
import { requireUuidParam } from "../lib/validate-uuid";
import { HttpError } from "../middlewares/error-handler";

const router: IRouter = Router();

// Malformed UUID route params fail fast with HTTP 400 instead of reaching the DB.
router.param("id", requireUuidParam("id"));

// ── Validation ──────────────────────────────────────────────────────────────

const titleSchema = z.preprocess(
  (val) => (typeof val === "string" ? cleanGameTitle(val) : val),
  z
    .string()
    .min(1, "Title is required")
    .max(120, "Title must be at most 120 characters"),
).refine((val) => normalizeGameTitle(val).length > 0, {
  message: "Title cannot be whitespace-only",
});

const CreateGameBody = z.object({
  title: titleSchema,
  coverUrl: z.string().url().optional(),
  platform: z.enum(["PS5_ONLY", "PS4_AND_PS5", "PS4_ONLY"]),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

const UpdateGameBody = z.object({
  title: titleSchema.optional(),
  coverUrl: z.string().url().nullable().optional(),
  platform: z.enum(["PS5_ONLY", "PS4_AND_PS5", "PS4_ONLY"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchGame(id: string) {
  const [game] = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.id, id))
    .limit(1);
  return game ?? null;
}

async function requireGame(id: string) {
  const game = await fetchGame(id);
  if (!game || game.deletedAt) {
    throw new HttpError(404, "Game not found");
  }
  return game;
}

function isDuplicateTitleError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const error = err as {
    code?: string;
    cause?: { code?: string };
    message?: string;
  };
  if (error.code === "23505") return true;
  if (error.cause?.code === "23505") return true;
  if (
    error.message?.includes("duplicate key value violates unique constraint")
  ) {
    return true;
  }
  return false;
}

function isForeignKeyViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const error = err as {
    code?: string;
    cause?: { code?: string };
    message?: string;
  };
  if (error.code === "23503") return true;
  if (error.cause?.code === "23503") return true;
  if (
    error.message?.includes(
      "violates foreign key constraint",
    )
  ) {
    return true;
  }
  return false;
}

function isGameTitleError(err: unknown): boolean {
  return err instanceof GameTitleError;
}

// ── Routes ───────────────────────────────────────────────────────────────────

/** GET /games — list all games with account count */
router.get("/games", async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rows = await db
      .select({
        id: gamesTable.id,
        title: gamesTable.title,
        titleNormalized: gamesTable.titleNormalized,
        coverUrl: gamesTable.coverUrl,
        platform: gamesTable.platform,
        status: gamesTable.status,
        createdAt: gamesTable.createdAt,
        updatedAt: gamesTable.updatedAt,
        accountCount: count(accountsTable.id),
      })
      .from(gamesTable)
      .leftJoin(
        accountsTable,
        eq(accountsTable.gameId, gamesTable.id),
      )
      .where(isNull(gamesTable.deletedAt))
      .groupBy(gamesTable.id)
      .orderBy(desc(gamesTable.createdAt));

    res.json({ games: rows });
  } catch (err) {
    next(err);
  }
});

/** GET /games/:id — single game */
router.get("/games/:id", async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const game = await requireGame(p(req.params["id"]));
    res.json({ game });
  } catch (err) {
    next(err);
  }
});

/** POST /games — create game */
router.post("/games", async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = CreateGameBody.parse(req.body);
    const { title, titleNormalized } = prepareGameTitle(parsed.title);

    const [game] = await db
      .insert(gamesTable)
      .values({
        title,
        titleNormalized,
        coverUrl: parsed.coverUrl,
        platform: parsed.platform,
        status: parsed.status,
      })
      .returning();

    res.status(201).json({ game });
  } catch (err) {
    if (isGameTitleError(err)) {
      next(new HttpError(400, (err as GameTitleError).message));
      return;
    }
    if (isDuplicateTitleError(err)) {
      next(new HttpError(409, "A game with this title already exists"));
      return;
    }
    next(err);
  }
});

/** PATCH /games/:id — update game */
router.patch("/games/:id", async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = p(req.params["id"]);
    const parsed = UpdateGameBody.parse(req.body);

    const result = await db.transaction(async (tx) => {
      const [game] = await tx
        .select()
        .from(gamesTable)
        .where(eq(gamesTable.id, id))
        .for("update")
        .limit(1);

      if (!game || game.deletedAt) {
        throw new HttpError(404, "Game not found");
      }

      if (
        parsed.platform !== undefined &&
        parsed.platform !== game.platform
      ) {
        const [history] = await tx
          .select({ count: count(accountsTable.id) })
          .from(accountsTable)
          .where(eq(accountsTable.gameId, id))
          .limit(1);
        if ((history?.count ?? 0) > 0) {
          throw new HttpError(
            409,
            "Cannot change platform after accounts exist for this game",
          );
        }
      }

      const update: Partial<typeof gamesTable.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (parsed.title !== undefined) {
        const { title, titleNormalized } = prepareGameTitle(parsed.title);
        update.title = title;
        update.titleNormalized = titleNormalized;
      }
      if (parsed.coverUrl !== undefined) update.coverUrl = parsed.coverUrl;
      if (parsed.platform !== undefined) update.platform = parsed.platform;
      if (parsed.status !== undefined) update.status = parsed.status;

      const [updated] = await tx
        .update(gamesTable)
        .set(update)
        .where(eq(gamesTable.id, id))
        .returning();

      return updated;
    });

    res.json({ game: result });
  } catch (err) {
    if (isGameTitleError(err)) {
      next(new HttpError(400, (err as GameTitleError).message));
      return;
    }
    if (isDuplicateTitleError(err)) {
      next(new HttpError(409, "A game with this title already exists"));
      return;
    }
    next(err);
  }
});

/** DELETE /games/:id — hard delete when no account history */
router.delete("/games/:id", async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = p(req.params["id"]);

    await db.transaction(async (tx) => {
      const [game] = await tx
        .select()
        .from(gamesTable)
        .where(eq(gamesTable.id, id))
        .for("update")
        .limit(1);

      if (!game || game.deletedAt) {
        throw new HttpError(404, "Game not found");
      }

      const [history] = await tx
        .select({ count: count(accountsTable.id) })
        .from(accountsTable)
        .where(eq(accountsTable.gameId, id))
        .limit(1);
      if ((history?.count ?? 0) > 0) {
        throw new HttpError(
          409,
          "Cannot delete game while accounts exist; mark it inactive instead",
        );
      }

      await tx.delete(gamesTable).where(eq(gamesTable.id, id));
    });

    res.json({ ok: true });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      next(
        new HttpError(
          409,
          "Cannot delete game while related records exist; mark it inactive instead",
        ),
      );
      return;
    }
    next(err);
  }
});

export default router;
