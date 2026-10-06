import type { SubmissionStatus } from "./event";

export type Role = "vote" | "print" | "both";
export type RoleFile = {
  id: string;
  printCode: string;
  vote: boolean;
  print: boolean;
  status: SubmissionStatus;
  designRemoved: boolean;
};

export type RolePlan =
  | {
      ok: true;
      vote: boolean;
      print: boolean;
      withdrawsPrint: boolean;
      others: { id: string; printCode: string; vote: boolean; print: boolean; withdrawsPrint: boolean }[];
      notes: string[];
    }
  | { ok: false; reason: string };

export function rolesOf(role: Role): { vote: boolean; print: boolean } {
  return { vote: role !== "print", print: role !== "vote" };
}

export function roleOf(roles: { vote: boolean; print: boolean }): Role | null {
  if (roles.vote && roles.print) return "both";
  if (roles.vote) return "vote";
  if (roles.print) return "print";
  return null;
}

function roleName(role: "vote" | "print") {
  return role === "vote" ? "Vote" : "Print";
}

function lockedStatus(status: SubmissionStatus) {
  return status === "printing" || status === "done";
}

export function planRoles(active: RoleFile[], targetId: string | null, role: Role): RolePlan {
  const target = targetId
    ? active.find((file) => file.id === targetId)
    : { id: "", printCode: "", vote: false, print: false, status: "submitted" as const, designRemoved: false };
  if (!target) return { ok: false, reason: "Only active uploads can change role" };

  const desired = rolesOf(role);
  const targetChanged = target.vote !== desired.vote || target.print !== desired.print;
  if (targetChanged && target.status === "printing") {
    return { ok: false, reason: `${target.printCode} is printing. Ask staff for changes.` };
  }
  if (targetChanged && target.status === "done") {
    return { ok: false, reason: `${target.printCode} has been printed. Ask staff for changes.` };
  }
  if (desired.print && !target.print && target.status !== "submitted") {
    return {
      ok: false,
      reason: `${target.printCode}'s print was rejected. Replace the file to request a print again.`,
    };
  }
  if (desired.vote && !target.vote && target.designRemoved) {
    return { ok: false, reason: `The organizers removed ${target.printCode} from the competition.` };
  }

  const others: Extract<RolePlan, { ok: true }>["others"] = [];
  const notes: string[] = [];
  for (const other of active) {
    if (other.id === targetId) continue;
    const next = { vote: other.vote && !desired.vote, print: other.print && !desired.print };
    if (next.vote === other.vote && next.print === other.print) continue;
    if (lockedStatus(other.status)) {
      const conflictingRole = other.vote && desired.vote ? "vote" : "print";
      const status = other.status === "printing" ? "which is printing" : "which has been printed";
      return { ok: false, reason: `${roleName(conflictingRole)} is on ${other.printCode}, ${status}` };
    }
    if (!next.vote && !next.print) {
      return { ok: false, reason: `${other.printCode} must keep Vote or Print` };
    }
    const withdrawsPrint = other.print && !next.print && other.status === "queued";
    others.push({ id: other.id, printCode: other.printCode, ...next, withdrawsPrint });
    const lost = [
      ...(other.vote && !next.vote ? ["Vote"] : []),
      ...(other.print && !next.print ? ["Print"] : []),
    ];
    for (const moved of lost) {
      notes.push(
        `Moves ${moved} from ${other.printCode}${moved === "Print" && withdrawsPrint ? " and takes it out of the print queue" : ""}`
      );
    }
  }

  const withdrawsPrint = target.print && !desired.print && target.status === "queued";
  if (withdrawsPrint) notes.push(`Takes ${target.printCode} out of the print queue`);
  return { ok: true, ...desired, withdrawsPrint, others, notes };
}
