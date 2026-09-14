import { describe, expect, it } from "vitest";
import { csvCell, parseHouseholdCsv } from "@/lib/guests/csv";

describe("household CSV", () => {
  it("parses quoted households, named seats, and allocated additional guests", () => {
    const [household] = parseHouseholdCsv('household,adults,children,additional_guests\n"Santos, Family","Ana; Luis",Mia,1');
    expect(household.label).toBe("Santos, Family");
    expect(household.slots).toEqual([
      { type: "ADULT", assignedName: "Ana", isAdditionalGuest: false },
      { type: "ADULT", assignedName: "Luis", isAdditionalGuest: false },
      { type: "CHILD", assignedName: "Mia", isAdditionalGuest: false },
      { type: "ADULT", assignedName: null, isAdditionalGuest: true },
    ]);
  });

  it("neutralizes spreadsheet formulas in exports", () => {
    expect(csvCell("=HYPERLINK(\"bad\")")).toBe('"\'=HYPERLINK(""bad"")"');
  });
});
