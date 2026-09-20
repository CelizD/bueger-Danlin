export function normalizeTelemetryRoute(pathname: string) {
  if (pathname.startsWith("/pedido/")) {
    return "/pedido/[orderCode]";
  }

  if (pathname.length > 120) {
    return pathname.slice(0, 120);
  }

  return pathname || "/";
}
