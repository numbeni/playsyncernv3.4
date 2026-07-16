import type { Platform } from "@/domain/games/types";

export const platformLabel = (platform: Platform): string => {
  if (platform === "PS5_ONLY") return "PS5 Only";
  if (platform === "PS4_ONLY") return "PS4 Only";
  return "PS4 + PS5";
};

export const supportsPs4 = (platform: Platform) =>
  platform === "PS4_AND_PS5" || platform === "PS4_ONLY";
