import { platformLabel } from "@/domain/games/platform";
import type { Game } from "@/domain/games/types";
import type { SearchHit } from "@/domain/search/types";

export const runSmartSearch = (sourceGames: Game[], query: string): SearchHit[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const gameHits: SearchHit[] = [];

  for (const game of sourceGames) {
    const gameMatches =
      game.title.toLowerCase().includes(q) ||
      game.id.toLowerCase().includes(q) ||
      platformLabel(game.platform).toLowerCase().includes(q) ||
      game.status.toLowerCase().includes(q);

    if (gameMatches) {
      gameHits.push({
        kind: "game",
        gameId: game.id,
        gameTitle: game.title,
        label: game.title,
        sublabel: `${platformLabel(game.platform)} · ${game.status === "ACTIVE" ? "فعال" : "غیرفعال"}`,
      });
    }
  }

  return gameHits.slice(0, 20);
};
