# Feature Specification: Local Reminders (NTF-01)

**Feature Branch**: `014-local-reminders`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "NTF-01 · Recordatorios locales — cada integrante configura recordatorios personales (p. ej. registrar los movimientos del día, revisar o definir el presupuesto mensual) que la app entrega como notificaciones locales en el dispositivo, para sostener la disciplina de captura de la que depende la exactitud del MVP. Sin push del servidor."

## Clarifications

### Session 2026-07-21

- Q: ¿NTF-01 es solo backend (API de configuración) o incluye el agendado/UI on-device en Expo/RN? → A: **Solo backend** — el servidor persiste la configuración de recordatorios por integrante; el agendado on-device y la UI de notificaciones locales se difieren al track móvil, coherente con las 13 slices previas.
- Q: ¿Cómo se representa el día-de-la-semana de un recordatorio semanal? → A: **Enum en inglés `monday`–`sunday`** (valor tipado y autoexplicativo; evita la ambigüedad de inicio de semana y del 0-vs-1).
- Q: ¿Cómo se modela el propósito del recordatorio y su texto? → A: **Enum `{capture, budget, custom}` más una etiqueta**: `capture` y `budget` traen un texto por defecto que el móvil localiza; `custom` **exige** una etiqueta no vacía. El servidor solo guarda propósito + etiqueta; el móvil compone el texto de la notificación.
- Q: ¿Límite de recordatorios por integrante (FR-009)? → A: **20**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recordatorio diario de captura (Priority: P1) 🎯 MVP

Un integrante activa un recordatorio **diario** a una hora que elige (p. ej. 20:00) para que su
dispositivo le avise de registrar los movimientos del día. Esto sostiene la disciplina de registro,
que es de lo que depende la exactitud del producto cuando no hay sincronización bancaria.

**Why this priority**: La fricción y el olvido de captura son el principal riesgo de adopción
(Principio VII). Un recordatorio diario es la palanca más directa para que la familia registre a
tiempo, y es el recordatorio de mayor valor.

**Independent Test**: Crear un recordatorio diario con hora 20:00; solicitar los recordatorios del
integrante y confirmar que devuelve cadencia diaria, hora 20:00 y estado activo, listo para que el
dispositivo agende la notificación local.

**Acceptance Scenarios**:

1. **Given** un integrante autenticado, **When** crea un recordatorio con propósito "captura",
   cadencia diaria y hora 20:00, **Then** el recordatorio queda guardado, activo, y aparece en su
   lista con esos valores.
2. **Given** un recordatorio diario activo, **When** el integrante lo consulta, **Then** obtiene la
   información necesaria (cadencia, hora, estado) para que el dispositivo agende la notificación
   local correspondiente.
3. **Given** dos integrantes distintos, **When** cada uno lista sus recordatorios, **Then** ninguno
   ve ni afecta los recordatorios del otro.

---

### User Story 2 - Recordatorios de presupuesto y revisión (Priority: P2)

Un integrante activa recordatorios **semanales o mensuales** —por ejemplo, "el día 1 a las 09:00,
definir el presupuesto del mes" o "cada lunes, revisar los gastos de la semana"— para no perder los
hitos de planificación.

**Why this priority**: Complementa la captura diaria con los ciclos de planificación (presupuesto
mensual, revisión semanal) que también sostienen el uso recurrente del producto, pero son
secundarios frente al registro diario.

**Independent Test**: Crear un recordatorio mensual (día 1, 09:00) y uno semanal (lunes, 08:00);
confirmar que ambos se guardan con su cadencia y selector de día correctos y aparecen en la lista.

**Acceptance Scenarios**:

1. **Given** un integrante, **When** crea un recordatorio mensual con día del mes 1 y hora 09:00,
   **Then** se guarda con cadencia mensual, día 1 y hora 09:00.
2. **Given** un integrante, **When** crea un recordatorio semanal con día lunes y hora 08:00,
   **Then** se guarda con cadencia semanal, día lunes y hora 08:00.
3. **Given** un recordatorio mensual con día 31, **When** el mes tiene menos días, **Then** el
   recordatorio se interpreta en el **último día** del mes (sin quedar sin disparar).

---

### User Story 3 - Gestionar y silenciar recordatorios (Priority: P3)

Un integrante mantiene su conjunto de recordatorios: puede **editar** la hora/cadencia,
**activar o silenciar** un recordatorio sin borrarlo, y **eliminarlo**.

**Why this priority**: El control fino (silenciar sin perder la configuración, ajustar horarios)
mejora la experiencia y evita que un recordatorio molesto lleve a desactivar todo, pero es
secundario frente a crear el recordatorio.

**Independent Test**: Editar la hora de un recordatorio y confirmar el cambio; silenciarlo
(desactivar) y confirmar que queda inactivo pero conservado; reactivarlo; eliminarlo y confirmar que
desaparece de la lista.

**Acceptance Scenarios**:

1. **Given** un recordatorio existente, **When** el integrante cambia su hora o cadencia, **Then**
   el cambio se refleja en su lista.
2. **Given** un recordatorio activo, **When** el integrante lo silencia (desactiva), **Then** queda
   inactivo (el dispositivo no agenda nada para él) pero conservado para reactivarlo luego.
3. **Given** un recordatorio existente, **When** el integrante lo elimina, **Then** desaparece de su
   lista.

---

### Edge Cases

- **Día del mes 29–31**: un recordatorio mensual con un día que no existe en el mes se interpreta en
  el **último día** del mes (nunca se omite).
- **Hora inválida**: una hora fuera de 00:00–23:59 (o mal formada) se rechaza con un mensaje claro.
- **Selector de día incoherente con la cadencia**: día-de-la-semana en un recordatorio diario, o
  día-del-mes en uno semanal, se rechaza (cada cadencia exige solo su selector).
- **Recordatorio silenciado**: un recordatorio desactivado no produce ninguna notificación (el
  dispositivo no agenda nada para él).
- **Demasiados recordatorios**: superar el límite por integrante se rechaza con un mensaje claro.
- **Aislamiento**: ningún integrante puede leer, editar, silenciar ni borrar los recordatorios de
  otro (ni dentro ni fuera de su familia).
- **Zona horaria**: la hora es de reloj local; la notificación se dispara en la zona horaria del
  dispositivo (no hay disparo desde el servidor).
- **Privacidad**: ningún recordatorio contiene montos ni detalle financiero; nada sensible en logs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Un integrante MUST poder crear un **recordatorio personal** con: un **propósito**
  del conjunto `{capture, budget, custom}`, una **cadencia** (diaria, semanal o mensual), una
  **hora del día** y —según la cadencia— un **día de la semana** (`monday`–`sunday`, semanal) o
  **día del mes** (mensual); una **etiqueta** opcional para `capture`/`budget` (traen texto por
  defecto) y **obligatoria no vacía** para `custom`; el recordatorio queda **activo** por defecto.
- **FR-002**: Un integrante MUST poder **listar** sus recordatorios con toda la información que el
  dispositivo necesita para agendar la notificación local (propósito, cadencia, hora, día, estado,
  etiqueta).
- **FR-003**: Un integrante MUST poder **editar** un recordatorio (hora, cadencia, día, etiqueta,
  estado).
- **FR-004**: Un integrante MUST poder **activar o silenciar** (desactivar) un recordatorio sin
  eliminarlo, conservando su configuración.
- **FR-005**: Un integrante MUST poder **eliminar** un recordatorio.
- **FR-006**: Los recordatorios son **personales de cada integrante** y su alcance MUST derivarse de
  la **sesión autenticada**, nunca de un identificador provisto por el cliente; ningún integrante
  puede leer ni modificar los recordatorios de otro (Principio I).
- **FR-007**: El sistema MUST validar la configuración: hora en formato 24h válido (00:00–23:59);
  una cadencia **semanal** exige un día-de-la-semana del enum `monday`–`sunday` y **rechaza** un
  día-del-mes; una cadencia **mensual** exige un día-del-mes (1–31, interpretado como el último día
  en meses más cortos) y **rechaza** un día-de-la-semana; una cadencia **diaria** no admite ningún
  selector de día; un propósito `custom` exige una etiqueta **no vacía**; la etiqueta (si existe)
  tiene un largo acotado.
- **FR-008**: Un recordatorio **silenciado** MUST NO producir ninguna notificación (el dispositivo
  no agenda nada para él). La porción verificable en el servidor es que el estado `enabled=false`
  persiste y se devuelve; el "no notificar" propiamente tal se valida con la pantalla móvil diferida.
- **FR-009**: El sistema MUST limitar la cantidad de recordatorios por integrante a **20** y
  rechazar la creación que supere ese máximo, con un mensaje claro.
- **FR-010**: Ningún recordatorio (ni su etiqueta) MUST contener ni exponer montos ni detalle
  financiero, y nada sensible MUST aparecer en logs o telemetría (Principio II).
- **FR-011**: La entrega es mediante **notificaciones locales en el dispositivo**, agendadas por la
  app a partir de la configuración del integrante; el sistema **NO** envía notificaciones push desde
  el servidor ni depende de un servicio externo de notificaciones (Principio V).
- **FR-012**: La API MUST quedar documentada en OpenAPI y sus tipos compartidos publicados en
  `packages/contracts`, consumibles por `apps/mobile` y `apps/api` (Principio VI).

### Key Entities *(include if feature involves data)*

- **Reminder** *(por integrante, dentro de una familia)*: un recordatorio personal con propósito
  (`capture` | `budget` | `custom`), cadencia (diaria | semanal | mensual), hora del día (HH:MM),
  día-de-la-semana (`monday`–`sunday`, solo semanal), día-del-mes (1–31, solo mensual), una etiqueta
  corta (opcional para `capture`/`budget`, obligatoria no vacía para `custom`), un estado
  activo/silenciado, su integrante dueño y marcas de tiempo. No contiene datos financieros.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un integrante puede configurar un recordatorio diario de captura en **menos de 30
  segundos** (pocos campos: propósito, hora).
- **SC-002**: Un recordatorio se guarda y recupera exactamente (cadencia, hora, día, estado,
  etiqueta) el **100%** de las veces, verificado por prueba.
- **SC-003**: Ninguna operación permite acceso a recordatorios de otro integrante (**0 fugas** en las
  pruebas de aislamiento, dentro y entre familias).
- **SC-004**: El **100%** de las configuraciones inválidas (hora fuera de rango, selector de día
  incoherente con la cadencia, exceso de recordatorios) es rechazado.
- **SC-005**: No aparece ningún monto ni detalle financiero en los recordatorios ni en los logs,
  incluso ante errores.
- **SC-006**: Silenciar un recordatorio detiene su notificación (el dispositivo no agenda nada para
  él); en el servidor se verifica por el estado de la configuración (`enabled=false` persiste), y el
  cese de la notificación se valida con la pantalla móvil diferida.

## Assumptions

- **Alcance backend-first**: NTF-01 entrega la **API de configuración** de recordatorios y sus
  contratos; el **agendado on-device y la UI de notificaciones en Expo/RN se difieren** al track
  móvil, igual que UX-01 y las 12 features Must. La validación en dispositivo físico del DoD aplicará
  cuando se construya esa parte.
- **Recordatorios por integrante**: cada integrante configura sus propios recordatorios (son alarmas
  personales), no compartidos por la familia.
- **Entrega local, sin push**: la notificación se agenda y dispara **en el dispositivo** (Expo local
  notifications); NO hay push del servidor (FCM/APNs) ni servicio externo, coherente con el Principio
  V (no introducir infraestructura no justificada). El servidor solo **persiste la configuración**.
- **Hora de reloj local**: la hora se guarda como HH:MM y el dispositivo la interpreta en su zona
  horaria (Chile); no hay planificador ni reloj en el servidor.
- **Contenido estático/plantilla**: el texto del recordatorio es un mensaje simple/plantilla, sin
  leer datos financieros para decidir su contenido (los avisos "según estado" —p. ej. "vas sobre el
  presupuesto"— exigirían push y quedan fuera de alcance).
- **Propósitos tipados + libre**: el propósito es un enum `{capture, budget, custom}`; `capture` y
  `budget` traen texto por defecto (que el móvil localiza) y `custom` exige una etiqueta no vacía. El
  servidor guarda solo propósito + etiqueta; el móvil compone el texto de la notificación.
- **Día-de-la-semana como enum** `monday`–`sunday` (evita ambigüedad de inicio de semana / 0-vs-1).
- **Límite de 20** recordatorios por integrante para evitar abuso.

## Dependencies

- **AUTH-01** — sesión autenticada e identidad del integrante. Requerido.
- **FAM-01** — pertenencia a familia y alcance de sesión. Requerido.
- Se relaciona con el **Principio VII** (disciplina de captura) y con BUD-01/DASH-01 (los propósitos
  de presupuesto/revisión los referencian conceptualmente, sin leer sus datos).

## Out of Scope

- **Notificaciones push del servidor** (FCM/APNs), entrega remota, bandeja/historial de
  notificaciones.
- El **agendado on-device y la UI de notificaciones en `apps/mobile`** (track móvil diferido).
- **Avisos según estado financiero** (p. ej. "presupuesto al 90%") que requerirían computar datos y
  push; NTF-01 son recordatorios simples basados en tiempo.
- Recordatorios por **email o SMS**.
- Temporización "inteligente" por ML, métricas de snooze, o recordatorios compartidos por la familia.
