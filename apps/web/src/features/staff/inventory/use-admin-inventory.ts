"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createAdminInventoryItem,
  deleteAdminInventoryItem,
  fetchAdminInventory,
  setAdminInventoryItemActive,
  updateAdminInventoryItem,
} from "./api";
import type {
  InventoryItem,
  StaffUser,
} from "./types";
import { useInventoryForms } from "./use-inventory-forms";

export function useAdminInventory() {
  const [user, setUser] =
    useState<StaffUser | null>(null);
  const [items, setItems] =
    useState<InventoryItem[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [busyId, setBusyId] =
    useState<string | null>(null);
  const [creating, setCreating] =
    useState(false);
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");

  const forms = useInventoryForms();

  async function load(
    showRefresh = false,
  ) {
    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const result =
        await fetchAdminInventory();

      if (!result.authorized) {
        window.location.replace(
          "/admin/login",
        );
        return;
      }

      setUser(result.user);
      setItems(result.items);
      forms.syncDrafts(
        result.items,
      );
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el inventario.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(
    () => ({
      total: items.filter(
        (item) => item.active,
      ).length,
      low: items.filter(
        (item) =>
          item.lowStock &&
          !item.outOfStock,
      ).length,
      out: items.filter(
        (item) => item.outOfStock,
      ).length,
    }),
    [items],
  );

  function openCreate() {
    setError("");
    setSuccess("");
    forms.openCreate();
  }

  async function createItem(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const data =
        await createAdminInventoryItem(
          forms.createForm,
        );

      setSuccess(
        `${data.name} agregado al inventario.`,
      );
      forms.resetCreate();
      await load();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear el artículo.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveItem(
    item: InventoryItem,
  ) {
    const draft =
      forms.getDraft(item);

    setBusyId(item.id);
    setError("");
    setSuccess("");

    try {
      const data =
        await updateAdminInventoryItem(
          item.id,
          draft,
        );

      setSuccess(
        `${data.name} actualizado correctamente.`,
      );
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el inventario.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function toggleItem(
    item: InventoryItem,
  ) {
    setBusyId(item.id);
    setError("");
    setSuccess("");

    try {
      await setAdminInventoryItemActive(
        item.id,
        !item.active,
      );

      setSuccess(
        `${item.name} ${
          !item.active
            ? "activado"
            : "desactivado"
        }.`,
      );
      await load();
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "No se pudo actualizar el artículo.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(
    item: InventoryItem,
  ) {
    if (!item.deletable) {
      setError(
        item.linkedToSales
          ? "Este artículo está vinculado a ventas. Desactívalo en lugar de eliminarlo."
          : "Este artículo tiene historial y no puede eliminarse.",
      );
      return;
    }

    const confirmed =
      window.confirm(
        `¿Eliminar ${item.name} del inventario? Esta acción no se puede deshacer.`,
      );

    if (!confirmed) {
      return;
    }

    setBusyId(item.id);
    setError("");
    setSuccess("");

    try {
      await deleteAdminInventoryItem(
        item.id,
      );

      setSuccess(
        `${item.name} eliminado del inventario.`,
      );
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el artículo.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return {
    ...forms,
    user,
    items,
    summary,
    loading,
    refreshing,
    busyId,
    creating,
    error,
    success,
    load,
    openCreate,
    createItem,
    saveItem,
    toggleItem,
    deleteItem,
  };
}
