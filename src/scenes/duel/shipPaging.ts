/**
 * shipPaging — which ships of a faction the duel setup lists: a page of
 * four that always contains the selected ship unless the player paged away.
 * Pure: no Phaser.
 */

/** Ships listed per page. */
export const SHIPS_PER_PAGE = 4;

/** One page of ships. */
export interface ShipPage<T> {
  readonly items: readonly T[];
  /** Zero-based page shown. */
  readonly page: number;
  readonly pages: number;
  /** "5-8 OF 20 SHIPS". */
  readonly caption: string;
}

/**
 * @param ships - The faction's ships in list order.
 * @param selectedId - The selected ship.
 * @param requested - The page the player paged to (null = follow the selection).
 * @param size - Ships per page.
 * @returns The page to list.
 */
export function shipPage<T extends { readonly id: string }>(
  ships: readonly T[],
  selectedId: string,
  requested: number | null,
  size: number = SHIPS_PER_PAGE,
): ShipPage<T> {
  const pages = Math.max(1, Math.ceil(ships.length / size));
  const selectedIndex = ships.findIndex((ship) => ship.id === selectedId);
  const wanted = requested ?? Math.max(0, Math.floor(selectedIndex / size));
  const page = Math.min(pages - 1, Math.max(0, wanted));
  const items = ships.slice(page * size, page * size + size);
  const first = page * size + 1;
  return {
    items,
    page,
    pages,
    caption: `${first}-${first + items.length - 1} OF ${ships.length} SHIPS`,
  };
}
