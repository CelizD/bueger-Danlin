"use client";

import { loadOrderingData } from "./api";
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

const EMPTY_INVENTORY: InventoryAvailability = {
  items: [],
  productLimits: {},
  modifierLimits: {},
};

export function useOrderingSession(
  setError: (message: string) => void,
) {
  const [catalog, setCatalog] = useState<
    CatalogProduct[]
  >([]);
  const [events, setEvents] = useState<
    PickupEvent[]
  >([]);
  const [event, setEvent] =
    useState<PickupEvent | null>(null);
  const [inventory, setInventory] =
    useState<InventoryAvailability | null>(
      null,
    );
  const [burgers, setBurgers] = useState<
    BurgerSelection[]
  >([]);
  const [cokes, setCokes] = useState(0);
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
    setBurgers((current) => {
      if (nextLimit <= 0) {
        return [];
      }

      if (current.length === 0) {
        return [
          newBurger(
            unavailableIncludedModifierIds(
              combo,
              inventory ??
                EMPTY_INVENTORY,
            ),
          ),
        ];
      }

      return current.slice(
        0,
        nextLimit,
      );
    });

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

  function toggleRemoved(
    burgerId: string,
    optionId: string,
  ) {
    const limit =
      inventory?.modifierLimits[
        optionId
      ];
    const burger = burgers.find(
      (item) =>
        item.localId === burgerId,
    );
    const tryingToInclude =
      burger?.removedIds.includes(
        optionId,
      ) ?? false;

    if (
      tryingToInclude &&
      limit !== undefined
    ) {
      const includedElsewhere =
        burgers.filter(
          (item) =>
            item.localId !==
              burgerId &&
            !item.removedIds.includes(
              optionId,
            ),
        ).length;

      if (
        includedElsewhere >= limit
      ) {
        setError(
          "Ese ingrediente ya no tiene inventario disponible.",
        );
        return;
      }
    }

    setBurgers((current) =>
      current.map((burgerItem) =>
        burgerItem.localId === burgerId
          ? {
              ...burgerItem,
              removedIds:
                burgerItem.removedIds.includes(
                  optionId,
                )
                  ? burgerItem.removedIds.filter(
                      (id) =>
                        id !== optionId,
                    )
                  : [
                      ...burgerItem.removedIds,
                      optionId,
                    ],
            }
          : burgerItem,
      ),
    );
  }

  function toggleExtra(
    burgerId: string,
    optionId: string,
  ) {
    const limit =
      inventory?.modifierLimits[
        optionId
      ];
    const selectedCount =
      burgers.filter((burger) =>
        burger.extraIds.includes(
          optionId,
        ),
      ).length;
    const burger = burgers.find(
      (item) =>
        item.localId === burgerId,
    );
    const alreadySelected =
      burger?.extraIds.includes(
        optionId,
      ) ?? false;

    if (
      !alreadySelected &&
      limit !== undefined &&
      selectedCount >= limit
    ) {
      setError(
        "Ese extra ya no tiene inventario disponible.",
      );
      return;
    }

    setBurgers((current) =>
      current.map((burgerItem) =>
        burgerItem.localId === burgerId
          ? {
              ...burgerItem,
              extraIds:
                burgerItem.extraIds.includes(
                  optionId,
                )
                  ? burgerItem.extraIds.filter(
                      (id) =>
                        id !== optionId,
                    )
                  : [
                      ...burgerItem.extraIds,
                      optionId,
                    ],
            }
          : burgerItem,
      ),
    );
  }

  function addBurger() {
    if (
      !event ||
      burgers.length >=
        maxCombosAvailable
    ) {
      return;
    }

    const removedForNewBurger =
      removableOptions
        .filter((option) => {
          const limit =
            inventory?.modifierLimits[
              option.id
            ];

          if (limit === undefined) {
            return false;
          }

          const currentlyIncluded =
            burgers.filter(
              (burger) =>
                !burger.removedIds.includes(
                  option.id,
                ),
            ).length;

          return (
            currentlyIncluded >= limit
          );
        })
        .map(
          (option) => option.id,
        );

    setBurgers((current) => [
      ...current,
      newBurger(
        removedForNewBurger,
      ),
    ]);
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
    toggleRemoved,
    toggleExtra,
    addBurger,
    removeBurger,
  };
}
