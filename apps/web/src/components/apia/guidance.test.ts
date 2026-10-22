import test from "node:test";
import assert from "node:assert/strict";
import { guideFor, searchGuidance, hasGuidance, isSafeOfficialUrl, sourcesFor, OFFICIAL_SOURCES, GUIDE } from "./guidance";

test("ghidajul 2026 nu apare în alte campanii", () => {
  assert.ok(guideFor("parcels", 2026).length > 0);
  assert.equal(guideFor("parcels", 2027).length, 0);
  assert.equal(hasGuidance(2027), false);
  assert.deepEqual(searchGuidance("export", 2027), []);
});
test("căutare după cod, termen și fără diacritice", () => {
  assert.ok(searchGuidance("PD-04", 2026).some(h => h.title.includes("Intervenții")));
  assert.ok(searchGuidance("suprafata diferita", 2026).length > 0);
  assert.ok(searchGuidance("BND", 2026).some(h => h.kind === "glossary"));
});
test("surse oficiale cu status și link securizat", () => {
  assert.ok(OFFICIAL_SOURCES.every(s => isSafeOfficialUrl(s.url)));
  assert.equal(isSafeOfficialUrl("javascript:alert(1)"), false);
  assert.equal(isSafeOfficialUrl("https://evil.example/apia.org.ro"), false);
  assert.equal(sourcesFor(["src-agi"], 2027).length, 0);
  assert.equal(sourcesFor(["src-agi"], 2026)[0].status, "NEEDS_REVIEW");
});
test("ghidajul exportului nu pretinde format oficial", () => {
  const g = GUIDE.find(x => x.sectionKey === "export")!;
  assert.equal(g.type, "EXPORT_GUIDANCE");
  assert.match(g.text, /nu sunt prezentate drept formate oficiale/);
});
