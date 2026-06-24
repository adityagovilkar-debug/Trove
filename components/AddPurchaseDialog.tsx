"use client";

import type { ProductGroup } from "@/lib/products";
import { RepurchaseDialog, seedFromProduct } from "./RepurchaseDialog";

// Records another purchase (lot) of an existing product from the inventory view.
// Thin wrapper over RepurchaseDialog seeded from the product group.
export function AddPurchaseDialog({
  product,
  onClose,
}: {
  product: ProductGroup;
  onClose: () => void;
}) {
  return (
    <RepurchaseDialog
      seed={seedFromProduct(product)}
      title="New purchase"
      onClose={onClose}
    />
  );
}
