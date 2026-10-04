"use client";

import { loadOrderingData } from "./api";
import {
  appendBurger,
  burgersForPickupSelection,
  setBurgerModifierQuantities,
  type ModifierQuantityUpdate,
} from "./builder";
import { newBurger } from "./formatters";
import {
  availableComboLimit,
  calculatePreviewTotal,
  modifierOptions,
  productInventoryLimit,
  unavailableIncludedModifierIds,
} from "./selectors";
import type {
  BurgerSelection,
  CatalogProduct,
  InventoryAvailability,
  PickupEvent,
} from "./types";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

export function useOrderingSession(
  setError: (message: string) => void,
) {
  const [catalog, setCatalog] =
    useState<CatalogProduct[]>([]);
  const [events, setEvents] =
    useState<PickupEvent[]>([]);
  const [event, setEvent] =
    useState<PickupEvent | null>(null);
  const [inventory, setInventory] =
    useState<InventoryAvailability | null>(
      null,
    );
  const [burgers, setBurgers] =
    useState<BurgerSelection[]>([]);
  const [cokes, setCokes] =
    useState(0);
  const [
    groupDeliveryAccepted,
    setGroupDeliveryAccepted,
  ] = useState(false);
  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const {
          catalog: catalogData,
          events: eventData,
          inventory: inventoryData,
        } = await loadOrderingData();

        const comboData =
          catalogData.find(
            (product) =>
              product.type === "COMBO",
          );
        const unavailableIncludedIds =
          unavailableIncludedModifierIds(
            comboData,
            inventoryData,
          );
        const comboInventoryLimit =
          productInventoryLimit(
            comboData,
            inventoryData,
          );

        if (!cancelled) {
          const pickupCode =
            new URLSearchParams(
              window.location.search,
            )
              .get("pickup")
              ?.trim()
              .toUpperCase() ?? "";

          const preselected =
            eventData.find(
              (item) =>
                item.status === "OPEN" &&
                (item.pickupPoint.code.toUpperCase() ===
                  pickupCode ||
                  item.code.toUpperCase() ===
                    pickupCode),
            ) ??
            (eventData.length === 1 &&
            eventData[0]?.status === "OPEN"
              ? eventData[0]
              : null);

          setCatalog(catalogData);
          setInventory(inventoryData);
          setEvents(eventData);
          setEvent(preselected);
          setBurgers(
            preselected &&
              preselected.remainingCombos >
                0 &&
              comboInventoryLimit > 0
              ? [
                  newBurger(
                    unavailableIncludedIds,
                  ),
                ]
              : [],
          );
        }
      } catch {
        if (!cancelled) {
          setError(
            "No pudimos conectar con el servidor local. Revisa que el API y PostgreSQL estén encendidos.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [setError]);

  const combo = catalog.find(
    (product) => product.type === "COMBO",
  );
  const coke = catalog.find(
    (product) =>
      product.slug === "coca-cola-lata",
  );

  const comboInventoryLimit =
    productInventoryLimit(
      combo,
      inventory,
    );
  const cokeInventoryLimit =
    productInventoryLimit(
      coke,
      inventory,
    );
  const maxCombosAvailable =
    availableComboLimit(
      event,
      comboInventoryLimit,
    );

  const removableOptions = useMemo(
    () =>
      modifierOptions(
        combo,
        "REMOVABLE",
      ),
    [combo],
  );

  const extraOptions = useMemo(
    () =>
      modifierOptions(
        combo,
        "EXTRA",
      ),
    [combo],
  );

  const previewTotal = useMemo(
    () =>
      calculatePreviewTotal(
        burgers,
        combo,
        coke,
        cokes,
        extraOptions,
      ),
    [
      burgers,
      combo,
      coke,
      cokes,
      extraOptions,
    ],
  );

  function selectPickupEvent(
    nextEvent: PickupEvent,
  ) {
    if (nextEvent.status !== "OPEN") {
      return;
    }

    const nextLimit =
      availableComboLimit(
        nextEvent,
        comboInventoryLimit,
      );

    setEvent(nextEvent);
    setGroupDeliveryAccepted(false);
    setError("");
    setBurgers((current) =>
      burgersForPickupSelection(
        current,
        nextLimit,
        combo,
        inventory,
      ),
    );

    const url = new URL(
      window.location.href,
    );
    url.searchParams.set(
      "pickup",
      nextEvent.pickupPoint.code,
    );
    window.history.replaceState(
      null,
      "",
      url,
    );
  }

  function setModifierQuantities(
    burgerId: string,
    updates: ModifierQuantityUpdate[],
  ) {
    const result =
      setBurgerModifierQuantities(
        burgers,
        burgerId,
        updates,
        inventory,
      );

    if (result.error) {
      setError(result.error);
      return;
    }

    setError("");
    setBurgers(result.burgers);
  }

  function addBurger() {
    if (
      !event ||
      burgers.length >=
        maxCombosAvailable
    ) {
      return;
    }

    setBurgers(
      appendBurger(
        burgers,
        removableOptions,
        inventory,
      ),
    );
  }

  function removeBurger(
    localId: string,
  ) {
    setBurgers((current) =>
      current.filter(
        (burger) =>
          burger.localId !== localId,
      ),
    );
  }

  return {
    events,
    event,
    inventory,
    burgers,
    cokes,
    groupDeliveryAccepted,
    loading,
    combo,
    coke,
    comboInventoryLimit,
    cokeInventoryLimit,
    maxCombosAvailable,
    removableOptions,
    extraOptions,
    previewTotal,
    setCokes,
    setGroupDeliveryAccepted,
    selectPickupEvent,
    setModifierQuantities,
    addBurger,
    removeBurger,
  };
}
