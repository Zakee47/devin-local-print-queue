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

export function devinPlaybookStub(origin: string): string {
  const url = `${origin}${PLAYBOOK_PATH}`;
  return `# Playbook: Keychain 3D print (Devin Local London)

This is a short loader for the competition playbook. The full playbook is hosted at ${url}

## Procedure
1. Before doing anything else, fetch ${url} (for example \`curl -fsSL ${url}\`) and read the whole file.
2. Follow that playbook exactly, as if its full text were written here.
3. If the fetch fails, stop and ask me to paste the full playbook text into the chat.
`;
}

export function devinPlaybookCreateUrl(origin: string): string {
  return `${DEVIN_PLAYBOOK_CREATE_URL}?body=${encodeURIComponent(devinPlaybookStub(origin))}`;
}
