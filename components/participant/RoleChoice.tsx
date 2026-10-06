"use client";

import { Printer, Trophy } from "lucide-react";
import { planRoles, type Role, type RoleFile } from "@/lib/roles";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const options: { value: Role; label: string; icon: typeof Trophy }[] = [
  { value: "vote", label: "Vote", icon: Trophy },
  { value: "print", label: "Print", icon: Printer },
  { value: "both", label: "Both", icon: Trophy },
];

export default function RoleChoice({
  active,
  targetId,
  value,
  onChange,
  disabled = false,
  printOnly = false,
}: {
  active: RoleFile[];
  targetId: string | null;
  value: Role | null;
  onChange: (role: Role | null) => void;
  disabled?: boolean;
  printOnly?: boolean;
}) {
  const shown = printOnly ? options.filter((option) => option.value === "print") : options;
  const plans = new Map(shown.map((option) => [option.value, planRoles(active, targetId, option.value)]));
  const selectedPlan = value ? plans.get(value) : undefined;

  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup
        value={value ? [value] : []}
        onValueChange={(next) => onChange((next[0] as Role | undefined) ?? null)}
        className={`grid w-full gap-2 ${printOnly ? "grid-cols-1" : "grid-cols-3"}`}
        aria-label="Use this file for"
      >
        {shown.map(({ value: role, label, icon: Icon }) => (
          <ToggleGroupItem
            key={role}
            value={role}
            variant="outline"
            className="h-11 min-w-0"
            disabled={disabled || !plans.get(role)?.ok}
          >
            <Icon aria-hidden="true" />
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {!printOnly
        ? shown.map(({ value: role, label }) => {
            const plan = plans.get(role);
            return plan && !plan.ok ? (
              <p key={role} className="text-xs text-muted-foreground">
                {label} isn&apos;t available: {plan.reason}
              </p>
            ) : null;
          })
        : null}
      {selectedPlan?.ok && selectedPlan.notes.length ? (
        <p className="text-xs text-muted-foreground">{selectedPlan.notes.join(". ")}</p>
      ) : null}
    </div>
  );
}
