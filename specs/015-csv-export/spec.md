# Feature Specification: CSV Export (EXP-01)

**Feature Branch**: `015-csv-export`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "EXP-01 · Exportación CSV (Should, backlog #15) — portabilidad básica de datos: una familia puede exportar sus movimientos (y transferencias) a un archivo CSV descargable, para respaldo o para llevarse sus datos. Solo exportación; la importación (IMP-01) es Won't."

## Clarifications

### Session 2026-07-21

- Q: ¿EXP-01 es solo backend o incluye la UI de descarga/compartir en Expo/RN? → A: **Solo backend** — endpoints de exportación + contratos; el botón de descargar/compartir en `apps/mobile` se difiere al track móvil.
- Q: ¿La exportación de transferencias entra en este slice? → A: **Sí** — EXP-01 exporta movimientos (US1/US2) **y** transferencias (US3), para portabilidad completa.
- Q: ¿Formato del CSV? → A: **UTF-8 con BOM, delimitador coma, comillas RFC-4180**, montos enteros CLP, fechas AAAA-MM-DD.
- Q: ¿Forma de los endpoints? → A: **Dos endpoints por recurso** — `GET /v1/export/movements` (con los filtros de HIS-01) y `GET /v1/export/transfers`; cada uno declara solo los filtros que le aplican.
- Q: ¿Encabezados del CSV? → A: **Legibles en español** (p. ej. "Fecha, Tipo, Monto, Cuenta, Categoría, Nota, Autor, Creado").
- Q: ¿Cómo se representa el "autor" de cada fila? → A: **El email del integrante** que registró el movimiento/transferencia (dato intrafamiliar; nunca en logs).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Exportar los movimientos a CSV (Priority: P1) 🎯 MVP

Un integrante exporta los movimientos (ingresos y gastos) de su familia a un archivo **CSV
descargable**, para respaldar o llevarse sus datos fuera de la app. El archivo abre correctamente en
una planilla y contiene una fila por movimiento con sus campos legibles (fecha, tipo, monto, cuenta,
categoría, nota, autor).

**Why this priority**: La portabilidad de datos es la promesa central de EXP-01 y da a la familia
control y confianza sobre su información (respaldo, análisis externo, salida sin lock-in). El ledger
de movimientos es el dato más valioso.

**Independent Test**: Con una familia que tiene varios movimientos, solicitar la exportación y
confirmar que se descarga un CSV con encabezado y una fila por movimiento no eliminado, con montos en
CLP y nombres legibles de cuenta y categoría.

**Acceptance Scenarios**:

1. **Given** una familia con movimientos registrados, **When** un integrante solicita la exportación
   de movimientos, **Then** recibe un archivo CSV con una fila de encabezado y una fila por movimiento
   no eliminado de su familia.
2. **Given** un movimiento con una nota que contiene comas, comillas o saltos de línea, **When** se
   exporta, **Then** ese texto queda correctamente escapado y la planilla lo muestra en una sola celda.
3. **Given** dos familias distintas, **When** cada una exporta, **Then** ningún archivo contiene datos
   de la otra familia.
4. **Given** un movimiento eliminado (borrado lógico), **When** se exporta, **Then** ese movimiento
   **no** aparece en el archivo.

---

### User Story 2 - Exportar un subconjunto filtrado (Priority: P2)

Un integrante exporta solo una parte de los movimientos —por ejemplo, un mes, una cuenta o una
categoría— aplicando los mismos filtros que usa en el historial, para llevarse exactamente lo que
necesita.

**Why this priority**: Un export completo no siempre es lo que se necesita; poder acotar por período
o cuenta hace la exportación útil para tareas concretas (declarar un mes, revisar una cuenta) sin
manipular después el archivo.

**Independent Test**: Exportar con un rango de fechas y una cuenta, y confirmar que el CSV contiene
solo los movimientos de esa cuenta dentro de ese rango.

**Acceptance Scenarios**:

1. **Given** movimientos de varios meses, **When** un integrante exporta con un rango de fechas,
   **Then** el CSV incluye solo los movimientos cuya fecha cae en el rango.
2. **Given** movimientos en varias cuentas y categorías, **When** exporta filtrando por cuenta,
   categoría y/o tipo, **Then** el CSV incluye solo los que cumplen todos los filtros.
3. **Given** un filtro que no coincide con ningún movimiento, **When** exporta, **Then** el CSV
   contiene solo la fila de encabezado (archivo válido y vacío de datos).

---

### User Story 3 - Exportar las transferencias (Priority: P3)

Un integrante exporta las **transferencias** de su familia a un CSV (cuenta origen, cuenta destino,
monto, fecha, autor), para que la portabilidad de datos sea completa y no solo de ingresos/gastos.

**Why this priority**: Las transferencias son parte del movimiento de dinero de la familia; sin ellas
el respaldo estaría incompleto para quienes mueven dinero entre cuentas. Es secundario frente al
ledger de ingresos/gastos.

**Independent Test**: Con una familia que registró transferencias, exportarlas y confirmar que el CSV
lista cada transferencia con cuenta origen, cuenta destino, monto, fecha y autor.

**Acceptance Scenarios**:

1. **Given** transferencias registradas, **When** un integrante las exporta, **Then** recibe un CSV
   con una fila por transferencia no eliminada de su familia.
2. **Given** dos familias distintas, **When** exportan sus transferencias, **Then** ningún archivo
   contiene transferencias de la otra familia.

---

### Edge Cases

- **Sin datos**: exportar cuando no hay movimientos (o ninguno cumple el filtro) devuelve un CSV
  **válido** con solo la fila de encabezado, no un error.
- **Texto con separadores**: notas/nombres con comas, comillas dobles, punto y coma o saltos de línea
  se escapan según el estándar CSV para no romper columnas.
- **Caracteres acentuados**: tildes y ñ se preservan (codificación que las planillas leen bien).
- **Movimiento sin categoría**: la celda de categoría queda vacía (los ingresos/gastos sin categoría
  son válidos).
- **Aislamiento**: ningún integrante puede exportar datos de otra familia.
- **Privacidad**: los montos y notas van en el archivo del propio usuario, pero **nunca** en logs ni
  telemetría; solo se registra el evento de exportación (conteos), no el contenido.
- **Volumen**: el archivo se genera bajo demanda; a escala piloto un export completo es rápido.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Un integrante MUST poder exportar los **movimientos** (ingresos y gastos) de su familia
  como un **archivo CSV descargable** mediante una solicitud autenticada.
- **FR-002**: El CSV de movimientos MUST incluir una **fila de encabezado legible en español** y, por
  movimiento, las columnas: **Fecha** (ocurrencia), **Tipo** (ingreso/gasto), **Monto** (CLP),
  **Cuenta** (nombre), **Categoría** (nombre, o vacío), **Nota**, **Autor** (email del integrante que
  lo registró) y **Creado** (fecha de creación).
- **FR-003**: La exportación de movimientos MUST admitir los mismos **filtros opcionales** que el
  historial (rango de fechas, cuenta, categoría, tipo); sin filtros, exporta todos los movimientos no
  eliminados de la familia.
- **FR-004**: Toda exportación MUST derivar su alcance de familia de la **sesión autenticada** y NUNCA
  incluir datos de otra familia (Principio I).
- **FR-005**: Los movimientos con **borrado lógico** MUST excluirse de la exportación (consistente con
  el historial y los saldos).
- **FR-006**: El CSV MUST ser **bien formado y compatible con planillas**: fila de encabezado, escape
  correcto de separadores/comillas/saltos de línea en campos de texto, codificación que preserva
  acentos, montos como enteros CLP (sin decimales) y fechas en formato calendario (AAAA-MM-DD).
- **FR-007**: Un integrante MUST poder exportar las **transferencias** de su familia como CSV con
  encabezado en español y las columnas: **Fecha**, **Cuenta origen** (nombre), **Cuenta destino**
  (nombre), **Monto** (CLP), **Autor** (email) y **Creado**, excluyendo las eliminadas. Se expone en
  un endpoint separado del de movimientos.
- **FR-008**: Ningún monto, nota **ni email de autor** MUST aparecer en logs ni telemetría; solo el
  **evento** de exportación (p. ej. conteo de filas) puede registrarse, sin contenido sensible
  (Principio II).
- **FR-009**: El archivo se genera **bajo demanda** y se entrega para descarga; NO se persiste un
  artefacto de exportación ni se usa almacenamiento de terceros.
- **FR-010**: Los endpoints de exportación MUST quedar documentados en OpenAPI (ruta, parámetros de
  filtro, tipo de contenido y forma del CSV) y, cuando aplique, con tipos compartidos en
  `packages/contracts` (Principio VI).
- **FR-011**: La exportación está disponible para **cualquier integrante** de la familia (es lectura
  de datos compartidos, como el historial); no requiere rol Owner.

### Key Entities *(include if feature involves data)*

- **Exportación CSV** *(artefacto generado, no persistido)*: una representación tabular de los
  movimientos (o transferencias) de la familia en el momento de la solicitud. No es una entidad
  almacenada; se deriva de los datos existentes y se entrega como archivo. Se expone en **dos
  endpoints separados** (movimientos y transferencias).
- **Fila de movimiento (CSV)** — encabezado: `Fecha, Tipo, Monto, Cuenta, Categoría, Nota, Autor, Creado`
  (Autor = email del integrante que lo registró).
- **Fila de transferencia (CSV)** — encabezado: `Fecha, Cuenta origen, Cuenta destino, Monto, Autor, Creado`
  (Autor = email).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un integrante puede exportar todos los movimientos de su familia en **una sola acción**
  y obtener el archivo en pocos segundos a escala piloto.
- **SC-002**: El CSV exportado abre correctamente en una planilla estándar con las columnas alineadas
  y los caracteres especiales (tildes, comas en notas) intactos el **100%** de las veces.
- **SC-003**: El archivo contiene **exactamente** los movimientos no eliminados de la familia que
  cumplen los filtros: **0** filas de otra familia y **0** filas de movimientos eliminados.
- **SC-004**: **Ningún** monto, nota ni email de autor aparece en logs ni telemetría, incluso ante
  errores.
- **SC-005**: La exportación de transferencias lista con exactitud las transferencias no eliminadas de
  la familia (cuenta origen/destino, monto, fecha) el **100%** de las veces.
- **SC-006**: Exportar sin datos (o sin coincidencias de filtro) produce un CSV válido con solo el
  encabezado el **100%** de las veces (nunca un error).

## Assumptions

- **Alcance backend-first**: EXP-01 entrega los **endpoints de exportación** y sus contratos; el botón
  de **descargar/compartir en Expo/RN se difiere** al track móvil (que consumirá el endpoint). La
  validación en dispositivo físico del DoD aplicará cuando se construya esa UI.
- **Descarga síncrona bajo demanda**: el CSV se genera y devuelve en la respuesta; **sin** trabajo
  asíncrono, correo, almacenamiento en la nube ni archivos persistidos (Principio V; y consistente con
  los No-objetivos: no se extrae ni deposita datos en terceros).
- **Solo exportación**: la **importación** de CSV/cartolas es Won't (IMP-01) y queda fuera; EXP-01 no
  lee archivos, solo produce.
- **Formato CSV**: **UTF-8 con BOM**, **delimitador coma** y comillas según **RFC-4180** (máxima
  interoperabilidad con planillas; el BOM preserva tildes/ñ), montos enteros en CLP y fechas
  AAAA-MM-DD. (Confirmado en specify; una prueba valida la apertura correcta en planilla.)
- **Reutiliza HIS-01 y los datos existentes**: los filtros y los movimientos/transferencias ya
  existen; EXP-01 los lee y formatea; no crea colecciones nuevas ni cambia esos datos.
- **Cualquier integrante exporta** (lectura de datos compartidos, como el historial); no es Owner-only.
- **Moneda CLP** en todos los montos, consistente con el MVP.

## Dependencies

- **TXN-01 / HIS-01** — movimientos y sus filtros de historial (fuente y criterios de la exportación). Requerido.
- **TXN-02** — transferencias (fuente de la exportación de transferencias). Requerido.
- **ACC-01 / CAT-01** — nombres de cuenta y categoría que se resuelven en el CSV. Requerido.
- **AUTH-01 / FAM-01** — sesión autenticada y alcance de familia. Requerido.

## Out of Scope

- **Importación** de CSV/cartolas (IMP-01, Won't) y cualquier lectura de archivos externos.
- Otros formatos de exportación (Excel .xlsx, PDF, JSON).
- Exportaciones **programadas/automáticas**, entrega por correo o a almacenamiento en la nube.
- Exportar la **configuración** (cuentas, categorías, presupuestos) — EXP-01 cubre el movimiento de
  dinero (ingresos/gastos y transferencias), no el respaldo de configuración.
- El **botón de descargar/compartir en `apps/mobile`** (track móvil diferido).
