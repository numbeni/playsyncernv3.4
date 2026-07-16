export type Platform = "PS5_ONLY" | "PS4_AND_PS5" | "PS4_ONLY";

export type GameStatus = "ACTIVE" | "INACTIVE";

export interface Game {
  id: string;
  title: string;
  coverUrl: string;
  platform: Platform;
  status: GameStatus;
  /** Backend-provided count of Accounts for this Game (read-only in PS-02B). */
  accountCount: number;
}
