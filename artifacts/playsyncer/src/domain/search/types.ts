export interface SearchHit {
  kind: "game" | "account" | "customer";
  gameId: string;
  gameTitle: string;
  accountId?: string;
  accountNumber?: string;
  label: string;
  sublabel: string;
  /** Set when a sensitive field matched — show this instead of exposing the matched value. */
  matchedBy?: string;
}
