# Reglas del MVP

## Venta
- Combo Hamburguesa + Papas: $130 MXN.
- Máximo 50 combos por evento.
- Entrega inicial: sábado 9:30 a. m.
- Punto: Universidad.
- Cierre: viernes 9:00 p. m.
- Varios combos por pedido.

## Ingredientes
Pan, carne, queso, tocino, lechuga, tomate, cebolla caramelizada, cebolla blanca, ketchup, mostaza y papas.

## Extras
- Carne extra +$30
- Queso extra +$10
- Tocino extra +$15
- Papas extra +$25
- Coca-Cola lata $30

## Cliente
Nombre y teléfono obligatorios. Correo opcional. +52 por defecto.

## Pago
Obligatorio. Mock en local. Stripe y Mercado Pago previstos para producción.

## Cancelación
Permitida antes del cierre. Después del cierre no hay cancelación automática.


## Envío grupal
- La meta de envío gratis se mide por combos pagados, no por cantidad de pedidos.
- Solo cuentan combos de pedidos con pago confirmado y vigentes.
- Pedidos cancelados o reembolsados no cuentan para la meta.
- Si se alcanza la meta de combos, el envío queda gratis.
- Si no se alcanza, el costo de traslado se divide entre los pedidos pagados y se cobra al entregar.


## Ubicación de entrega
- Todo punto nuevo debe tener nombre, dirección exacta, latitud y longitud.
- Un punto heredado sin ubicación completa no puede abrir pedidos hasta corregirse.
- Los puntos incompletos no se muestran a clientes.
- El cliente puede abrir el pin exacto desde la selección del punto y desde su pedido.


## Privacidad
- El checkout muestra un aviso de privacidad simplificado antes de enviar datos personales.
- El aviso integral está disponible en `/privacidad`.
- El aviso cubre nombre, teléfono, correo opcional, datos del pedido, pago y datos técnicos de seguridad.
- El flujo actual no usa los datos del pedido para marketing directo.
- En producción son obligatorios `PRIVACY_RESPONSIBLE`, `PRIVACY_ADDRESS` y `PRIVACY_EMAIL`.
- El go-live check impide lanzar si faltan identidad, domicilio o correo de privacidad/ARCO.


## Términos de compra
- Los términos integrales están disponibles en `/terminos`.
- El cliente debe aceptarlos explícitamente antes de crear un pedido.
- Cada pedido guarda `purchaseTermsAcceptedAt` y `purchaseTermsVersion`.
- Versión inicial: `2026-09-29-v1`; versión vigente tras incorporar identidad pública del vendedor: `2026-09-30-v2`.
- La política documenta reserva de 15 minutos, pago, entrega grupal, cancelación antes del corte, reembolso y derechos del consumidor.
- La aceptación de términos de compra es independiente de la aceptación de condiciones de entrega grupal.


## Datos del vendedor y soporte
- El checkout muestra antes del pago el nombre legal del vendedor, nombre comercial, RFC, domicilio y medios de soporte.
- El footer público mantiene visibles esos datos y enlaces a `/terminos` y `/privacidad`.
- Los datos también permanecen accesibles desde `Administrar mi pedido`.
- Producción exige `BUSINESS_LEGAL_NAME`, `BUSINESS_TRADE_NAME`, `BUSINESS_RFC`, `BUSINESS_ADDRESS`, `SUPPORT_PHONE` y `SUPPORT_EMAIL`.
- El `go-live-check` bloquea el lanzamiento si faltan esos datos o si teléfono/correo/RFC no cumplen validaciones básicas.
