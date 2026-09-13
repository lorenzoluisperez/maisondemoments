export type Actor = {
  accountId: string;
  accountType: "CUSTOMER" | "STAFF";
  roles: Array<"DESIGNER" | "ADMIN">;
};

export function canReadOrder(actor: Actor, order: { customerId: string; assignedDesignerId: string | null }) {
  if (actor.accountType === "CUSTOMER") return actor.accountId === order.customerId;
  if (actor.roles.includes("ADMIN")) return true;
  return actor.roles.includes("DESIGNER") && actor.accountId === order.assignedDesignerId;
}

export function canPublish(actor: Actor) {
  return actor.accountType === "STAFF" && actor.roles.includes("ADMIN");
}

export function canReadGuestExport(actor: Actor, order: { customerId: string }) {
  return actor.roles.includes("ADMIN") || (actor.accountType === "CUSTOMER" && actor.accountId === order.customerId);
}

export function assertAuthorized(authorized: boolean) {
  if (!authorized) throw new Error("Forbidden");
}
