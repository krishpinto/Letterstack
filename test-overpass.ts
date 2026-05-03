import { scrapeOverpass } from "./src/lib/sources/overpass";

async function test() {
  const results = await scrapeOverpass({
    city: "Mumbai",
    category: "restaurant",
    radius: 5000
  });

  
  console.log(`Found ${results.length} results`);
  console.log("Sample:", JSON.stringify(results[0], null, 2));
}

test();