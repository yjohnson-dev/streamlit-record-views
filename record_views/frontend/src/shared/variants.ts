import { renderLedgerCard } from "../cards/ledger_card/layout";
import { renderPropertyCard } from "../cards/property_card/layout";
import { renderRecordCard } from "../cards/record_card/layout";
import { renderTileCard } from "../cards/tile_card/layout";
import type { CardVariant, ViewData } from "./types";

/** The layout of each card variant at every size. */
export const LAYOUTS: Record<CardVariant, (d: ViewData) => (HTMLElement | null)[]> = {
  record: renderRecordCard,
  tile: renderTileCard,
  property: renderPropertyCard,
  ledger: renderLedgerCard,
};
