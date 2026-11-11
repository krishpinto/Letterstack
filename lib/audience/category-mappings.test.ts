import { describe, expect, it } from "vitest";

import { buildCategoryMappings } from "./category-mappings";

describe("buildCategoryMappings", () => {
  it("pairs every owned recipient with every owned category", () => {
    expect(
      buildCategoryMappings({
        recipientIds: ["r1", "r2"],
        categoryIds: ["c1"],
        ownedRecipientIds: ["r1", "r2"],
        ownedCategoryIds: ["c1"],
      }),
    ).toEqual([
      { recipientId: "r1", categoryId: "c1" },
      { recipientId: "r2", categoryId: "c1" },
    ]);
  });

  it("drops recipients from another workspace", () => {
    expect(
      buildCategoryMappings({
        recipientIds: ["r1", "foreign"],
        categoryIds: ["c1"],
        ownedRecipientIds: ["r1"],
        ownedCategoryIds: ["c1"],
      }),
    ).toEqual([{ recipientId: "r1", categoryId: "c1" }]);
  });

  it("drops categories from another workspace", () => {
    expect(
      buildCategoryMappings({
        recipientIds: ["r1"],
        categoryIds: ["c1", "foreign"],
        ownedRecipientIds: ["r1"],
        ownedCategoryIds: ["c1"],
      }),
    ).toEqual([{ recipientId: "r1", categoryId: "c1" }]);
  });

  it("collapses duplicate ids", () => {
    expect(
      buildCategoryMappings({
        recipientIds: ["r1", "r1"],
        categoryIds: ["c1", "c1"],
        ownedRecipientIds: ["r1"],
        ownedCategoryIds: ["c1"],
      }),
    ).toHaveLength(1);
  });
});
