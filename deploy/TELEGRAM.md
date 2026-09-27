# Telegram — Burger Danlin

Fecha: 2026-09-27

Burger Danlin usa Telegram para dos tipos de mensajes:

1. **Eventos de negocio desde la API**
   - nuevo pedido;
   - pago confirmado;
   - pedido en preparación (opcional);
   - pedido listo;
   - pedido entregado;
   - pedido cancelado;
   - reembolso completado o pendiente.

2. **Alertas operativas desde Prometheus + Alertmanager**
   - API caída;
   - PostgreSQL caído;
   - tasa alta de errores 5xx;
   - latencia p95 alta;
   - inventario bajo;
   - RAM alta;
   - disco bajo.

## 1. Crear el bot

En Telegram abre `@BotFather`.

Crea un bot con `/newbot` y guarda el token que entrega.

No publiques ese token ni lo guardes en Git.

## 2. Elegir dónde recibir mensajes

Puedes usar:

- un chat privado contigo;
- un grupo privado;
- un grupo separado para alertas si después quieres dividir negocio/infraestructura.

Para el MVP el mismo chat sirve para todo.

## 3. Obtener el chat ID

Manda al menos un mensaje al bot o agrégalo al grupo y genera actividad.

Después consulta:

```text
https://api.telegram.org/bot<TOKEN>/getUpdates
```

Busca:

```json
"chat": {
  "id": ...
}
```

Los grupos normalmente usan IDs negativos.

No pegues el token en documentación, commits ni capturas públicas.

## 4. Crear archivos secretos en el VPS

```bash
sudo install -d -m 700 /etc/burger-danlin
sudo sh -c 'printf "%s" "TU_BOT_TOKEN" > /etc/burger-danlin/telegram-bot-token'
sudo sh -c 'printf "%s" "TU_CHAT_ID" > /etc/burger-danlin/telegram-chat-id'
sudo chmod 600 /etc/burger-danlin/telegram-bot-token
sudo chmod 600 /etc/burger-danlin/telegram-chat-id
```

Verifica permisos:

```bash
sudo stat /etc/burger-danlin/telegram-bot-token
sudo stat /etc/burger-danlin/telegram-chat-id
```

## 5. Configurar production.env

```text
TELEGRAM_NOTIFICATIONS_ENABLED=true

TELEGRAM_NOTIFY_NEW_ORDER=true
TELEGRAM_NOTIFY_PAYMENT=true
TELEGRAM_NOTIFY_PREPARING=false
TELEGRAM_NOTIFY_READY=true
TELEGRAM_NOTIFY_DELIVERED=true
TELEGRAM_NOTIFY_CANCELLED=true

TELEGRAM_BOT_TOKEN_FILE=/etc/burger-danlin/telegram-bot-token
TELEGRAM_CHAT_ID_FILE=/etc/burger-danlin/telegram-chat-id
```

La API y Alertmanager comparten los mismos archivos read-only.

## 6. Probar el bot antes de producción

### Local con variables temporales

PowerShell:

```powershell
$env:TELEGRAM_BOT_TOKEN="TU_TOKEN"
$env:TELEGRAM_CHAT_ID="TU_CHAT_ID"
pnpm telegram:test
```

Bash:

```bash
TELEGRAM_BOT_TOKEN='TU_TOKEN' \
TELEGRAM_CHAT_ID='TU_CHAT_ID' \
pnpm telegram:test
```

El mensaje esperado es:

```text
✅ Telegram conectado
Burger Danlin puede enviar pedidos y alertas.
```

### En VPS usando los archivos secretos

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  run --rm \
  -e TELEGRAM_BOT_TOKEN_FILE=/run/secrets/telegram-bot-token \
  -e TELEGRAM_CHAT_ID_FILE=/run/secrets/telegram-chat-id \
  api node dist/scripts/test-telegram.js
```

## 7. Levantar Alertmanager

Prometheus ya tiene configurado Alertmanager como destino.

Levanta observabilidad + Telegram:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  --profile observability \
  --profile telegram-alerts \
  up -d prometheus alertmanager loki alloy node-exporter grafana
```

Comprueba:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  --profile observability \
  --profile telegram-alerts \
  ps
```

## 8. Qué datos se envían

Los mensajes de negocio no incluyen:

- teléfono del cliente;
- email;
- token del pedido;
- QR;
- JWT;
- credenciales;
- datos de tarjeta.

Sí pueden incluir:

- código de pedido;
- número de combos;
- total;
- punto de entrega;
- estado del pedido.

## 9. Ejemplos

Nuevo pedido:

```text
🍔 Nuevo pedido
Pedido: H-A1B2C3D4
Combos: 2
Total: $260.00
Entrega: Universidad
Estado: pendiente de pago
```

Pago:

```text
💳 Pago confirmado
Pedido: H-A1B2C3D4
Combos: 2
Total: $260.00
Estado: pagado
```

Alerta:

```text
🚨 ALERTA
BurgerApiDown [critical]
Burger Danlin API is down
Prometheus has been unable to scrape the API for more than 2 minutes.
```

Cuando una alerta se resuelve, Alertmanager también envía mensaje de recuperación.

## 10. Seguridad

- nunca versionar token/chat ID;
- usar archivos con permisos 600;
- montar secretos read-only;
- revocar/regenerar el token en BotFather si se filtra;
- no enviar PII innecesaria;
- no usar Telegram como única fuente de auditoría;
- Telegram es notificación, PostgreSQL/AuditLog siguen siendo la fuente de verdad.
