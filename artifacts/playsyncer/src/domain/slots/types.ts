export type SlotType = "Z2_PS5_1" | "Z2_PS5_2" | "Z2_PS4_1" | "Z3_PS5";

/** A single customer assignment inside a capacity (ظرفیت). */
export interface SlotCustomer {
  id: string;
  /** Full Iranian mobile phone number. Always displayed without masking. */
  phone: string;
  /** Order reference ID — e.g. ORD-10248. */
  orderId: string;
  /** Optional admin note for this assignment. */
  note?: string;
  /** Assignment date (Jalali or ISO string). */
  createdAt: string;
}

/** Payload used when creating or editing a customer assignment. */
export interface CustomerInput {
  phone: string;
  orderId: string;
  note?: string;
}

export interface AccountSlot {
  id: string;
  type: SlotType;
  label: string;
  customers: SlotCustomer[];
}
