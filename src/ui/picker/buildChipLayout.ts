/**
 * buildChipLayout — splits a list of chips (by width) into pages of
 * wrapping rows. Pure: no Phaser.
 */

/** Room the chips may use. */
export interface ChipPageBox {
  readonly maxWidth: number;
  readonly gap: number;
  readonly maxRows: number;
}

/**
 * @param widths - Chip widths in order.
 * @param box - Row width, gap and rows per page.
 * @returns Pages of rows of chip indices; always at least one (possibly empty) page.
 */
export function pageChips(
  widths: readonly number[],
  box: ChipPageBox,
): number[][][] {
  const pages: number[][][] = [[]];
  let rowWidth = 0;
  widths.forEach((width, index) => {
    let page = pages[pages.length - 1]!;
    let row = page[page.length - 1];
    const fits = row !== undefined && rowWidth + box.gap + width <= box.maxWidth;
    if (!row || !fits) {
      if (page.length >= box.maxRows) {
        page = [];
        pages.push(page);
      }
      row = [];
      page.push(row);
      rowWidth = 0;
    }
    rowWidth += (row.length > 0 ? box.gap : 0) + width;
    row.push(index);
  });
  return pages;
}
