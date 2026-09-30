import {
  API_URL,
  apiErrorMessage,
  apiFetch,
} from "@/lib/api/browser";
import type {
  ArcoRequestResult,
  ArcoRight,
} from "./types";

export type CreateArcoRequestInput = {
  name: string;
  email: string;
  phone?: string;
  rights: ArcoRight[];
  description: string;
  locatorInfo?: string;
  rectificationDetails?: string;
  cancellationReason?: string;
  oppositionReason?: string;
  identityVerificationAcknowledged: true;
};

export async function createArcoRequest(
  input: CreateArcoRequestInput,
) {
  const response =
    await apiFetch(
      API_URL + "/privacy/arco",
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
        },
        body: JSON.stringify(
          input,
        ),
      },
    );

  const payload =
    await response.json();

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(
        payload,
        "No se pudo registrar la solicitud ARCO.",
      ),
    );
  }

  return payload as ArcoRequestResult;
}
