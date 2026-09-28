import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkSearchUrl, locationUrl, parseSearch, stateUrl, withFilters } from "./parse.mjs";

const read = (n) => fs.readFileSync(new URL(`./fixtures/zillow-${n}.html`, import.meta.url), "utf8");

test("zillow for sale: 41 homes with every core field", () => {
  const r = parseSearch(read("sale"));
  assert.equal(r.listings.length, 41);
  assert.equal(r.totalPages, 20);
  assert.ok(r.total > 1000);
  assert.deepEqual(r.queryState.regionSelection, [{ regionId: 10221, regionType: 6 }]);
  for (const l of r.listings) {
    assert.match(l.zpid, /^\d+$/);
    assert.ok(l.address && l.url.startsWith("https://www.zillow.com/") && l.price > 0 && l.beds != null && l.baths != null && l.livingArea > 0 && l.latitude && l.longitude, l.zpid);
    assert.equal(l.status, "FOR_SALE");
  }
  const first = r.listings[0];
  assert.deepEqual(
    [first.zpid, first.address, first.price, first.beds, first.baths, first.livingArea, first.homeType, first.zipcode, first.currency],
    ["58307080", "12301 Meuse Cv, Austin, TX 78727", 560000, 4, 3, 2188, "SINGLE_FAMILY", "78727", "USD"],
  );
  assert.ok(first.photos.length > 1 && first.photos[0].startsWith("https://photos.zillowstatic.com/"));
});

test("zillow for rent: apartment buildings carry unit prices and bed range", () => {
  const r = parseSearch(read("rent"));
  assert.equal(r.listings.length, 41);
  const b = r.listings.find((l) => l.isBuilding);
  assert.ok(b && b.zpid === null && b.id && b.url.includes("/apartments/"));
  assert.ok(b.units.length > 0 && b.price > 0 && b.priceMax >= b.price && b.beds != null && b.latitude, JSON.stringify(b));
  for (const l of r.listings) assert.equal(l.status, "FOR_RENT");
});

test("zillow: a bot page is not a results page", () => {
  assert.equal(parseSearch("<html><title>Access to this page has been denied</title></html>"), null);
});

test("zillow: urls and filters", () => {
  assert.equal(locationUrl("Austin, TX"), "https://www.zillow.com/homes/for_sale/Austin,-TX_rb/");
  assert.equal(locationUrl("78704", "FOR_RENT"), "https://www.zillow.com/homes/for_rent/78704_rb/");
  assert.equal(locationUrl("Denver, CO", "SOLD"), "https://www.zillow.com/homes/recently_sold/Denver,-CO_rb/");
  const qs = { mapBounds: { west: 1 }, filterState: { sortSelection: { value: "days" }, isForRent: { value: true } } };
  const f = withFilters(qs, { minPrice: 1500, maxPrice: 2500, minBeds: 2, minBaths: 0 });
  assert.deepEqual(f.filterState.mp, { min: 1500, max: 2500 });
  assert.deepEqual(f.filterState.beds, { min: 2 });
  assert.equal(f.filterState.baths, undefined);
  assert.equal(qs.filterState.mp, undefined);
  const s = JSON.parse(new URL(stateUrl(f, 3)).searchParams.get("searchQueryState"));
  assert.deepEqual(s.pagination, { currentPage: 3 });
  assert.deepEqual(s.filterState.sort, { value: "days" });
  assert.equal(withFilters({ filterState: {} }, { maxPrice: 500000 }).filterState.price.max, 500000);
  assert.equal(checkSearchUrl("https://zillow.com/austin-tx/rentals/"), "https://www.zillow.com/austin-tx/rentals/");
  assert.throws(() => checkSearchUrl("https://www.zillow.com/homedetails/x/1_zpid/"));
  assert.throws(() => checkSearchUrl("https://www.redfin.com/city/1"));
});
