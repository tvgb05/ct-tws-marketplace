const phraseAliases = [
  ["sac du phong", "pin du phong", "power bank", "powerbank"],
  ["cu sac", "coc sac", "charger", "adapter sac"],
  ["cap sac", "day sac", "charging cable", "cable sac"],
  ["tai nghe khong day", "tai nghe bluetooth", "true wireless", "earbuds", "tws"],
  ["den pin", "flashlight", "torch"],
  ["o cung", "hard drive", "hdd"],
  ["o cung the ran", "solid state drive", "ssd"],
];

const tokenAliases: Record<string, string[]> = {
  sac: ["sac", "charger"],
  cap: ["cap", "cable", "day"],
  cable: ["cable", "cap", "day"],
  tai: ["tai", "headphone", "earphone"],
  nghe: ["nghe", "headphone", "earphone"],
  loa: ["loa", "speaker"],
  mic: ["mic", "microphone"],
  den: ["den", "light", "flashlight"],
};

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildListingSearchText(values: Array<string | null | undefined>) {
  return normalizeSearchText(values.filter(Boolean).join(" "));
}

export function buildSearchGroups(value: string) {
  let remaining = normalizeSearchText(value);
  const groups: string[][] = [];

  for (const aliases of phraseAliases) {
    const matched = aliases.find((alias) => remaining.includes(alias));
    if (!matched) continue;
    groups.push(aliases);
    remaining = remaining.replace(matched, " ");
  }

  for (const token of remaining.split(" ").filter(Boolean).slice(0, 8)) {
    groups.push(tokenAliases[token] ?? [token]);
  }
  return groups;
}

export function searchRelevance(
  value: string,
  listing: { title: string; description: string; searchText: string },
) {
  const query = normalizeSearchText(value);
  const title = normalizeSearchText(listing.title);
  const description = normalizeSearchText(listing.description);
  let score = title === query ? 100 : title.startsWith(query) ? 70 : title.includes(query) ? 50 : 0;
  for (const variants of buildSearchGroups(value)) {
    if (variants.some((variant) => title.includes(variant))) score += 15;
    else if (variants.some((variant) => description.includes(variant))) score += 6;
    else if (variants.some((variant) => listing.searchText.includes(variant))) score += 2;
  }
  return score;
}
