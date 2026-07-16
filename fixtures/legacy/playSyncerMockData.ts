import type { Account } from "@/domain/accounts/types";
import type { GameStatus, Platform } from "@/domain/games/types";
import type { AccountSlot } from "@/domain/slots/types";

/** Legacy Game shape retained for future Account/Capacity integration. Not used as Games authority in PS-02B. */
interface LegacyGame {
  id: string;
  title: string;
  coverUrl: string;
  platform: Platform;
  status: GameStatus;
  accounts: Account[];
}

const slotsForPlatform = (platform: Platform, seed: number): AccountSlot[] => {
  if (platform === "PS4_ONLY") {
    return [
      {
        id: `s-${seed}-z2ps4-1`,
        type: "Z2_PS4_1",
        label: "Z2 PS4",
        customers: [
          {
            id: `c-${seed}-4`,
            phone: "09195545544",
            orderId: "ORD-10201",
            createdAt: "1403/09/02",
          },
        ],
      },
    ];
  }

  const base: AccountSlot[] = [
    {
      id: `s-${seed}-z2ps5-1`,
      type: "Z2_PS5_1",
      label: "Z2 PS5 #1",
      customers: [
        {
          id: `c-${seed}-1`,
          phone: "09121234521",
          orderId: "ORD-10248",
          createdAt: "1403/09/12",
        },
      ],
    },
    {
      id: `s-${seed}-z2ps5-2`,
      type: "Z2_PS5_2",
      label: "Z2 PS5 #2",
      customers: [
        {
          id: `c-${seed}-2`,
          phone: "09351239812",
          orderId: "ORD-10259",
          createdAt: "1403/09/15",
        },
        {
          id: `c-${seed}-3`,
          phone: "09011221122",
          orderId: "ORD-10263",
          note: "نیاز به پیگیری",
          createdAt: "1403/09/18",
        },
      ],
    },
    {
      id: `s-${seed}-z3ps5`,
      type: "Z3_PS5",
      label: "Z3 PS5",
      customers: [],
    },
  ];

  if (platform === "PS4_AND_PS5") {
    base.splice(2, 0, {
      id: `s-${seed}-z2ps4-1`,
      type: "Z2_PS4_1",
      label: "Z2 PS4",
      customers: [
        {
          id: `c-${seed}-4`,
          phone: "09195545544",
          orderId: "ORD-10201",
          createdAt: "1403/09/02",
        },
      ],
    });
  }

  return base;
};

/** Format a global account code from a 1-based sequential number. */
export const formatAccountCode = (n: number): string =>
  `ACC-${String(n).padStart(6, "0")}`;

const makeAccounts = (
  gameId: string,
  platform: Platform,
  count: number,
  codeOffset: number,
  numberPrefix?: string,
): Account[] => {
  const prefix = numberPrefix ?? gameId.toUpperCase();

  return Array.from({ length: count }).map((_, index) => {
    const accountIndex = index + 1;
    const disabled = accountIndex % 7 === 0;

    return {
      id: `${gameId}-acc-${accountIndex}`,
      accountCode: formatAccountCode(codeOffset + accountIndex),
      numberPrefix: prefix,
      number: `#${prefix}-${String(accountIndex).padStart(3, "0")}`,
      email: `${gameId}.account${accountIndex}@playsyncer.io`,
      password: `Ps@${gameId}${accountIndex}${accountIndex}${accountIndex}!`,
      emailPassword: `Em@${gameId}${accountIndex}!`,
      onlineId: `PSN_${gameId}_${accountIndex}`,
      birthDate: "1990/01/15",
      familyManagementEmail: `family.${gameId}${accountIndex}@playsyncer.io`,
      backupCodes: ["a4f9-22", "b7c1-88", "e6d3-14", "9k22-ll"],
      status: disabled ? "disabled" : "active",
      slots: slotsForPlatform(platform, accountIndex),
    };
  });
};

// Account counts per game — must stay in sync with the games array below.
// gta6:6  ea-fc25:8  cod-bo6:5  spiderman2:4  gow-ragnarok:7  hogwarts:3  fifa14:3
// Total: 36 unique accountCodes → ACC-000001 … ACC-000036
//
// NOTE: These objects are no longer the runtime authority for Games. They are
// kept only as a local seed for Account/Capacity state until the Account
// backend integration phase. Game metadata (id, title, coverUrl, platform,
// status) is now loaded from the backend via useListGames.
export const games: LegacyGame[] = [
  {
    id: "gta6",
    title: "GTA VI",
    coverUrl: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800&auto=format&fit=crop",
    platform: "PS5_ONLY",
    status: "ACTIVE",
    accounts: makeAccounts("gta6", "PS5_ONLY", 6, 0, "GTA6"),
  },
  {
    id: "ea-fc25",
    title: "EA Sports FC 25",
    coverUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&auto=format&fit=crop",
    platform: "PS4_AND_PS5",
    status: "ACTIVE",
    accounts: makeAccounts("ea-fc25", "PS4_AND_PS5", 8, 6, "FC25"),
  },
  {
    id: "cod-bo6",
    title: "Call of Duty: Black Ops 6",
    coverUrl: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800&auto=format&fit=crop&sat=-50",
    platform: "PS4_AND_PS5",
    status: "ACTIVE",
    accounts: makeAccounts("cod-bo6", "PS4_AND_PS5", 5, 14, "COD-BO6"),
  },
  {
    id: "spiderman2",
    title: "Marvel's Spider-Man 2",
    coverUrl: "https://images.unsplash.com/photo-1635805737707-575885ab0820?w=800&auto=format&fit=crop",
    platform: "PS5_ONLY",
    status: "ACTIVE",
    accounts: makeAccounts("spiderman2", "PS5_ONLY", 4, 19, "SM2"),
  },
  {
    id: "gow-ragnarok",
    title: "God of War: Ragnarök",
    coverUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop",
    platform: "PS4_AND_PS5",
    status: "INACTIVE",
    accounts: makeAccounts("gow-ragnarok", "PS4_AND_PS5", 7, 23, "GOW"),
  },
  {
    id: "hogwarts",
    title: "Hogwarts Legacy",
    coverUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop",
    platform: "PS4_AND_PS5",
    status: "ACTIVE",
    accounts: makeAccounts("hogwarts", "PS4_AND_PS5", 3, 30, "HWTS"),
  },
  {
    id: "fifa14",
    title: "FIFA 14",
    coverUrl: "https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?w=800&auto=format&fit=crop",
    platform: "PS4_ONLY",
    status: "ACTIVE",
    accounts: makeAccounts("fifa14", "PS4_ONLY", 3, 33, "FIFA14"),
  },
];
