/** Google Places `includedPrimaryTypes` per lesson unit (New API). */
const UNIT_PLACE_TYPES: Record<string, string[]> = {
  boulangerie_1: ["bakery"],
  cafe_1: ["cafe", "coffee_shop"],
  gare_1: ["train_station", "transit_station"],
  marche_1: ["market", "grocery_store", "supermarket"],
};

export function getPlaceTypesForUnit(
  unitId: string,
  unitTitle?: string
): string[] | undefined {
  if (UNIT_PLACE_TYPES[unitId]) {
    return UNIT_PLACE_TYPES[unitId];
  }

  const theme = (unitTitle ?? "")
    .replace(/^In the /i, "")
    .replace(/^At the /i, "")
    .toLowerCase();

  if (theme.includes("bakery") || theme.includes("boulangerie")) {
    return ["bakery"];
  }
  if (theme.includes("café") || theme.includes("cafe")) {
    return ["cafe", "coffee_shop"];
  }
  if (theme.includes("station") || theme.includes("gare")) {
    return ["train_station", "transit_station"];
  }
  if (theme.includes("market") || theme.includes("marché") || theme.includes("marche")) {
    return ["market", "grocery_store", "supermarket"];
  }

  return undefined;
}
