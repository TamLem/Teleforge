export interface ParsedCommand {
  args: string[];
  command: string;
  mention?: string;
}

export function normalizeCommandName(input: string): string {
  return input.replace(/^\//, "").trim().toLowerCase();
}

export function parseCommand(text: string | undefined): ParsedCommand | null {
  if (!text || !text.startsWith("/")) {
    return null;
  }

  const [commandPart, ...args] = text.trim().split(/\s+/);
  const body = commandPart.slice(1);
  const [name, mention] = body.split("@");
  const command = normalizeCommandName(name ?? "");

  if (!command) {
    return null;
  }

  return {
    args,
    command,
    mention: mention?.trim() || undefined
  };
}
