// Zillow search results from the page's embedded Next.js state. Pure: HTML in, plain objects out.

const BASE = "https://www.zillow.com";
export const PER_PAGE = 41;
export const MAX_PAGES = 20;

/** The embedded search state, or null when this is not a results page (bot check, captcha, other page). */
export function searchState(html) {
  const m = String(html ?? "").match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1])?.props?.pageProps?.searchPageState ?? null;
  } catch {
    return null;
  }
}

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && String(v).match(/\d/) ? n : null;
};
const round = (v, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const abs = (u) => (!u ? null : u.startsWith("http") ? u : `${BASE}${u.startsWith("/") ? "" : "/"}${u}`);
const iso = (ms) => (typeof ms === "number" && ms > 0 ? new Date(ms).toISOString().slice(0, 10) : null);

function photos(r) {
  const c = r.carouselPhotosComposable;
  if (c?.baseUrl && Array.isArray(c.photoData)) return c.photoData.map((p) => p?.photoKey && c.baseUrl.replace("{photoKey}", p.photoKey)).filter(Boolean);
  return (r.carouselPhotos ?? []).map((p) => p?.url).filter(Boolean);
}

/** One list result → a flat property record. Apartment buildings (rentals) carry a unit list instead of one price. */
export function parseResult(r) {
  if (!r || typeof r !== "object") return null;
  const h = r.hdpData?.homeInfo ?? {};
  const zpidRaw = h.zpid ?? r.zpid;
  const zpid = /^\d+$/.test(String(zpidRaw ?? "")) ? String(zpidRaw) : null;
  const id = zpid ?? (r.lotId ? `lot-${r.lotId}` : r.id ? String(r.id) : null);
  if (!id) return null;
  const units = (r.units ?? []).map((u) => ({ price: num(u?.price), priceText: u?.price ?? null, beds: num(u?.beds), roomForRent: !!u?.roomForRent }));
  const unitPrices = units.map((u) => u.price).filter((x) => x != null);
  const unitBeds = units.map((u) => u.beds).filter((x) => x != null);
  const isBuilding = !!r.isBuilding || (!zpid && units.length > 0);
  const status = r.statusType ?? h.homeStatus ?? null;
  const price = num(r.unformattedPrice) ?? num(h.price) ?? num(r.soldPrice) ?? (isBuilding ? (num(r.minBaseRent) ?? (unitPrices.length ? Math.min(...unitPrices) : null)) : null) ?? num(r.price);
  const lat = r.latLong?.latitude ?? h.latitude ?? null;
  const lng = r.latLong?.longitude ?? h.longitude ?? null;
  const pics = photos(r);
  return {
    zpid,
    id,
    url: abs(r.detailUrl),
    status,
    statusText: r.statusText ?? null,
    homeType: h.homeType ?? (isBuilding ? "APARTMENT_BUILDING" : null),
    address: r.address ?? ([h.streetAddress, h.city, [h.state, h.zipcode].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null),
    street: r.addressStreet ?? h.streetAddress ?? null,
    unit: h.unit ?? null,
    city: r.addressCity ?? h.city ?? null,
    state: r.addressState ?? h.state ?? null,
    zipcode: r.addressZipcode ?? h.zipcode ?? null,
    price,
    priceText: r.price ?? r.soldPrice ?? (unitPrices.length ? units.find((u) => u.price === Math.min(...unitPrices))?.priceText : null) ?? null,
    priceMax: isBuilding ? (num(r.maxBaseRent) ?? (unitPrices.length ? Math.max(...unitPrices) : null)) : null,
    currency: h.currency ?? (r.countryCurrency === "$" ? "USD" : null),
    beds: num(r.beds) ?? num(h.bedrooms) ?? (unitBeds.length ? Math.min(...unitBeds) : null),
    bedsMax: isBuilding && unitBeds.length ? Math.max(...unitBeds) : null,
    baths: round(num(r.baths) ?? num(h.bathrooms), 1),
    livingArea: num(r.area) ?? num(h.livingArea),
    livingAreaUnit: r.area || h.livingArea ? "sqft" : null,
    lotArea: round(num(h.lotAreaValue), 4),
    lotAreaUnit: h.lotAreaUnit ?? null,
    latitude: lat,
    longitude: lng,
    zestimate: num(r.zestimate) ?? num(h.zestimate),
    rentZestimate: num(h.rentZestimate),
    taxAssessedValue: num(h.taxAssessedValue),
    daysOnZillow: typeof h.daysOnZillow === "number" && h.daysOnZillow >= 0 ? h.daysOnZillow : null,
    dateSold: iso(h.dateSold),
    brokerName: r.brokerName ?? null,
    isBuilding,
    buildingName: r.buildingName ?? null,
    units: isBuilding ? units : [],
    availableUnits: r.availabilityCount ?? null,
    openHouse: h.openHouse ?? r.openHouseDescription ?? null,
    flexText: r.flexFieldText ?? r.listCardRecommendation?.flexFieldRecommendations?.[0]?.displayString ?? null,
    isNewConstruction: !!h.listing_sub_type?.is_newHome || /new construction/i.test(r.statusText ?? ""),
    isForeclosure: !!h.listing_sub_type?.is_foreclosure || !!h.isPreforeclosureAuction,
    isFsbo: !!h.listing_sub_type?.is_FSBO,
    isComingSoon: !!h.listing_sub_type?.is_comingSoon,
    has3DModel: !!r.has3DModel,
    hasVideo: !!r.hasVideo,
    imgSrc: r.imgSrc ?? pics[0] ?? null,
    photos: pics,
  };
}

/** A results page → { listings, queryState, total, totalPages, nextUrl } or null when not a results page. */
export function parseSearch(html) {
  const s = searchState(html);
  if (!s?.cat1) return null;
  const list = s.cat1.searchList ?? {};
  const results = s.cat1.searchResults?.listResults ?? [];
  return {
    listings: results.map(parseResult).filter(Boolean),
    queryState: s.queryState ?? null,
    total: list.totalResultCount ?? s.categoryTotals?.cat1?.totalResultCount ?? null,
    totalPages: list.totalPages ?? null,
    perPage: list.resultsPerPage ?? PER_PAGE,
    nextUrl: list.pagination?.nextUrl ?? null,
  };
}

const PATHS = { FOR_SALE: "for_sale", FOR_RENT: "for_rent", SOLD: "recently_sold" };

/** Search URL for a place ("Austin, TX", "78704", "Brooklyn, NY") and listing type. */
export function locationUrl(location, type = "FOR_SALE") {
  const slug = String(location).trim().replace(/\s+/g, "-").replace(/[/?#]/g, "");
  return `${BASE}/homes/${PATHS[type] ?? PATHS.FOR_SALE}/${encodeURIComponent(slug).replace(/%2C/gi, ",")}_rb/`;
}

/** Add price/beds/baths filters to a query state (rentals filter on monthly rent). */
export function withFilters(qs, f = {}, type = "FOR_SALE") {
  const out = structuredClone(qs ?? {});
  const fs = (out.filterState ??= {});
  const range = (min, max) => {
    const r = {};
    if (Number.isFinite(min) && min > 0) r.min = min;
    if (Number.isFinite(max) && max > 0) r.max = max;
    return Object.keys(r).length ? r : null;
  };
  const rent = type === "FOR_RENT" || fs.isForRent?.value === true;
  const p = range(f.minPrice, f.maxPrice);
  if (p) fs[rent ? "mp" : "price"] = p;
  const b = range(f.minBeds, f.maxBeds);
  if (b) fs.beds = b;
  const ba = range(f.minBaths);
  if (ba) fs.baths = ba;
  return out;
}

export function hasFilters(f = {}) {
  return [f.minPrice, f.maxPrice, f.minBeds, f.maxBeds, f.minBaths].some((v) => Number.isFinite(v) && v > 0);
}

/** A search URL for one page of a query state. */
export function stateUrl(qs, page = 1) {
  const s = { ...structuredClone(qs ?? {}), isListVisible: true, isMapVisible: true };
  // The page echoes the sort as sortSelection; the URL form is sort.
  if (s.filterState?.sortSelection) {
    s.filterState.sort = s.filterState.sortSelection;
    delete s.filterState.sortSelection;
  }
  if (page > 1) s.pagination = { currentPage: page };
  else delete s.pagination;
  return `${BASE}/homes/?searchQueryState=${encodeURIComponent(JSON.stringify(s))}`;
}

/** Normalise a user-supplied Zillow search URL, or throw with a readable reason. */
export function checkSearchUrl(raw) {
  const u = new URL(String(raw).trim());
  if (!/(^|\.)zillow\.com$/.test(u.hostname)) throw new Error("Use a zillow.com search results URL.");
  if (/\/(homedetails|b|apartments)\//.test(u.pathname)) throw new Error("This is a property page. Use a search results URL (e.g. zillow.com/austin-tx/ or one with ?searchQueryState=...).");
  u.hostname = "www.zillow.com";
  u.protocol = "https:";
  return u.toString();
}
