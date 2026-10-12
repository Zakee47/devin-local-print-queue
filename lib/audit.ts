const AUDIT_ACTION_LABELS: Record<string, string> = {
  "queue.approveForVoting": "Approved for voting only",
  "queue.printAfterVotingApproval": "Print request added after voting approval",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
