import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local without printing secrets
const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

async function test(label: string, body: object) {
  const key = process.env.GOOGLE_PLACES_API_KEY ?? "";
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`\n--- ${label} ---`);
  console.log("status:", res.status);
  console.log("body:", text.slice(0, 800));
}

await test("with types", {
  input: "cafe paris",
  includedPrimaryTypes: ["restaurant", "cafe", "bar"],
});
await test("no types", { input: "cafe paris" });
await test("coffee_shop", {
  input: "cafe paris",
  includedPrimaryTypes: ["coffee_shop", "restaurant", "bar"],
});
