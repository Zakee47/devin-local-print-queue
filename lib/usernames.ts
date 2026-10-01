export const USERNAME_MIN = 2;
export const USERNAME_MAX = 24;

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function validateUsername(raw: string): string | null {
  const normalized = normalizeUsername(raw);
  const length = [...normalized].length;
  if (length < USERNAME_MIN || length > USERNAME_MAX) {
    return `Username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters.`;
  }
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(normalized)) {
    return "Usernames can only contain letters, numbers, spaces, periods, underscores, hyphens, and apostrophes.";
  }
  return null;
}

export function usernameKey(name: string): string {
  return normalizeUsername(name).toLowerCase();
}
