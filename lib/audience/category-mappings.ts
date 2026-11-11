// Building recipient → category rows for the Audience "move to folder" action.
//
// Both id lists come from the request body, so both are filtered against
// what the caller's workspace actually owns. Filtering only the categories
// (as the route used to) let a caller file another workspace's recipient
// into one of their own folders, which then pulled that stranger into
// folder-based sends and folder listings.

export type CategoryMapping = { recipientId: string; categoryId: string };

/**
 * Every (recipient, category) pair the caller asked for whose recipient and
 * category both belong to their workspace. Duplicate ids are collapsed.
 */
export function buildCategoryMappings(input: {
  recipientIds: string[];
  categoryIds: string[];
  ownedRecipientIds: Iterable<string>;
  ownedCategoryIds: Iterable<string>;
}): CategoryMapping[] {
  const ownedRecipients = new Set(input.ownedRecipientIds);
  const ownedCategories = new Set(input.ownedCategoryIds);
  const recipients = [...new Set(input.recipientIds)].filter((id) => ownedRecipients.has(id));
  const categories = [...new Set(input.categoryIds)].filter((id) => ownedCategories.has(id));

  const values: CategoryMapping[] = [];
  for (const recipientId of recipients) {
    for (const categoryId of categories) {
      values.push({ recipientId, categoryId });
    }
  }
  return values;
}
