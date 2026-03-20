import changelogRaw from "../../CHANGELOG.md?raw";

export interface ChangelogSection {
  version: string;
  date: string;
  groups: { label: string; items: string[] }[];
}

export const GROUP_COLORS: Record<string, string> = {
  Adicionado: "text-green-700 bg-green-50 border-green-200",
  Added:      "text-green-700 bg-green-50 border-green-200",
  Alterado:   "text-blue-700 bg-blue-50 border-blue-200",
  Changed:    "text-blue-700 bg-blue-50 border-blue-200",
  Corrigido:  "text-amber-700 bg-amber-50 border-amber-200",
  Fixed:      "text-amber-700 bg-amber-50 border-amber-200",
  Removido:   "text-red-700 bg-red-50 border-red-200",
  Removed:    "text-red-700 bg-red-50 border-red-200",
};

function parseChangelog(raw: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];
  let current: ChangelogSection | null = null;
  let currentGroup: { label: string; items: string[] } | null = null;
  for (const line of raw.split("\n")) {
    const versionMatch = line.match(/^##\s+\[([^\]]+)\]\s*-\s*(.+)/);
    if (versionMatch) {
      currentGroup = null;
      const rawDate = versionMatch[2].trim();
      const [y, m, d] = rawDate.split("-");
      const date = d && m && y ? `${d}/${m}/${y}` : rawDate;
      current = { version: versionMatch[1], date, groups: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    const groupMatch = line.match(/^###\s+(.+)/);
    if (groupMatch) { currentGroup = { label: groupMatch[1].trim(), items: [] }; current.groups.push(currentGroup); continue; }
    const itemMatch = line.match(/^-\s+(.+)/);
    if (itemMatch && currentGroup) currentGroup.items.push(itemMatch[1].replace(/\*\*([^*]+)\*\*/g, "$1"));
  }
  return sections;
}

export const CHANGELOG = parseChangelog(changelogRaw);
