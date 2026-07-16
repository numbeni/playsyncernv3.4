-- PS-02A Games Contract migration.
-- Safe upgrade for an existing populated database.

-- 1. Migrate game_status from lowercase enum to uppercase enum safely.
ALTER TABLE "games" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;--> statement-breakpoint
UPDATE "games" SET "status" = UPPER("status") WHERE "status" IN ('active', 'inactive');--> statement-breakpoint
DROP TYPE IF EXISTS "public"."game_status";--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "status" SET DATA TYPE "public"."game_status" USING "status"::"public"."game_status";--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"public"."game_status";--> statement-breakpoint

-- 2. Add title_normalized as nullable so existing rows can be backfilled.
ALTER TABLE "games" ADD COLUMN "title_normalized" text;--> statement-breakpoint

-- 3. Clean existing display titles, backfill normalized titles, and fail loudly on conflicts.
DO $$
DECLARE
    conflicting_titles text;
BEGIN
    -- Clean display titles: trim outer whitespace and collapse repeated internal whitespace.
    UPDATE "games"
    SET "title" = trim(regexp_replace("title", '\s+', ' ', 'g'))
    WHERE "title" IS NOT NULL;

    -- Populate the lowercase normalized title from the cleaned display title.
    UPDATE "games"
    SET "title_normalized" = lower(trim(regexp_replace("title", '\s+', ' ', 'g')))
    WHERE "title_normalized" IS NULL;

    -- Reject blank normalized titles (e.g. whitespace-only originals).
    IF EXISTS (SELECT 1 FROM "games" WHERE "title_normalized" = '') THEN
        RAISE EXCEPTION 'Migration failed: one or more Games have a blank or whitespace-only title after normalization';
    END IF;

    -- Reject titles that exceed the cleaned 120-character limit.
    IF EXISTS (SELECT 1 FROM "games" WHERE length("title") > 120) THEN
        RAISE EXCEPTION 'Migration failed: one or more Game titles exceed 120 characters after cleaning';
    END IF;

    -- Detect normalized duplicate titles before creating the unique index.
    SELECT string_agg("title_normalized", ', ' ORDER BY "title_normalized")
    INTO conflicting_titles
    FROM (
        SELECT "title_normalized"
        FROM "games"
        GROUP BY "title_normalized"
        HAVING count(*) > 1
    ) dups;

    IF conflicting_titles IS NOT NULL THEN
        RAISE EXCEPTION 'Migration failed: conflicting normalized titles exist: %', conflicting_titles;
    END IF;
END $$;--> statement-breakpoint

-- 4. Make title_normalized required and enforce global uniqueness across all rows.
ALTER TABLE "games" ALTER COLUMN "title_normalized" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "games_title_normalized_uniq" ON "games" USING btree ("title_normalized");

-- 5. Enforce title data contract at the database level.
ALTER TABLE "games" ADD CONSTRAINT "games_title_not_blank" CHECK (length(trim("title")) > 0);--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_title_max_length" CHECK (length("title") <= 120);--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_title_normalized_not_blank" CHECK (length(trim("title_normalized")) > 0);--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_title_normalized_max_length" CHECK (length("title_normalized") <= 120);
