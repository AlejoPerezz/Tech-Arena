import fs from "fs";

const path = new URL("../data/scenarios.json", import.meta.url);
const raw = fs.readFileSync(path, "utf-8");
const payload = JSON.parse(raw);

if (!Array.isArray(payload.scenarios)) {
  throw new Error("scenarios must be an array");
}

payload.scenarios.forEach((scenario) => {
  if (!scenario.id || !scenario.locale?.en || !scenario.locale?.es) {
    throw new Error(`Scenario ${scenario.id ?? "unknown"} missing locales`);
  }
  ["en", "es"].forEach((localeKey) => {
    const locale = scenario.locale[localeKey];
    if (!locale.title || !locale.prompt || !Array.isArray(locale.options)) {
      throw new Error(`Scenario ${scenario.id} locale ${localeKey} is invalid`);
    }
    locale.options.forEach((option) => {
      if (!option.id || typeof option.points !== "number") {
        throw new Error(`Option invalid in ${scenario.id}/${localeKey}`);
      }
    });
  });
});

console.log("Scenario data validated.");
