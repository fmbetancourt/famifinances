# Feature Specification: Capture Templates & Defaults (UX-01)

**Feature Branch**: `013-capture-templates`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "UX-01 · Plantillas y defaults de captura — reduce la fricción de registrar un movimiento: el flujo de alta pide monto y tipo primero, y cuenta/categoría/fecha llegan con defaults sensatos (última cuenta/categoría usada); además se ofrecen plantillas de movimientos frecuentes. Operacionaliza el Principio VII (Fast & Accessible Capture UX) sobre las features ya entregadas (movimientos, cuentas, categorías)."

## Clarifications

### Session 2026-07-21

- Q: ¿UX-01 es solo backend (endpoints de defaults/plantillas) o incluye también la pantalla de captura Expo/RN? → A: **Solo backend** — UX-01 entrega la API que habilita la captura rápida (defaults de última cuenta/categoría + plantillas de movimientos frecuentes); la pantalla de captura en `apps/mobile` se difiere al track móvil, coherente con las 12 features Must previas. La validación en dispositivo físico (DoD/Principio VII) aplicará cuando se construya la pantalla.
- Q: ¿Quién puede gestionar (crear/editar/eliminar) plantillas de la familia? → A: **Cualquier integrante** (Member u Owner) crea, edita, elimina y aplica plantillas. Las plantillas son ayudas de captura compartidas (Principio VII), no configuración sensible como la administración de miembros; no requieren rol Owner.
- Q: ¿Cómo se obtienen los defaults de «última vez usada» de cada integrante? → A: **Derivar al leer** — al solicitar los defaults se consulta el movimiento más reciente del integrante y se devuelven cuenta/categoría/tipo; no se persiste una proyección aparte (sin colección nueva, siempre consistente con los movimientos — Principio V).
- Q: ¿Cómo se «aplica» una plantilla para pre-llenar el alta? → A: **Pre-llenado en cliente** — no existe endpoint `apply`; el recurso de la plantilla (GET) ya devuelve todos sus valores y el cliente pre-llena el flujo de alta existente (TXN-01). Las referencias rotas se señalan al listar/leer la plantilla.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Defaults de captura por última vez usada (Priority: P1) 🎯 MVP

Un integrante de la familia abre el flujo de alta de movimiento y encuentra la **cuenta**, la
**categoría** y el **tipo** pre-cargados con lo que usó la última vez, de modo que en el caso
típico solo debe ingresar el **monto** (y confirmar la fecha, que por defecto es hoy). Esto
convierte el registro repetitivo en una acción de segundos y sostiene la disciplina de captura
de la que depende la exactitud del producto.

**Why this priority**: La fricción de captura es el principal riesgo de adopción (Principio VII).
Los defaults de "última vez usada" son la palanca de menor esfuerzo y mayor impacto: no requieren
que el usuario configure nada y se ajustan solos a su comportamiento real.

**Independent Test**: Con un integrante que ya registró un movimiento (cuenta A, categoría X,
tipo gasto), solicitar sus defaults de captura y confirmar que devuelven cuenta A, categoría X y
tipo gasto; registrar luego un movimiento con cuenta B / categoría Y y confirmar que los defaults
pasan a B / Y.

**Acceptance Scenarios**:

1. **Given** un integrante cuyo movimiento más reciente fue (cuenta A, categoría X, tipo gasto),
   **When** solicita los defaults de captura, **Then** recibe cuenta A, categoría X, tipo gasto y
   fecha por defecto = hoy.
2. **Given** un integrante sin ningún movimiento registrado, **When** solicita los defaults,
   **Then** recibe un conjunto **neutro** (sin cuenta/categoría/tipo adivinados) para que el flujo
   caiga en una selección explícita, no en un valor incorrecto.
3. **Given** un integrante con defaults (cuenta A, categoría X), **When** registra un movimiento
   con cuenta B y categoría Y, **Then** sus defaults se actualizan automáticamente a B / Y sin
   ninguna acción adicional.
4. **Given** dos familias distintas, **When** cada integrante solicita sus defaults, **Then**
   ninguno ve ni influye en los defaults de la otra familia.

---

### User Story 2 - Plantillas de movimientos frecuentes (Priority: P2)

Un integrante crea **plantillas** con nombre para los movimientos que repite (p. ej. "Feria
semanal" → gasto, categoría Alimentación, cuenta Efectivo, monto sugerido opcional). Al aplicar
una plantilla, el flujo de alta queda pre-llenado con esos valores y el integrante solo confirma
o ajusta el monto antes de guardar.

**Why this priority**: Las plantillas cubren los movimientos recurrentes que los defaults de
"última vez usada" no aciertan (p. ej. alternar entre "Feria" y "Bencina"). Son la segunda palanca
de captura que pide explícitamente el Principio VII.

**Independent Test**: Crear una plantilla "Feria semanal" (gasto, categoría Alimentación, cuenta
Efectivo); aplicarla y confirmar que devuelve un borrador de movimiento pre-llenado con esos
valores y sin monto forzado; listar las plantillas de la familia y encontrarla.

**Acceptance Scenarios**:

1. **Given** una familia con cuentas y categorías, **When** un integrante crea una plantilla con
   nombre, tipo, categoría y cuenta (y monto/nota opcionales), **Then** la plantilla queda
   disponible para toda la familia.
2. **Given** una plantilla existente, **When** un integrante la aplica, **Then** recibe un
   **borrador** de movimiento pre-llenado (no se registra automáticamente) que aún puede editar
   antes de guardar.
3. **Given** una plantilla con una categoría de **ingreso**, **When** se intenta fijar su tipo como
   **gasto** (o viceversa), **Then** la operación es rechazada por inconsistencia tipo/categoría.
4. **Given** dos familias distintas, **When** una lista o aplica plantillas, **Then** nunca accede
   a las plantillas de la otra familia.

---

### User Story 3 - Curar y mantener las plantillas (Priority: P3)

Un integrante mantiene el conjunto de plantillas de la familia acotado y vigente: puede
**renombrar**, **editar** y **eliminar** plantillas, y el sistema mantiene las plantillas y los
defaults **coherentes** cuando una cuenta o categoría referenciada deja de existir.

**Why this priority**: Un catálogo de plantillas sin mantenimiento acumula ruido y referencias
rotas, degradando justamente la UX que la feature busca mejorar. Es valioso pero secundario frente
a crear y aplicar plantillas.

**Independent Test**: Editar una plantilla y confirmar el cambio; eliminarla y confirmar que
desaparece del listado; eliminar una categoría referenciada por una plantilla y confirmar que la
plantilla se marca como "requiere reselección" en lugar de romper la aplicación.

**Acceptance Scenarios**:

1. **Given** una plantilla existente, **When** un integrante la edita o la elimina, **Then** el
   cambio se refleja en el listado de la familia.
2. **Given** una plantilla que referencia una cuenta o categoría luego eliminada, **When** se
   lista o se intenta aplicar, **Then** el sistema la señala como incompleta (requiere reselección
   del elemento faltante) y no falla de forma opaca.
3. **Given** un default que referencia una cuenta/categoría eliminada, **When** se solicitan los
   defaults, **Then** el elemento faltante se omite (se devuelve neutro para ese campo) en lugar de
   devolver una referencia inválida.

---

### Edge Cases

- **Sin historial**: un integrante sin movimientos previos no tiene defaults de "última vez usada";
  el sistema devuelve un conjunto neutro, nunca un valor adivinado.
- **Cuenta/categoría eliminada**: defaults y plantillas que la referencian se degradan con gracia
  (campo neutro / plantilla "requiere reselección"), sin romper el flujo de captura.
- **Tipo vs. categoría**: una plantilla no puede unir una categoría de ingreso con tipo gasto (ni
  viceversa), consistente con la integridad de categorías.
- **Nombre de plantilla duplicado**: dos plantillas de la misma familia no pueden compartir nombre;
  el intento se rechaza con un mensaje claro.
- **Nombre de plantilla en blanco**: un nombre vacío o compuesto solo de espacios se rechaza (el
  nombre se recorta y debe quedar no vacío), consistente con el trato de nombres en cuentas.
- **Monto opcional en plantilla**: una plantilla puede no fijar monto; al aplicarla, el borrador
  llega sin monto y el integrante debe ingresarlo (el monto nunca se registra sin confirmación).
- **Aislamiento entre familias**: ningún integrante puede leer, aplicar, editar ni borrar defaults
  o plantillas de otra familia.
- **Privacidad**: ni montos ni notas de plantillas aparecen en logs o telemetría.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST exponer, por integrante, sus **defaults de captura** —última cuenta,
  última categoría y último tipo usados— derivados de su movimiento registrado más reciente, más
  una fecha por defecto igual a hoy.
- **FR-002**: Los defaults de captura MUST reflejar siempre el movimiento más reciente del
  integrante **derivándose al momento de solicitarlos** (no se persiste una proyección editable
  aparte); así se actualizan de forma automática al registrar movimientos, sin ningún paso manual
  de configuración ni una colección adicional que sincronizar.
- **FR-003**: Cuando un integrante no tiene movimientos previos (o el elemento referenciado ya no
  existe), el sistema MUST devolver un **valor neutro** para ese campo en lugar de un default
  adivinado o una referencia inválida.
- **FR-004**: Los integrantes MUST poder crear **plantillas** de movimiento con nombre, que
  capturan tipo, categoría y cuenta, y opcionalmente un monto sugerido y una nota.
- **FR-005**: Los integrantes MUST poder **listar, editar y eliminar** las plantillas de su familia.
- **FR-006**: Aplicar una plantilla MUST pre-llenar el flujo de alta con los valores de la
  plantilla (tipo, categoría, cuenta y monto/nota si los define) y NO registrar el movimiento
  automáticamente; el integrante confirma o ajusta el monto antes de guardarlo mediante el flujo de
  alta existente (TXN-01). No se expone un endpoint `apply` dedicado: el recurso de la plantilla ya
  devuelve todos sus valores y el pre-llenado ocurre en el cliente. La porción verificable en el
  servidor es la **fidelidad del `GET` de plantilla** (devuelve tipo/categoría/cuenta/monto); el
  pre-llenado en sí se valida con la pantalla de captura diferida.
- **FR-007**: El sistema MUST rechazar cualquier plantilla cuyo **tipo sea inconsistente con su
  categoría** (categoría de ingreso con tipo gasto o viceversa), consistente con la integridad de
  categorías (Principio III).
- **FR-008**: Todos los defaults y plantillas MUST derivar su alcance de familia de la **sesión
  autenticada**, nunca de un identificador de familia provisto por el cliente; ninguna familia
  puede leer ni modificar los defaults/plantillas de otra (Principio I).
- **FR-009**: El **nombre de plantilla** MUST recortarse y ser **no vacío** (un nombre en blanco o
  solo espacios es rechazado) y **único dentro de la familia** (sin distinguir mayúsculas); un nombre
  duplicado o en blanco es rechazado con un error claro.
- **FR-010**: Una plantilla o default que referencia una cuenta o categoría **eliminada** MUST
  señalarse como incompleta (requiere reselección) al listar o aplicar, sin provocar un fallo
  opaco del flujo de captura.
- **FR-011**: Ningún monto ni nota (de plantillas, defaults o borradores) MUST aparecer en logs,
  telemetría ni herramientas de terceros (Principio II).
- **FR-012**: La API MUST quedar documentada en OpenAPI y sus tipos compartidos publicados en
  `packages/contracts`, consumibles por `apps/mobile` y `apps/api` (Principio VI).
- **FR-013**: **Cualquier integrante** de la familia (rol Member u Owner) MUST poder crear, listar,
  editar, eliminar y aplicar plantillas; la gestión de plantillas NO requiere rol Owner (son ayudas
  de captura compartidas, no configuración de familia). El aislamiento entre familias (FR-008)
  sigue siendo obligatorio.

### Key Entities *(include if feature involves data)*

- **Capture Defaults** *(por integrante, dentro de una familia)*: la última cuenta, última
  categoría y último tipo usados por ese integrante. **No es una entidad persistida**: es una
  vista **derivada al momento de la consulta** a partir del movimiento más reciente del integrante,
  por lo que siempre coincide con los movimientos y no requiere sincronización ni edición manual.
- **Movement Template** *(compartida a nivel de familia)*: un preset con nombre para un movimiento
  frecuente — tipo (ingreso/gasto), categoría, cuenta, monto sugerido opcional, nota opcional,
  autor y marcas de tiempo. Referencia cuentas y categorías existentes de la familia.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un integrante que repite un movimiento típico puede registrarlo ingresando **solo el
  monto**, porque los defaults suplen cuenta, categoría, tipo y fecha (≤ 1 campo obligatorio en el
  caso frecuente).
- **SC-002**: Los defaults de captura reflejan el movimiento más reciente del integrante el **100%**
  de las veces (y devuelven neutro cuando no hay historial), verificado por prueba.
- **SC-003**: El `GET` de una plantilla devuelve tipo, categoría, cuenta (y monto/nota si los define)
  correctamente el **100%** de las veces, insumo para que el cliente pre-llene el alta; la plantilla
  no registra el movimiento por sí sola (el pre-llenado en pantalla se valida con el track móvil).
- **SC-004**: Ninguna operación de defaults o plantillas permite acceso entre familias (0 fugas en
  las pruebas de aislamiento).
- **SC-005**: Ninguna plantilla inconsistente (tipo vs. categoría) puede persistirse: el **100%** de
  esos intentos es rechazado.
- **SC-006**: No aparece ningún monto ni nota en logs de aplicación ni en salida de pruebas,
  incluso ante errores.

## Assumptions

- **Alcance backend-first**: UX-01 entrega la API (defaults + plantillas) y sus contratos; la
  **pantalla de captura Expo/RN se difiere** al track móvil, igual que las 12 features Must previas.
  La validación en dispositivo físico del DoD aplicará cuando esa pantalla se construya.
- **Defaults por integrante, derivados al leer**: los defaults de "última vez usada" son personales
  de cada integrante (cada miembro captura distinto) y se **calculan al solicitarlos** desde el
  movimiento más reciente; no se añade una colección de defaults ni se persiste una proyección.
- **Plantillas compartidas por la familia, gestionables por cualquier integrante**: las plantillas
  son un recurso de la familia (cualquier integrante Member u Owner las crea, ve, edita, elimina y
  aplica), coherente con que la familia es el límite de datos y el sujeto de "frequent templates are
  provided" del Principio VII; la gestión no requiere rol Owner.
- **Aplicar es pre-llenado en cliente**: no hay endpoint `apply`; el cliente lee la plantilla y
  pre-llena el flujo de alta existente (TXN-01), que conserva sus validaciones.
- **Se reutilizan features existentes**: movimientos (TXN-01/02), cuentas (ACC-01) y categorías
  (CAT-01) ya existen; UX-01 lee su última cuenta/categoría usada y referencia cuentas/categorías
  existentes; no redefine esas entidades.
- **Aplicar ≠ registrar**: aplicar una plantilla produce un borrador; la creación del movimiento
  sigue el flujo de alta existente (TXN-01), que conserva sus validaciones (Principio III).
- **Fecha por defecto = hoy**: consistente con el flujo de alta actual; la fecha no se persiste como
  parte de los defaults, se calcula al solicitarlos.
- **Moneda CLP** en cualquier monto sugerido, consistente con el MVP.

## Dependencies

- **TXN-01 / TXN-02** — movimientos (fuente de la "última vez usada" y destino del borrador). Requerido.
- **ACC-01** — cuentas referenciadas por defaults y plantillas. Requerido.
- **CAT-01** — categorías (y la regla ingreso/gasto) referenciadas por defaults y plantillas. Requerido.
- **AUTH-01 / FAM-01** — sesión autenticada y alcance de familia. Requerido.

## Out of Scope

- La **pantalla de captura Expo/RN** y cualquier cambio de UI en `apps/mobile` (track móvil diferido).
- Plantillas **recurrentes/programadas** (que generan movimientos por sí solas): aplicar una
  plantilla siempre requiere confirmación humana; no hay automatización de registro.
- Sugerencias "inteligentes" por ML o categorización automática de gastos.
- Import CSV, sincronización bancaria o lectura de correo (Won't-have del MVP).
- Plantillas de **transferencias** (UX-01 cubre movimientos de ingreso/gasto; las transferencias
  tienen su propio flujo TXN-02).
