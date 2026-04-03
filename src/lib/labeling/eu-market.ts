export type LocaleCode = string;

export interface MarketProfile {
  countryCode: string;
  countryName: string;
  requiredLocales: LocaleCode[];
  isEU: boolean;
}

type FieldLabelKey =
  | "ingredients"
  | "nutrition"
  | "energy"
  | "fat"
  | "carbs"
  | "protein"
  | "salt"
  | "bestBefore"
  | "batch"
  | "netQuantity"
  | "originCountry"
  | "importer"
  | "storage";

const LABELS: Record<string, Record<FieldLabelKey, string>> = {
  en: {
    ingredients: "Ingredients",
    nutrition: "Nutrition",
    energy: "Energy",
    fat: "Fat",
    carbs: "Carbohydrates",
    protein: "Protein",
    salt: "Salt",
    bestBefore: "Best before",
    batch: "Batch",
    netQuantity: "Net quantity",
    originCountry: "Country of origin",
    importer: "Importer",
    storage: "Storage",
  },
  fi: {
    ingredients: "Ainesosat",
    nutrition: "Ravintoarvot",
    energy: "Energia",
    fat: "Rasva",
    carbs: "Hiilihydraatit",
    protein: "Proteiini",
    salt: "Suola",
    bestBefore: "Parasta ennen",
    batch: "Erä",
    netQuantity: "Nettomäärä",
    originCountry: "Alkuperämaa",
    importer: "Maahantuoja",
    storage: "Säilytys",
  },
  sv: {
    ingredients: "Ingredienser",
    nutrition: "Näringsvärde",
    energy: "Energi",
    fat: "Fett",
    carbs: "Kolhydrat",
    protein: "Protein",
    salt: "Salt",
    bestBefore: "Bäst före",
    batch: "Parti",
    netQuantity: "Nettovikt",
    originCountry: "Ursprungsland",
    importer: "Importör",
    storage: "Förvaring",
  },
  de: {
    ingredients: "Zutaten",
    nutrition: "Nährwert",
    energy: "Energie",
    fat: "Fett",
    carbs: "Kohlenhydrate",
    protein: "Eiweiß",
    salt: "Salz",
    bestBefore: "Mindestens haltbar bis",
    batch: "Charge",
    netQuantity: "Nettomenge",
    originCountry: "Ursprungsland",
    importer: "Importeur",
    storage: "Aufbewahrung",
  },
  fr: {
    ingredients: "Ingrédients",
    nutrition: "Valeurs nutritionnelles",
    energy: "Énergie",
    fat: "Matières grasses",
    carbs: "Glucides",
    protein: "Protéines",
    salt: "Sel",
    bestBefore: "À consommer de préférence avant",
    batch: "Lot",
    netQuantity: "Quantité nette",
    originCountry: "Pays d'origine",
    importer: "Importateur",
    storage: "Conservation",
  },
  nl: {
    ingredients: "Ingrediënten",
    nutrition: "Voedingswaarde",
    energy: "Energie",
    fat: "Vetten",
    carbs: "Koolhydraten",
    protein: "Eiwitten",
    salt: "Zout",
    bestBefore: "Ten minste houdbaar tot",
    batch: "Partij",
    netQuantity: "Nettohoeveelheid",
    originCountry: "Land van oorsprong",
    importer: "Importeur",
    storage: "Bewaring",
  },
  da: {
    ingredients: "Ingredienser",
    nutrition: "Næringsindhold",
    energy: "Energi",
    fat: "Fedt",
    carbs: "Kulhydrat",
    protein: "Protein",
    salt: "Salt",
    bestBefore: "Bedst før",
    batch: "Batch",
    netQuantity: "Nettomængde",
    originCountry: "Oprindelsesland",
    importer: "Importør",
    storage: "Opbevaring",
  },
  es: {
    ingredients: "Ingredientes",
    nutrition: "Información nutricional",
    energy: "Energía",
    fat: "Grasas",
    carbs: "Hidratos de carbono",
    protein: "Proteínas",
    salt: "Sal",
    bestBefore: "Consumir preferentemente antes de",
    batch: "Lote",
    netQuantity: "Cantidad neta",
    originCountry: "País de origen",
    importer: "Importador",
    storage: "Conservación",
  },
  it: {
    ingredients: "Ingredienti",
    nutrition: "Valori nutrizionali",
    energy: "Energia",
    fat: "Grassi",
    carbs: "Carboidrati",
    protein: "Proteine",
    salt: "Sale",
    bestBefore: "Da consumarsi preferibilmente entro",
    batch: "Lotto",
    netQuantity: "Quantità netta",
    originCountry: "Paese d'origine",
    importer: "Importatore",
    storage: "Conservazione",
  },
  pt: {
    ingredients: "Ingredientes",
    nutrition: "Declaração nutricional",
    energy: "Energia",
    fat: "Lípidos",
    carbs: "Hidratos de carbono",
    protein: "Proteínas",
    salt: "Sal",
    bestBefore: "Consumir de preferência antes de",
    batch: "Lote",
    netQuantity: "Quantidade líquida",
    originCountry: "País de origem",
    importer: "Importador",
    storage: "Conservação",
  },
  pl: {
    ingredients: "Składniki",
    nutrition: "Wartość odżywcza",
    energy: "Energia",
    fat: "Tłuszcz",
    carbs: "Węglowodany",
    protein: "Białko",
    salt: "Sól",
    bestBefore: "Najlepiej spożyć przed",
    batch: "Partia",
    netQuantity: "Ilość netto",
    originCountry: "Kraj pochodzenia",
    importer: "Importer",
    storage: "Przechowywanie",
  },
  cs: {
    ingredients: "Složení",
    nutrition: "Výživové údaje",
    energy: "Energie",
    fat: "Tuky",
    carbs: "Sacharidy",
    protein: "Bílkoviny",
    salt: "Sůl",
    bestBefore: "Minimální trvanlivost do",
    batch: "Šarže",
    netQuantity: "Čisté množství",
    originCountry: "Země původu",
    importer: "Dovozce",
    storage: "Skladování",
  },
  sk: {
    ingredients: "Zloženie",
    nutrition: "Výživové údaje",
    energy: "Energia",
    fat: "Tuky",
    carbs: "Sacharidy",
    protein: "Bielkoviny",
    salt: "Soľ",
    bestBefore: "Minimálna trvanlivosť do",
    batch: "Šarža",
    netQuantity: "Čisté množstvo",
    originCountry: "Krajina pôvodu",
    importer: "Dovozca",
    storage: "Skladovanie",
  },
  sl: {
    ingredients: "Sestavine",
    nutrition: "Hranilna vrednost",
    energy: "Energijska vrednost",
    fat: "Maščobe",
    carbs: "Ogljikovi hidrati",
    protein: "Beljakovine",
    salt: "Sol",
    bestBefore: "Uporabno najmanj do",
    batch: "Serija",
    netQuantity: "Neto količina",
    originCountry: "Država porekla",
    importer: "Uvoznik",
    storage: "Shranjevanje",
  },
  hr: {
    ingredients: "Sastojci",
    nutrition: "Hranjive vrijednosti",
    energy: "Energija",
    fat: "Masti",
    carbs: "Ugljikohidrati",
    protein: "Bjelančevine",
    salt: "Sol",
    bestBefore: "Najbolje upotrijebiti do",
    batch: "Serija",
    netQuantity: "Neto količina",
    originCountry: "Zemlja podrijetla",
    importer: "Uvoznik",
    storage: "Uvjeti čuvanja",
  },
  hu: {
    ingredients: "Összetevők",
    nutrition: "Tápérték",
    energy: "Energia",
    fat: "Zsír",
    carbs: "Szénhidrát",
    protein: "Fehérje",
    salt: "Só",
    bestBefore: "Minőségét megőrzi",
    batch: "Tétel",
    netQuantity: "Nettó mennyiség",
    originCountry: "Származási ország",
    importer: "Importőr",
    storage: "Tárolás",
  },
  ro: {
    ingredients: "Ingrediente",
    nutrition: "Declarație nutrițională",
    energy: "Valoare energetică",
    fat: "Grăsimi",
    carbs: "Glucide",
    protein: "Proteine",
    salt: "Sare",
    bestBefore: "A se consuma de preferință înainte de",
    batch: "Lot",
    netQuantity: "Cantitate netă",
    originCountry: "Țara de origine",
    importer: "Importator",
    storage: "Condiții de păstrare",
  },
  bg: {
    ingredients: "Съставки",
    nutrition: "Хранителна стойност",
    energy: "Енергийна стойност",
    fat: "Мазнини",
    carbs: "Въглехидрати",
    protein: "Белтъчини",
    salt: "Сол",
    bestBefore: "Най-добър до",
    batch: "Партида",
    netQuantity: "Нетно количество",
    originCountry: "Страна на произход",
    importer: "Вносител",
    storage: "Съхранение",
  },
  el: {
    ingredients: "Συστατικά",
    nutrition: "Διατροφική δήλωση",
    energy: "Ενέργεια",
    fat: "Λιπαρά",
    carbs: "Υδατάνθρακες",
    protein: "Πρωτεΐνη",
    salt: "Αλάτι",
    bestBefore: "Ανάλωση κατά προτίμηση πριν από",
    batch: "Παρτίδα",
    netQuantity: "Καθαρή ποσότητα",
    originCountry: "Χώρα προέλευσης",
    importer: "Εισαγωγέας",
    storage: "Συνθήκες αποθήκευσης",
  },
  et: {
    ingredients: "Koostisosad",
    nutrition: "Toitumisalane teave",
    energy: "Energiasisaldus",
    fat: "Rasvad",
    carbs: "Süsivesikud",
    protein: "Valgud",
    salt: "Sool",
    bestBefore: "Parim enne",
    batch: "Partii",
    netQuantity: "Netokogus",
    originCountry: "Päritoluriik",
    importer: "Importija",
    storage: "Säilitamine",
  },
  lv: {
    ingredients: "Sastāvdaļas",
    nutrition: "Uzturvērtība",
    energy: "Enerģētiskā vērtība",
    fat: "Tauki",
    carbs: "Ogļhidrāti",
    protein: "Olbaltumvielas",
    salt: "Sāls",
    bestBefore: "Ieteicams līdz",
    batch: "Partija",
    netQuantity: "Neto daudzums",
    originCountry: "Izcelsmes valsts",
    importer: "Importētājs",
    storage: "Uzglabāšana",
  },
  lt: {
    ingredients: "Sudedamosios dalys",
    nutrition: "Maistinė vertė",
    energy: "Energinė vertė",
    fat: "Riebalai",
    carbs: "Angliavandeniai",
    protein: "Baltymai",
    salt: "Druska",
    bestBefore: "Geriausias iki",
    batch: "Partija",
    netQuantity: "Grynasis kiekis",
    originCountry: "Kilmės šalis",
    importer: "Importuotojas",
    storage: "Laikymo sąlygos",
  },
  mt: {
    ingredients: "Ingredjenti",
    nutrition: "Dikjarazzjoni nutrizzjonali",
    energy: "Enerġija",
    fat: "Xaħam",
    carbs: "Karboidrati",
    protein: "Proteina",
    salt: "Melħ",
    bestBefore: "L-aħjar qabel",
    batch: "Lott",
    netQuantity: "Kwantità netta",
    originCountry: "Pajjiż tal-oriġini",
    importer: "Importatur",
    storage: "Ħażna",
  },
};

const COUNTRY_ALIASES: Record<string, string> = {
  austria: "AT",
  belgium: "BE",
  bulgaria: "BG",
  croatia: "HR",
  cyprus: "CY",
  "czech republic": "CZ",
  czechia: "CZ",
  denmark: "DK",
  estonia: "EE",
  finland: "FI",
  france: "FR",
  germany: "DE",
  greece: "GR",
  hungary: "HU",
  ireland: "IE",
  italy: "IT",
  latvia: "LV",
  lithuania: "LT",
  luxembourg: "LU",
  malta: "MT",
  netherlands: "NL",
  poland: "PL",
  portugal: "PT",
  romania: "RO",
  slovakia: "SK",
  slovenia: "SI",
  spain: "ES",
  sweden: "SE",
};

const MARKET_BY_COUNTRY_CODE: Record<string, MarketProfile> = {
  AT: { countryCode: "AT", countryName: "Austria", requiredLocales: ["de"], isEU: true },
  BE: { countryCode: "BE", countryName: "Belgium", requiredLocales: ["nl", "fr"], isEU: true },
  BG: { countryCode: "BG", countryName: "Bulgaria", requiredLocales: ["bg"], isEU: true },
  HR: { countryCode: "HR", countryName: "Croatia", requiredLocales: ["hr"], isEU: true },
  CY: { countryCode: "CY", countryName: "Cyprus", requiredLocales: ["el"], isEU: true },
  CZ: { countryCode: "CZ", countryName: "Czechia", requiredLocales: ["cs"], isEU: true },
  DK: { countryCode: "DK", countryName: "Denmark", requiredLocales: ["da"], isEU: true },
  EE: { countryCode: "EE", countryName: "Estonia", requiredLocales: ["et"], isEU: true },
  FI: { countryCode: "FI", countryName: "Finland", requiredLocales: ["fi", "sv"], isEU: true },
  FR: { countryCode: "FR", countryName: "France", requiredLocales: ["fr"], isEU: true },
  DE: { countryCode: "DE", countryName: "Germany", requiredLocales: ["de"], isEU: true },
  GR: { countryCode: "GR", countryName: "Greece", requiredLocales: ["el"], isEU: true },
  HU: { countryCode: "HU", countryName: "Hungary", requiredLocales: ["hu"], isEU: true },
  IE: { countryCode: "IE", countryName: "Ireland", requiredLocales: ["en"], isEU: true },
  IT: { countryCode: "IT", countryName: "Italy", requiredLocales: ["it"], isEU: true },
  LV: { countryCode: "LV", countryName: "Latvia", requiredLocales: ["lv"], isEU: true },
  LT: { countryCode: "LT", countryName: "Lithuania", requiredLocales: ["lt"], isEU: true },
  LU: { countryCode: "LU", countryName: "Luxembourg", requiredLocales: ["fr", "de"], isEU: true },
  MT: { countryCode: "MT", countryName: "Malta", requiredLocales: ["mt", "en"], isEU: true },
  NL: { countryCode: "NL", countryName: "Netherlands", requiredLocales: ["nl"], isEU: true },
  PL: { countryCode: "PL", countryName: "Poland", requiredLocales: ["pl"], isEU: true },
  PT: { countryCode: "PT", countryName: "Portugal", requiredLocales: ["pt"], isEU: true },
  RO: { countryCode: "RO", countryName: "Romania", requiredLocales: ["ro"], isEU: true },
  SK: { countryCode: "SK", countryName: "Slovakia", requiredLocales: ["sk"], isEU: true },
  SI: { countryCode: "SI", countryName: "Slovenia", requiredLocales: ["sl"], isEU: true },
  ES: { countryCode: "ES", countryName: "Spain", requiredLocales: ["es"], isEU: true },
  SE: { countryCode: "SE", countryName: "Sweden", requiredLocales: ["sv"], isEU: true },
};

function normalizeCountryCode(input?: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (MARKET_BY_COUNTRY_CODE[upper]) {
    return upper;
  }
  const alias = COUNTRY_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  return null;
}

export function resolveEUMarketProfile(destinationCountry?: string): MarketProfile {
  const code = normalizeCountryCode(destinationCountry);
  if (code && MARKET_BY_COUNTRY_CODE[code]) {
    return MARKET_BY_COUNTRY_CODE[code];
  }
  return {
    countryCode: code || "EU",
    countryName: destinationCountry || "European Union",
    requiredLocales: ["en"],
    isEU: true,
  };
}

export function getLabelText(locales: string[], key: FieldLabelKey): string {
  const normalized = locales.map((locale) => locale.toLowerCase()).filter(Boolean);
  if (normalized.length === 0) {
    return LABELS.en[key];
  }
  const values = normalized
    .slice(0, 2)
    .map((locale) => LABELS[locale]?.[key] || LABELS.en[key]);
  return values.length > 1 && values[0] !== values[1] ? `${values[0]} / ${values[1]}` : values[0];
}

export function getRenderLocales(requiredLocales: string[]): string[] {
  const normalized = requiredLocales.map((locale) => locale.toLowerCase()).filter(Boolean);
  if (normalized.length === 0) return ["en"];
  if (normalized.length === 1) return normalized;
  return normalized.slice(0, 2);
}

