// Windowed page numbers for a pager: first, last, a sibling range around the
// current page, and "ellipsis" markers for the gaps. Without this, rendering
// every page number (e.g. 38 pages after importing 946 contacts) overflows
// the toolbar off the edge of the screen instead of wrapping or scrolling.
export type PaginationEntry = number | "ellipsis";

export function paginationRange(
  current: number,
  total: number,
  siblingCount = 1,
): PaginationEntry[] {
  const totalSlots = siblingCount * 2 + 5; // first + last + current + 2 ellipses
  if (totalSlots >= total) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftCount = 3 + siblingCount * 2;
    const leftRange = Array.from({ length: leftCount }, (_, index) => index + 1);
    return [...leftRange, "ellipsis", total];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightCount = 3 + siblingCount * 2;
    const rightRange = Array.from(
      { length: rightCount },
      (_, index) => total - rightCount + index + 1,
    );
    return [1, "ellipsis", ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, index) => leftSibling + index,
  );
  return [1, "ellipsis", ...middleRange, "ellipsis", total];
}
