export const DEVIN_PLAYBOOK_CREATE_URL = "https://app.devin.ai/settings/playbooks/create";
export const DEVIN_NEW_SESSION_URL = "https://app.devin.ai/";
export const PLAYBOOK_PATH = "/keychain-playbook.md";
export const PLAYBOOK_DOWNLOAD_NAME = "keychain-3d-print-playbook.md";

export function devinStartPrompt(origin: string): string {
  return `Fetch the playbook at ${origin}/keychain-playbook.md and follow it exactly to design my competition keychain. My idea: `;
}

export function devinStartUrl(origin: string): string {
  return `${DEVIN_NEW_SESSION_URL}?prompt=${encodeURIComponent(devinStartPrompt(origin))}`;
}
