"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchAdminSaturdays,
  saveAdminPickupEvent,
  toggleAdminPickupEvent,
} from "./api";
import {
  nextSaturdayDefaults,
  tijuanaParts,
} from "./date-utils";
import type {
  PickupEvent,
  SaturdayFormState,
  StaffUser,
} from "./types";

export function useAdminSaturdays() {
  const [user, setUser] =
    useState<StaffUser | null>(null);
  const [events, setEvents] =
    useState<PickupEvent[]>([]);
  const [form, setForm] =
    useState<SaturdayFormState>(
      () => nextSaturdayDefaults(),
    );
  const [editingId, setEditingId] =
    useState<string | null>(null);
  const [formOpen, setFormOpen] =
    useState(false);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [busyId, setBusyId] =
    useState<string | null>(null);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");
  const [qrEvent, setQrEvent] =
    useState<PickupEvent | null>(null);
  const [
    customerOrigin,
    setCustomerOrigin,
  ] = useState("");

  async function load(
    showRefresh = false,
  ) {
    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const result =
        await fetchAdminSaturdays();

      if (!result.authorized) {
        window.location.replace(
          "/admin/login",
        );
        return;
      }

      setUser(result.user);
      setEvents(result.events);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar las fechas de entrega.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setCustomerOrigin(
      window.location.origin,
    );
    void load();
  }, []);

  const deliveryTermsLocked =
    editingId !== null &&
    (events.find(
      (event) =>
        event.id === editingId,
    )?.orderCount ?? 0) > 0;

  const activeEvent = useMemo(
    () =>
      events.find(
        (event) =>
          event.status === "OPEN" ||
          event.status ===
            "SOLD_OUT",
      ) ?? null,
    [events],
  );

  function setFormField(
    field: keyof SaturdayFormState,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(
      nextSaturdayDefaults(),
    );
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  function openEdit(
    event: PickupEvent,
  ) {
    const pickup =
      tijuanaParts(
        event.startsAt,
      );
    const close =
      tijuanaParts(
        event.closesAt,
      );

    setEditingId(event.id);
    setForm({
      locationLabel:
        event.locationLabel,
      locationAddress:
        event.pickupPoint.address ?? "",
      latitude:
        event.pickupPoint.latitude == null
          ? ""
          : String(
              event.pickupPoint.latitude,
            ),
      longitude:
        event.pickupPoint.longitude == null
          ? ""
          : String(
              event.pickupPoint.longitude,
            ),
      freeDeliveryMinPaidOrders:
        String(
          event.groupDelivery
            .minPaidOrders,
        ),
      transportCostMx:
        String(
          event.groupDelivery
            .transportCostCents /
            100,
        ),
      pickupDate:
        pickup.date,
      pickupTime:
        pickup.time,
      closeDate:
        close.date,
      closeTime:
        close.time,
      maxCombos: String(
        event.maxCombos,
      ),
    });
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(
      nextSaturdayDefaults(),
    );
  }

  async function save(
    eventSubmit:
      FormEvent<HTMLFormElement>,
  ) {
    eventSubmit.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const message =
        await saveAdminPickupEvent(
          editingId,
          form,
        );

      setSuccess(message);
      closeForm();
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la entrega.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeOpenState(
    event: PickupEvent,
  ) {
    setBusyId(event.id);
    setError("");
    setSuccess("");

    try {
      const message =
        await toggleAdminPickupEvent(
          event,
        );

      setSuccess(message);
      await load();
    } catch (stateError) {
      setError(
        stateError instanceof Error
          ? stateError.message
          : "No se pudo cambiar el estado.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return {
    user,
    events,
    form,
    editingId,
    formOpen,
    loading,
    saving,
    busyId,
    refreshing,
    error,
    success,
    qrEvent,
    customerOrigin,
    activeEvent,
    deliveryTermsLocked,
    load,
    setFormField,
    openCreate,
    openEdit,
    closeForm,
    save,
    changeOpenState,
    setQrEvent,
  };
}
