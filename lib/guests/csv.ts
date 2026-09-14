import { createHouseholdSchema } from "@/lib/guests/contracts";

export function parseHouseholdCsv(input: string) {
  const rows = parseCsv(input.trim());
  if (!rows.length) throw new Error("The CSV is empty");
  const header = rows[0].map((value) => value.trim().toLowerCase());
  const required = ["household", "adults", "children", "additional_guests"];
  if (required.some((name) => !header.includes(name))) throw new Error(`CSV header must be: ${required.join(", ")}`);
  const index = Object.fromEntries(header.map((name, position) => [name, position]));
  if (rows.length > 501) throw new Error("An invitation supports at most 500 households");
  return rows.slice(1).filter((row) => row.some((cell) => cell.trim())).map((row, rowIndex) => {
    const names = (column: string) => (row[index[column]] ?? "").split(";").map((value) => value.trim()).filter(Boolean);
    const adults = names("adults");
    const children = names("children");
    const additional = Number((row[index.additional_guests] ?? "0").trim() || "0");
    if (!Number.isInteger(additional) || additional < 0 || additional > 10) throw new Error(`Row ${rowIndex + 2} has an invalid additional_guests value`);
    return createHouseholdSchema.parse({
      label: row[index.household]?.trim(),
      slots: [
        ...adults.map((assignedName) => ({ type: "ADULT" as const, assignedName, isAdditionalGuest: false })),
        ...children.map((assignedName) => ({ type: "CHILD" as const, assignedName, isAdditionalGuest: false })),
        ...Array.from({ length: additional }, () => ({ type: "ADULT" as const, assignedName: null, isAdditionalGuest: true })),
      ],
    });
  });
}

export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("CSV contains an unclosed quote");
  row.push(cell); rows.push(row);
  return rows;
}
