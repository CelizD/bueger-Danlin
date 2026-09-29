import {
  API_URL,
  apiFetch,
} from "@/lib/api/browser";
import { tijuanaIso } from "./date-utils";
import type {
  PickupEvent,
  SaturdayFormState,
  StaffUser,
} from "./types";

function responseMessage(
  data: { message?: string | string[] },
) {
  return Array.isArray(data.message)
    ? data.message.join(" ")
    : data.message;
}

export async function fetchAdminSaturdays(): Promise<
  | {
      authorized: false;
    }
  | {
      authorized: true;
      user: StaffUser;
      events: PickupEvent[];
    }
> {
  const me = await apiFetch(
    API_URL + "/auth/me",
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (me.status === 401) {
    return {
      authorized: false,
    };
  }

  const meData = await me.json();

  if (
    !me.ok ||
    meData.user.role !== "ADMIN"
  ) {
    return {
      authorized: false,
    };
  }

  const response = await apiFetch(
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

  return {
    authorized: true,
    user: meData.user,
    events:
      (await response.json()) as PickupEvent[],
  };
}

export async function saveAdminPickupEvent(
  editingId: string | null,
  form: SaturdayFormState,
) {
  const startsAtIso = tijuanaIso(
    form.pickupDate,
    form.pickupTime,
  );
  const closesAtIso = tijuanaIso(
    form.closeDate,
    form.closeTime,
  );
  const startsAt =
    new Date(startsAtIso);
  const closesAt =
    new Date(closesAtIso);
  const maxCombos =
    Number(form.maxCombos);
  const freeDeliveryMinPaidOrders =
    Number(
      form.freeDeliveryMinPaidOrders,
    );
  if (!form.locationAddress.trim()) {
    throw new Error(
      "Agrega la dirección exacta del punto de entrega.",
    );
  }

  if (!form.transportCostPesos.trim()) {
    throw new Error(
      "Agrega el costo total de traslado.",
    );
  }

  const transportCostPesos =
    Number(form.transportCostPesos);
  const transportCostCents =
    Math.round(
      transportCostPesos * 100,
    );
  const latitude =
    form.latitude.trim() === ""
      ? undefined
      : Number(form.latitude);
  const longitude =
    form.longitude.trim() === ""
      ? undefined
      : Number(form.longitude);

  if (
    Number.isNaN(
      startsAt.getTime(),
    ) ||
    Number.isNaN(
      closesAt.getTime(),
    ) ||
    !Number.isInteger(maxCombos) ||
    maxCombos < 1 ||
    maxCombos > 500
  ) {
    throw new Error(
      "Revisa la fecha, hora y límite de combos.",
    );
  }

  if (
    !Number.isInteger(
      freeDeliveryMinPaidOrders,
    ) ||
    freeDeliveryMinPaidOrders < 1 ||
    freeDeliveryMinPaidOrders > 100 ||
    freeDeliveryMinPaidOrders >
      maxCombos
  ) {
    throw new Error(
      "La meta de envío gratis debe ser un número válido y no puede superar el límite de combos.",
    );
  }

  if (
    !Number.isFinite(
      transportCostPesos,
    ) ||
    transportCostPesos < 0 ||
    transportCostCents > 100000
  ) {
    throw new Error(
      "El costo de traslado debe estar entre $0 y $1,000 MXN.",
    );
  }

  if (
    latitude !== undefined &&
    (!Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90)
  ) {
    throw new Error(
      "La latitud debe estar entre -90 y 90.",
    );
  }

  if (
    longitude !== undefined &&
    (!Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180)
  ) {
    throw new Error(
      "La longitud debe estar entre -180 y 180.",
    );
  }

  if (
    (latitude === undefined) !==
    (longitude === undefined)
  ) {
    throw new Error(
      "Si agregas coordenadas, captura latitud y longitud.",
    );
  }

  const response = await apiFetch(
    editingId
      ? API_URL +
          "/admin/pickup-events/" +
          editingId
      : API_URL +
          "/admin/pickup-events",
    {
      method: editingId
        ? "PATCH"
        : "POST",
      credentials: "include",
      headers: {
        "content-type":
          "application/json",
      },
      body: JSON.stringify({
        locationLabel:
          form.locationLabel.trim(),
        locationAddress:
          form.locationAddress.trim(),
        latitude,
        longitude,
        startsAt: startsAtIso,
        closesAt: closesAtIso,
        maxCombos,
        freeDeliveryMinPaidOrders,
        transportCostCents,
      }),
    },
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      responseMessage(data) ||
        "No se pudo guardar la entrega.",
    );
  }

  return editingId
    ? "La entrega se actualizó correctamente."
    : "La nueva entrega se creó como borrador.";
}

export async function toggleAdminPickupEvent(
  event: PickupEvent,
) {
  const shouldClose =
    event.status === "OPEN" ||
    event.status === "SOLD_OUT";

  const response = await apiFetch(
    API_URL +
      "/admin/pickup-events/" +
      event.id +
      (shouldClose
        ? "/close"
        : "/open"),
    {
      method: "POST",
      credentials: "include",
    },
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      responseMessage(data) ||
        (shouldClose
          ? "No se pudieron cerrar los pedidos."
          : "No se pudieron abrir los pedidos."),
    );
  }

  return shouldClose
    ? "Pedidos cerrados para esa fecha."
    : "Pedidos abiertos. Esa es ahora la fecha activa para clientes.";
}
