# Feature Specification: Offline Capture — Idempotent Writes (OFF-01)

**Feature Branch**: `016-offline-capture`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "OFF-01 · Cola local para conexión intermitente (Could, backlog #16) — mejor experiencia sin conectividad. Backend-first: la **capa de idempotencia** para las escrituras de captura (alta de movimientos y transferencias), de modo que la cola local del dispositivo pueda **reproducir de forma segura** las operaciones encoladas al reconectar, sin crear duplicados. La cola/almacenamiento/UI on-device se difieren al track móvil."

## Clarifications

### Session 2026-07-21

- Q: ¿OFF-01 es solo backend o incluye la cola/UI offline en Expo/RN? → A: **Solo backend** — la capa de idempotencia para las altas de captura; la cola local, el almacenamiento offline, la detección de conectividad y la reproducción on-device se difieren al track móvil.
- Q: ¿Sobre qué escrituras aplica la idempotencia? → A: **Solo captura** — alta de **movimientos** (TXN-01) y **transferencias** (TXN-02).
- Q: ¿Ventana de retención de los registros de idempotencia? → A: **Configurable, 7 días por defecto**, con purga automática.
- Q: ¿Cómo viaja la clave de idempotencia? → A: **Header HTTP `Idempotency-Key`** (estándar IETF/Stripe); no cambia el cuerpo de las altas existentes.
- Q: ¿Qué devuelve un reenvío (replay) con la misma clave y contenido? → A: **La respuesta original tal cual** (mismo `201` + el recurso creado), opcionalmente con un header `Idempotent-Replayed: true`; idempotencia transparente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Alta de movimiento reproducible sin duplicar (Priority: P1) 🎯 MVP

Un integrante registró un movimiento mientras estaba sin conexión; su dispositivo lo encoló y, al
reconectar, lo reenvía. El sistema garantiza que ese movimiento se registra **exactamente una vez**:
si el mismo alta llega otra vez (reintento por red intermitente), se devuelve el movimiento ya creado
en lugar de crear un duplicado.

**Why this priority**: La duplicación es el único riesgo real de una cola de reintentos: sin
idempotencia, cada reintento crea un movimiento repetido y corrompe los saldos y el presupuesto. Esta
garantía es la base que habilita cualquier captura offline confiable.

**Independent Test**: Enviar un alta de movimiento con una **clave de idempotencia**; reenviar la
misma solicitud (misma clave y contenido) varias veces; confirmar que existe **un solo** movimiento y
que cada respuesta devuelve el mismo identificador.

**Acceptance Scenarios**:

1. **Given** un integrante autenticado, **When** crea un movimiento con una clave de idempotencia,
   **Then** el movimiento se crea y la respuesta incluye su identificador.
2. **Given** un alta ya procesada con una clave, **When** se reenvía la misma solicitud (misma clave y
   mismo contenido), **Then** el sistema devuelve el **mismo** movimiento sin crear otro.
3. **Given** dos solicitudes idénticas con la misma clave que llegan casi al mismo tiempo, **When** se
   procesan, **Then** se crea **un solo** movimiento (la segunda ve el resultado de la primera).

---

### User Story 2 - Alta de transferencia reproducible sin duplicar (Priority: P2)

La misma garantía aplica a las **transferencias**: un integrante que registró una transferencia sin
conexión y la reproduce al reconectar obtiene exactamente una transferencia, sin duplicar el
movimiento de dinero entre cuentas.

**Why this priority**: Una transferencia duplicada descuadra los saldos de origen y destino; la
captura offline de transferencias es menos frecuente que la de movimientos pero igual de sensible.

**Independent Test**: Enviar un alta de transferencia con una clave de idempotencia; reenviarla;
confirmar que existe una sola transferencia y que los saldos reflejan un único movimiento.

**Acceptance Scenarios**:

1. **Given** un integrante con dos cuentas, **When** crea una transferencia con una clave de
   idempotencia, **Then** se registra una transferencia.
2. **Given** un alta de transferencia ya procesada, **When** se reenvía con la misma clave y contenido,
   **Then** se devuelve la **misma** transferencia sin crear otra ni volver a mover saldos.

---

### User Story 3 - Integridad y alcance de las claves (Priority: P3)

Las claves de idempotencia protegen la integridad: reutilizar una clave con un **contenido distinto**
se rechaza (una clave identifica una operación concreta), las claves están **aisladas por
integrante/familia**, y las solicitudes **sin clave** se comportan igual que hoy (compatibilidad).

**Why this priority**: Sin estas reglas, la idempotencia podría enmascarar errores del cliente
(reusar una clave para otra operación) o filtrarse entre integrantes. Es secundario frente a la
garantía de "no duplicar", pero necesario para que el mecanismo sea seguro.

**Independent Test**: Reenviar una clave ya usada con un monto distinto y confirmar el rechazo; usar la
misma clave desde otro integrante y confirmar que crea su propia operación; enviar un alta sin clave y
confirmar el comportamiento actual.

**Acceptance Scenarios**:

1. **Given** una clave ya asociada a un alta, **When** se reenvía la misma clave con un **contenido
   diferente**, **Then** la solicitud es rechazada con un error claro (conflicto de clave).
2. **Given** una clave usada por un integrante, **When** otro integrante (u otra familia) usa el mismo
   valor de clave, **Then** su solicitud es independiente y crea su propia operación.
3. **Given** una solicitud de alta **sin** clave de idempotencia, **When** se procesa, **Then** se
   comporta exactamente como hoy (se crea el recurso; sin cambio para clientes existentes).

---

### Edge Cases

- **Reintento tras respuesta perdida**: si el cliente no recibió la respuesta y reintenta, la clave
  garantiza que no se duplica y recupera el resultado original.
- **Concurrencia**: dos envíos simultáneos con la misma clave resuelven a un único recurso (no ambos).
- **Clave reutilizada con otro contenido**: se rechaza (la clave identifica una operación específica).
- **Sin clave**: comportamiento actual intacto (compatibilidad hacia atrás).
- **Clave malformada/vacía o excesivamente larga**: se rechaza con un error de validación.
- **Clave expirada**: pasada la ventana de retención, el registro de idempotencia se purga; un
  reenvío posterior (muy improbable dentro de un uso normal offline) se trataría como alta nueva.
- **Aislamiento**: una clave nunca da acceso a un recurso de otro integrante/familia.
- **Privacidad**: ni montos ni notas aparecen en logs; el manejo de idempotencia registra solo
  claves/identificadores.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Una solicitud de **alta** (movimiento, transferencia) MAY llevar una **clave de
  idempotencia** provista por el cliente **en el header HTTP `Idempotency-Key`**; cuando está
  presente, el sistema MUST garantizar que la operación se aplica **a lo sumo una vez**.
- **FR-002**: Reenviar una solicitud con la **misma clave** (mismo integrante/familia) MUST devolver
  la **respuesta original tal cual** (mismo código de estado y el recurso originalmente creado),
  **sin crear un duplicado**; el sistema MAY añadir un header `Idempotent-Replayed: true` para
  observabilidad.
- **FR-003**: Las claves de idempotencia MUST estar acotadas al **integrante autenticado** (y su
  familia); el mismo valor de clave desde otro integrante/familia es independiente, sin colisión ni
  acceso cruzado (Principio I).
- **FR-004**: La idempotencia MUST aplicarse a las **escrituras de captura**: alta de **movimiento** y
  alta de **transferencia**.
- **FR-005**: Una solicitud **sin** clave de idempotencia MUST comportarse exactamente como hoy (sin
  cambio para los clientes existentes).
- **FR-006**: Los registros de idempotencia MUST retenerse durante una ventana **configurable**, con
  **7 días por defecto**, y luego purgarse automáticamente; la ventana debe cubrir períodos de
  desconexión realistas y está documentada.
- **FR-007**: Envíos **concurrentes** con la misma clave MUST NO crear ambos un recurso: el segundo ve
  el resultado del primero (o se resuelve al mismo resultado), garantizando exactamente uno.
- **FR-008**: Un reenvío con la **misma clave pero contenido distinto** MUST detectarse y **rechazarse**
  (una clave identifica una operación concreta; reutilizarla para otro contenido es un error del
  cliente).
- **FR-009**: Ni montos ni notas MUST aparecer en logs ni telemetría durante el manejo de
  idempotencia; solo claves/identificadores pueden registrarse (Principio II).
- **FR-010**: El mecanismo de clave de idempotencia MUST quedar documentado en OpenAPI para los
  endpoints afectados (Principio VI).
- **FR-011**: Una clave de idempotencia provista MUST validarse (no vacía, largo acotado); una clave
  malformada MUST rechazarse con un error de validación.

### Key Entities *(include if feature involves data)*

- **Registro de idempotencia** *(por integrante, dentro de una familia)*: asocia una **clave**
  provista por el cliente con la **operación** ejecutada (endpoint de captura), una **huella** del
  contenido de la solicitud (para detectar reusos con contenido distinto), el **identificador del
  recurso** creado, y una marca de tiempo (para la retención). No contiene montos ni notas en claro.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Reenviar un alta encolada **N veces** con la misma clave produce **exactamente un**
  recurso el **100%** de las veces.
- **SC-002**: Un cliente que encola **M** altas sin conexión y las reproduce al reconectar termina con
  **exactamente M** recursos (ninguno duplicado, ninguno perdido), verificado a nivel de backend
  mediante reenvíos.
- **SC-003**: El **100%** de los reenvíos con la misma clave y **contenido distinto** es rechazado.
- **SC-004**: El aislamiento por integrante/familia de las claves no presenta fugas (**0** accesos
  cruzados en las pruebas).
- **SC-005**: Las solicitudes **sin** clave conservan el comportamiento actual el **100%** de las
  veces (sin regresiones en el alta de movimientos/transferencias).
- **SC-006**: No aparece ningún monto ni nota en logs durante el manejo de idempotencia, incluso ante
  errores.

## Assumptions

- **Alcance backend-first**: OFF-01 entrega la **capa de idempotencia** para las altas de captura y su
  documentación de contrato; la **cola local, el almacenamiento offline, la detección de
  conectividad y la orquestación de reproducción en Expo/RN se difieren** al track móvil (es la mayor
  parte del esfuerzo y es del lado del cliente). La validación en dispositivo físico del DoD aplicará
  cuando se construya la cola móvil.
- **Clave provista por el cliente**: la clave de idempotencia es un identificador único que el cliente
  genera por cada operación encolada y envía junto al alta.
- **Solo captura por creación**: OFF-01 cubre la **creación** offline de movimientos y transferencias
  (el escenario primario de captura sin conexión). La **edición y la eliminación** offline quedan
  **fuera de alcance** (introducen semántica de conflicto/merge que excede este slice).
- **No es sincronización en vivo**: la idempotencia es una **deduplicación por solicitud**, no
  sincronización en tiempo real ni WebSockets ni arquitectura distribuida (consistente con el
  Principio V; el mecanismo es la mínima habilitación de backend para reproducir la captura offline).
- **Ventana de retención** de los registros de idempotencia **configurable, 7 días por defecto**
  (cubre desconexiones realistas); purga automática pasada la ventana.
- **Compatibilidad hacia atrás**: las altas existentes sin clave no cambian.

## Dependencies

- **TXN-01** — alta de movimientos (endpoint que recibe la clave de idempotencia). Requerido.
- **TXN-02** — alta de transferencias (endpoint que recibe la clave). Requerido.
- **AUTH-01 / FAM-01** — sesión autenticada e integrante/familia para el alcance de la clave. Requerido.

## Out of Scope

- La **cola local, el almacenamiento offline, la detección de conectividad y la reproducción** en
  `apps/mobile` (track móvil diferido) — la mayor parte de OFF-01.
- **Edición y eliminación** offline (con semántica de conflicto/merge y resolución last-write-wins).
- Idempotencia en escrituras **no de captura** (presupuestos, cuentas, categorías, recordatorios,
  plantillas) — OFF-01 apunta a las altas que la cola de captura encola.
- **Sincronización en vivo / tiempo real / WebSockets** y arquitectura distribuida (Principio V —
  fuera de alcance explícito).
- **Resolución de conflictos / merge** de estado compartido (no hay edición concurrente de estado
  compartido en la captura offline; el único riesgo es la duplicación, que resuelve la idempotencia).
