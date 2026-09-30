"use client";

import { OrderingForm } from "@/features/ordering/components/ordering-form";
import { useOrderCheckout } from "@/features/ordering/use-order-checkout";
import { useOrderingSession } from "@/features/ordering/use-ordering-session";
import type { PublicPrivacyConfig } from "@/features/privacy/types";
import type { PublicSellerConfig } from "@/features/seller/types";
import dynamic from "next/dynamic";
import { useState } from "react";

const OrderConfirmation = dynamic(
  () =>
    import(
      "@/features/ordering/components/order-confirmation"
    ).then(
      (module) =>
        module.OrderConfirmation,
    ),
  {
    loading: () => (
      <main className="shell">
        <p
          className="status-text"
          role="status"
          aria-live="polite"
        >
          Preparando confirmación…
        </p>
      </main>
    ),
  },
);

export function OrderApp({
  privacy,
  seller,
}: {
  privacy: PublicPrivacyConfig;
  seller: PublicSellerConfig;
}) {
  const [error, setError] =
    useState("");

  const ordering =
    useOrderingSession(setError);

  const checkout = useOrderCheckout({
    event: ordering.event,
    combo: ordering.combo,
    coke: ordering.coke,
    burgers: ordering.burgers,
    cokes: ordering.cokes,
    groupDeliveryAccepted:
      ordering.groupDeliveryAccepted,
    setError,
  });

  if (ordering.loading) {
    return (
      <main className="shell">
        <p
          className="status-text"
          role="status"
          aria-live="polite"
        >
          Cargando menú local…
        </p>
      </main>
    );
  }

  if (checkout.createdOrder) {
    return (
      <OrderConfirmation
        order={checkout.createdOrder}
        error={error}
        cancelMessage={
          checkout.cancelMessage
        }
        paying={checkout.paying}
        canceling={checkout.canceling}
        paymentProvider={
          checkout.paymentProvider
        }
        onConfirmPayment={() =>
          void checkout.confirmPayment()
        }
        onCancel={() =>
          void checkout.cancelCreatedOrder()
        }
      />
    );
  }

  return (
    <OrderingForm
      privacy={privacy}
      seller={seller}
      events={ordering.events}
      event={ordering.event}
      combo={ordering.combo}
      coke={ordering.coke}
      inventory={ordering.inventory}
      burgers={ordering.burgers}
      cokes={ordering.cokes}
      name={checkout.name}
      phone={checkout.phone}
      email={checkout.email}
      purchaseTermsAccepted={
        checkout.purchaseTermsAccepted
      }
      ageAuthorizationConfirmed={
        checkout.ageAuthorizationConfirmed
      }
      error={error}
      groupDeliveryAccepted={
        ordering.groupDeliveryAccepted
      }
      submitting={
        checkout.submitting
      }
      comboInventoryLimit={
        ordering.comboInventoryLimit
      }
      cokeInventoryLimit={
        ordering.cokeInventoryLimit
      }
      maxCombosAvailable={
        ordering.maxCombosAvailable
      }
      removableOptions={
        ordering.removableOptions
      }
      extraOptions={
        ordering.extraOptions
      }
      previewTotal={
        ordering.previewTotal
      }
      onSelectPickup={
        ordering.selectPickupEvent
      }
      onAddBurger={
        ordering.addBurger
      }
      onRemoveBurger={
        ordering.removeBurger
      }
      onToggleRemoved={
        ordering.toggleRemoved
      }
      onToggleExtra={
        ordering.toggleExtra
      }
      onCokesChange={
        ordering.setCokes
      }
      onNameChange={
        checkout.setName
      }
      onPhoneChange={
        checkout.setPhone
      }
      onEmailChange={
        checkout.setEmail
      }
      onPurchaseTermsChange={
        checkout.setPurchaseTermsAccepted
      }
      onAgeAuthorizationChange={
        checkout.setAgeAuthorizationConfirmed
      }
      onGroupDeliveryChange={
        ordering.setGroupDeliveryAccepted
      }
      onSubmit={
        checkout.submitOrder
      }
    />
  );
}
