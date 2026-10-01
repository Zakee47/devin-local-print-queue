export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds >= 3600) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${totalSeconds}s`;
}

export function submissionsStatusText(
  settings: { submissionsOpen: boolean; submissionsDeadline?: number },
  now: number
): string {
  if (!settings.submissionsOpen) return "Submissions are closed";
  if (settings.submissionsDeadline === undefined) return "Submissions are open";
  const deadline = new Date(settings.submissionsDeadline).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (now >= settings.submissionsDeadline) return `Submissions closed at ${deadline}`;
  return `Submissions close in ${formatRemaining(settings.submissionsDeadline - now)} (at ${deadline})`;
}
