import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  apiErrorMessage,
  apiErrorRequestId,
  apiFetch,
  apiUrl,
  responseRequestId,
} from "./browser";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser API helpers", () => {
  it("une mensajes de validación del backend", () => {
    expect(
      apiErrorMessage(
        { message: ["Nombre inválido", "Teléfono inválido"] },
        "Error",
      ),
    ).toBe("Nombre inválido Teléfono inválido");
  });

  it("entiende el envelope seguro del filtro HTTP", () => {
    expect(
      apiErrorMessage(
        {
          error: {
            message: "Pedido agotado",
            requestId: "req-123",
          },
        },
        "Error",
      ),
    ).toBe("Pedido agotado");

    expect(
      apiErrorRequestId({
        error: {
          message: "Pedido agotado",
          requestId: "req-123",
        },
      }),
    ).toBe("req-123");
  });

  it("usa fallback cuando no hay un mensaje útil", () => {
    expect(
      apiErrorMessage({ message: "   " }, "No se pudo completar"),
    ).toBe("No se pudo completar");

    expect(
      apiErrorMessage(undefined, "No se pudo completar"),
    ).toBe("No se pudo completar");
  });

  it("resuelve rutas relativas contra el API y conserva URLs absolutas", () => {
    expect(apiUrl("/catalog")).toMatch(/\/api\/v1\/catalog$/);
    expect(apiUrl("catalog")).toMatch(/\/api\/v1\/catalog$/);
    expect(apiUrl("https://example.com/x")).toBe(
      "https://example.com/x",
    );
  });

  it("agrega X-Request-Id sin borrar headers existentes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: {
          "x-request-id": "server-request-id",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const response = await apiFetch("/health", {
      headers: {
        "content-type": "application/json",
        "x-test-header": "preserved",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    const headers = new Headers(init.headers);

    expect(headers.get("x-request-id")).toBeTruthy();
    expect(headers.get("x-test-header")).toBe("preserved");
    expect(headers.get("content-type")).toBe("application/json");
    expect(responseRequestId(response)).toBe("server-request-id");
  });

  it("respeta un X-Request-Id definido por el caller", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/health", {
      headers: {
        "x-request-id": "caller-request-id",
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    const headers = new Headers(init.headers);

    expect(headers.get("x-request-id")).toBe(
      "caller-request-id",
    );
  });
});
