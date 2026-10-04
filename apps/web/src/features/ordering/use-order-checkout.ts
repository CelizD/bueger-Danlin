"use client";

import {
  cancelOrder,
  confirmMockOrderPayment,
  createOrder,
  createPaymentCheckout,
  loadCustomerOrder,
  loadDeliveryQr,
} from "./api";
import type {
  BurgerSelection,
  CatalogProduct,
  CreatedOrder,
  PickupEvent,
} from "./types";
import {
  type FormEvent,
  useState,
} from "react";

const CLIENT_PAYMENT_PROVIDER =
  (process.env.NEXT_PUBLIC_PAYMENT_PROVIDER ?? "mock")
    .trim()
    .toLowerCase();

type UseOrderCheckoutInput = {
  event: PickupEvent | null;
  combo: CatalogProduct | undefined;
  coke: CatalogProduct | undefined;
  burgers: BurgerSelection[];
  cokes: number;
  groupDeliveryAccepted: boolean;
  setError: (message: string) => void;
};

export function useOrderCheckout({
  event,
  combo,
  coke,
  burgers,
  cokes,
  groupDeliveryAccepted,
  setError,
}: UseOrderCheckoutInput) {
  const [name, setName] =
    useState("");
  const [phone, setPhone] =
    useState("");
  const [email, setEmail] =
    useState("");
  const [
    purchaseTermsAccepted,
    setPurchaseTermsAccepted,
  ] = useState(false);
  const [
    ageAuthorizationConfirmed,
    setAgeAuthorizationConfirmed,
  ] = useState(false);
  const [submitting, setSubmitting] =
    useState(false);
  const [paying, setPaying] =
    useState(false);
  const [canceling, setCanceling] =
    useState(false);
  const [
    cancelMessage,
    setCancelMessage,
  ] = useState("");
  const [
    createdOrder,
    setCreatedOrder,
  ] = useState<CreatedOrder | null>(
    null,
  );
  const [
    deliveryQrPayload,
    setDeliveryQrPayload,
  ] = useState("");

  async function submitOrder(
    eventSubmit:
      FormEvent<HTMLFormElement>,
  ) {
    eventSubmit.preventDefault();

    if (
      !event ||
      !combo ||
      burgers.length === 0
    ) {
      return;
    }

    if (!purchaseTermsAccepted) {
      setError(
        "Debes aceptar los términos y condiciones de compra antes de continuar.",
      );
      return;
    }

    if (!ageAuthorizationConfirmed) {
      setError(
        "Debes confirmar que eres mayor de edad o que cuentas con autorización de tu madre, padre o tutor.",
      );
      return;
    }

    if (!groupDeliveryAccepted) {
      setError(
        "Debes aceptar las condiciones de entrega grupal antes de continuar.",
      );
      return;
    }

    const cleanPhone =
      phone.replace(/\D/g, "");

    if (cleanPhone.length !== 10) {
      setError(
        "El teléfono debe tener 10 dígitos.",
      );
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const items = burgers.map(
        (burger) => ({
          productId: combo.id,
          quantity: 1,
          removedModifierOptionIds:
            burger.removedIds,
          extraModifierOptionIds:
            burger.extraIds,
          extraModifierQuantities:
            Object.entries(
              burger.extraQuantities,
            )
              .filter(
                ([, quantity]) =>
                  quantity > 0,
              )
              .map(
                ([
                  optionId,
                  quantity,
                ]) => ({
                  optionId,
                  quantity,
                }),
              ),
        }),
      );

      if (cokes > 0 && coke) {
        items.push({
          productId: coke.id,
          quantity: cokes,
          removedModifierOptionIds: [],
          extraModifierOptionIds: [],
          extraModifierQuantities: [],
        });
      }

      const orderData =
        await createOrder({
          pickupEventId: event.id,
          purchaseTermsAccepted,
          ageAuthorizationConfirmed,
          groupDeliveryTermsAccepted:
            groupDeliveryAccepted,
          customer: {
            name: name.trim(),
            phone:
              `+52${cleanPhone}`,
            email:
              email.trim() ||
              undefined,
          },
          items,
        });

      setCreatedOrder(orderData);
      setDeliveryQrPayload("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear el pedido.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelCreatedOrder() {
    if (!createdOrder) {
      return;
    }

    const confirmed =
      window.confirm(
        createdOrder.paymentStatus ===
          "PAID"
          ? "¿Cancelar este pedido? También se iniciará el reembolso."
          : "¿Cancelar este pedido? Se liberará el cupo reservado.",
      );

    if (!confirmed) {
      return;
    }

    setCanceling(true);
    setError("");
    setCancelMessage("");

    try {
      const data = await cancelOrder(
        createdOrder.orderCode,
      );

      setCreatedOrder((current) =>
        current
          ? {
              ...current,
              status: data.status,
              paymentStatus:
                data.paymentStatus,
            }
          : current,
      );
      setDeliveryQrPayload("");

      setCancelMessage(
        data.refundStatus ===
          "REFUNDED"
          ? "Pedido cancelado y reembolso completado."
          : data.refundStatus ===
              "PENDING"
            ? "Pedido cancelado. El reembolso está en proceso."
            : "Pedido cancelado y cupo liberado.",
      );
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "No se pudo cancelar el pedido.",
      );
    } finally {
      setCanceling(false);
    }
  }

  async function confirmPayment() {
    if (
      !createdOrder ||
      createdOrder.paymentStatus ===
        "PAID"
    ) {
      return;
    }

    setPaying(true);
    setError("");

    try {
      if (CLIENT_PAYMENT_PROVIDER === "mercadopago") {
        const checkout =
          await createPaymentCheckout(
            createdOrder.orderCode,
          );

        const checkoutUrl =
          new URL(checkout.checkoutUrl);

        if (checkoutUrl.protocol !== "https:") {
          throw new Error(
            "Mercado Pago devolvió una URL de pago no segura.",
          );
        }

        window.location.assign(
          checkoutUrl.toString(),
        );
        return;
      }

      if (CLIENT_PAYMENT_PROVIDER !== "mock") {
        throw new Error(
          "El proveedor de pago del sitio no está configurado correctamente.",
        );
      }

      const data =
        await confirmMockOrderPayment(
          createdOrder.orderCode,
        );

      setCreatedOrder((current) =>
        current
          ? {
              ...current,
              status: data.status,
              paymentStatus:
                data.paymentStatus,
            }
          : current,
      );

      try {
        const [refreshed, deliveryQr] =
          await Promise.all([
            loadCustomerOrder(
              createdOrder.orderCode,
            ),
            loadDeliveryQr(
              createdOrder.orderCode,
            ),
          ]);

        setCreatedOrder((current) =>
          current
            ? {
                ...current,
                status:
                  refreshed.status,
                paymentStatus:
                  refreshed.paymentStatus,
                groupDelivery:
                  refreshed.groupDelivery,
              }
            : current,
        );
        setDeliveryQrPayload(
          deliveryQr.qrPayload,
        );
      } catch {
        // El pago quedó confirmado. La vista "Administrar mi pedido"
        // puede volver a consultar el estado y generar el QR con la cookie.
      }
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "No se pudo iniciar el pago.",
      );
    } finally {
      setPaying(false);
    }
  }

  return {
    name,
    phone,
    email,
    purchaseTermsAccepted,
    ageAuthorizationConfirmed,
    submitting,
    paying,
    canceling,
    cancelMessage,
    createdOrder,
    deliveryQrPayload,
    paymentProvider:
      CLIENT_PAYMENT_PROVIDER,
    setName,
    setPhone,
    setEmail,
    setPurchaseTermsAccepted,
    setAgeAuthorizationConfirmed,
    submitOrder,
    cancelCreatedOrder,
    confirmPayment,
  };
}
