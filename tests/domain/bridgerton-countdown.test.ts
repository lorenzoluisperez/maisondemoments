import { describe, expect, it } from "vitest";
import { getCountdownParts } from "@/lib/demo/bridgerton-countdown";

const target = "2027-06-14T16:00:00+08:00";

describe("Filipino wedding countdown", () => {
  it("uses the Manila ceremony instant and rolls each unit correctly", () => {
    const oneDayPlus = Date.parse("2027-06-13T07:59:59Z");
    expect(getCountdownParts(target, oneDayPlus)).toEqual({ days: 1, hours: 0, minutes: 0, seconds: 1, complete: false });
    expect(getCountdownParts(target, Date.parse("2027-06-14T07:59:59Z"))).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1, complete: false });
  });

  it("clamps to the celebration message after the ceremony starts", () => {
    expect(getCountdownParts(target, Date.parse("2027-06-14T08:00:00Z"))).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, complete: true });
    expect(getCountdownParts(target, Date.parse("2027-06-15T08:00:00Z")).complete).toBe(true);
  });
});
