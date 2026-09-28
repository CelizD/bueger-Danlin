"use client";

import { useState } from "react";
import type {
  CreateInventoryForm,
  InventoryDraft,
  InventoryItem,
} from "./types";

const EMPTY_CREATE: CreateInventoryForm = {
  name: "",
  unit: "unidad",
  stock: "0",
  threshold: "5",
};

function draftFromItem(
  item: InventoryItem,
): InventoryDraft {
  return {
    name: item.name,
    unit: item.unit,
    stock: String(item.stockQuantity),
    threshold: String(
      item.lowStockThreshold,
    ),
  };
}

export function useInventoryForms() {
  const [createOpen, setCreateOpen] =
    useState(false);
  const [createForm, setCreateForm] =
    useState<CreateInventoryForm>(
      EMPTY_CREATE,
    );
  const [drafts, setDrafts] =
    useState<
      Record<string, InventoryDraft>
    >({});

  function syncDrafts(
    items: InventoryItem[],
  ) {
    setDrafts(
      Object.fromEntries(
        items.map((item) => [
          item.id,
          draftFromItem(item),
        ]),
      ),
    );
  }

  function setCreateField(
    field: keyof CreateInventoryForm,
    value: string,
  ) {
    setCreateForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openCreate() {
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setCreateForm(EMPTY_CREATE);
  }

  function resetCreate() {
    setCreateForm(EMPTY_CREATE);
    setCreateOpen(false);
  }

  function getDraft(
    item: InventoryItem,
  ) {
    return (
      drafts[item.id] ??
      draftFromItem(item)
    );
  }

  function setDraftField(
    item: InventoryItem,
    field: keyof InventoryDraft,
    value: string,
  ) {
    setDrafts((current) => {
      const draft =
        current[item.id] ??
        draftFromItem(item);

      return {
        ...current,
        [item.id]: {
          ...draft,
          [field]: value,
        },
      };
    });
  }

  return {
    createOpen,
    createForm,
    drafts,
    syncDrafts,
    setCreateField,
    openCreate,
    closeCreate,
    resetCreate,
    getDraft,
    setDraftField,
  };
}
