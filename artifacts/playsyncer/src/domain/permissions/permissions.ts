export type PermissionAction =
  | "account.create"
  | "account.edit.email"
  | "account.edit.password"
  | "account.edit.backupCodes"
  | "account.edit.slotCustomers"
  | "account.view.details"
  | "account.disable"
  | "account.delete"
  | "game.create"
  | "game.edit"
  | "game.disable"
  | "game.delete"
  // Capacity (ظرفیت) customer assignment
  | "capacity.assignCustomer"
  | "capacity.editCustomer"
  | "capacity.removeCustomer"
  // Legacy slot keys — kept for backward compatibility
  | "slot.assignCustomer"
  | "slot.removeCustomer"
  | "issue.create"
  | "issue.receive"
  | "issue.updateStatus"
  | "order.view"
  | "order.assign"
  | "order.push";

export interface PermissionUserContext {
  id: string;
  name: string;
  level?: number;
}

export const devAdminUser: PermissionUserContext = {
  id: "dev-admin",
  name: "ادمین توسعه",
  level: 1,
};

export const can = (_action: PermissionAction, _user: PermissionUserContext = devAdminUser) => {
  return true;
};
