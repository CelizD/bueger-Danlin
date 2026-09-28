"use client";

import {
  API_URL,
  apiFetch,
} from "@/lib/api/browser";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  nextSaturdayDefaults,
  tijuanaIso,
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
      const me = await apiFetch(
        API_URL + "/auth/me",
        {
          credentials: "include",
          cache: "no-store",
        },
      );

      if (me.status === 401) {
        window.location.replace(
          "/admin/login",
        );
        return;
      }

      const meData =
        await me.json();

      if (
        !me.ok ||
        meData.user.role !== "ADMIN"
      ) {
        window.location.replace(
          "/admin/login",
        );
        return;
      }

      setUser(meData.user);

      const response =
        await apiFetch(
          API_URL +
            "/admin/pickup-events",
          {
            credentials: "include",
            cache: "no-store",
          },
        );

      if (!response.ok) {
        throw new Error(
          "No se pudieron cargar las fechas de entrega.",
        );
      }

      setEvents(
        await response.json(),
      );
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
      const startsAtIso =
        tijuanaIso(
          form.pickupDate,
          form.pickupTime,
        );
      const closesAtIso =
        tijuanaIso(
          form.closeDate,
          form.closeTime,
        );
      const startsAt =
        new Date(startsAtIso);
      const closesAt =
        new Date(closesAtIso);
      const maxCombos =
        Number(form.maxCombos);

      if (
        Number.isNaN(
          startsAt.getTime(),
        ) ||
        Number.isNaN(
          closesAt.getTime(),
        ) ||
        !Number.isInteger(
          maxCombos,
        )
      ) {
        throw new Error(
          "Revisa la fecha, hora y límite de combos.",
        );
      }

      const response =
        await apiFetch(
          editingId
            ? API_URL +
                "/admin/pickup-events/" +
                editingId
            : API_URL +
                "/admin/pickup-events",
          {
            method:
              editingId
                ? "PATCH"
                : "POST",
            credentials:
              "include",
            headers: {
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              locationLabel:
                form.locationLabel.trim(),
              startsAt:
                startsAtIso,
              closesAt:
                closesAtIso,
              maxCombos,
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        const message =
          Array.isArray(
            data.message,
          )
            ? data.message.join(
                " ",
              )
            : data.message;

        throw new Error(
          message ||
            "No se pudo guardar la entrega.",
        );
      }

      setSuccess(
        editingId
          ? "La entrega se actualizó correctamente."
          : "La nueva entrega se creó como borrador.",
      );
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
    const shouldClose =
      event.status === "OPEN" ||
      event.status ===
        "SOLD_OUT";

    setBusyId(event.id);
    setError("");
    setSuccess("");

    try {
      const response =
        await apiFetch(
          API_URL +
            "/admin/pickup-events/" +
            event.id +
            (shouldClose
              ? "/close"
              : "/open"),
          {
            method: "POST",
            credentials:
              "include",
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        const message =
          Array.isArray(
            data.message,
          )
            ? data.message.join(
                " ",
              )
            : data.message;

        throw new Error(
          message ||
            (shouldClose
              ? "No se pudieron cerrar los pedidos."
              : "No se pudieron abrir los pedidos."),
        );
      }

      setSuccess(
        shouldClose
          ? "Pedidos cerrados para esa fecha."
          : "Pedidos abiertos. Esa es ahora la fecha activa para clientes.",
      );
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
