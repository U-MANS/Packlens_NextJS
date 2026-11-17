# PackLens — Importación de proyecto demo (JSON / ZIP)

Documento de referencia para generar o adaptar una plantilla de **proyecto demo** que PackLens pueda importar desde la UI (**Proyectos → Proyecto demo**).

Úsalo como especificación: el resultado debe ser un JSON válido (y opcionalmente un ZIP con ficheros) listo para subir.

---

## Objetivo

Crear un proyecto de packaging de ejemplo en la organización activa, con:

- Datos de producto (nombre, SKU, mercados, briefing, etc.)
- Historial de propuestas de diseño
- Acciones de fase (`approve` / `reject` / `comment`)
- Actividad, tareas, comentarios y horas (opcionales)
- Ficheros de propuestas subidos a Supabase Storage (si se envía un ZIP)

Solo **Admin** o **Manager** pueden importar.

---

## Formas de entrega

### A) Solo JSON

- Archivo: cualquier `.json` con la estructura de este documento.
- Referencia de fábrica: `src/data/demo-project.template.json`
- Si el JSON referencia ficheros en `proposals[].files` y **no** hay ZIP, esas referencias se **omiten** (el proyecto se crea igual).

### B) ZIP (recomendado si hay artefactos)

```text
demo.zip
├── demo-project.json          # plantilla (nombre flexible; preferible *demo*.json)
└── files/
    ├── propuesta-v1.pdf
    └── propuesta-v2.pdf
```

Reglas del ZIP:

- Debe incluir **exactamente un JSON de plantilla usable** (si hay varios, se prioriza `demo-project.json` / `demo-project.template.json` / nombres que empiecen por `demo`).
- Las rutas en `proposals[].files` son **relativas al ZIP**, p. ej. `"files/propuesta-v1.pdf"`.
- También se acepta coincidencia por **basename** si el fichero está en otra carpeta.
- Límite práctico: ~50 MB, máx. ~80 entradas.
- Se ignoran `__MACOSX/` y `.DS_Store`.
- Si el JSON referencia un fichero que **no** está en el ZIP, la importación **falla**.

---

## Flujo de fases (packaging / Nacional)

Orden oficial (usar estos literales exactos):

1. `Diseño`
2. `Aprobación Diseño`
3. `Creación Desarrollo`
4. `Validación diseño`  ┐
5. `Aprobación Legal`   ┘ **gate paralelo**
6. `Arte final`
7. `Aprobación final`
8. `Aprobado`

### Gate paralelo (importante)

Para que el proyecto **no quede bloqueado** en Validación / Legal:

- Debe existir `phase_actions` con `type: "approve"` en **`Validación diseño`**
- Y también `type: "approve"` en **`Aprobación Legal`**
- Esas aprobaciones deben ser **posteriores** (menor `days_ago`) a la última propuesta de `Creación Desarrollo`

Si `project.phase` es posterior al gate (p. ej. `Arte final`, `Aprobación final`, `Aprobado`), incluye ambas aprobaciones.

### Proyecto “todo ya aprobado”

Para un demo cerrado:

```json
"phase": "Aprobado",
"status": "Aprobado"
```

Y en `phase_actions`, como mínimo:

| phase              | type      | actor_role típico |
|--------------------|-----------|-------------------|
| Aprobación Diseño  | approve   | Marketing         |
| Validación diseño  | approve   | Marketing         |
| Aprobación Legal   | approve   | I+D               |
| Arte final         | approve   | Diseño            |
| Aprobación final   | approve   | Marketing         |

Puedes añadir `reject` / `comment` anteriores para narrativa (cronología coherente con `days_ago`).

### Mapa fase → status

Si no envías `status`, el sistema puede inferirlo. Valores esperados:

| phase              | status                    |
|--------------------|---------------------------|
| Diseño             | En diseño                 |
| Aprobación Diseño  | En aprobación diseño      |
| Creación Desarrollo| En creación desarrollo    |
| Validación diseño  | En validación diseño      |
| Aprobación Legal   | En aprobación legal       |
| Arte final         | En arte final             |
| Aprobación final   | En aprobación final       |
| Aprobado           | Aprobado                  |

---

## Roles válidos (strings exactos)

Usados en `owner_role`, `design_lead_role`, `regulatory_role`, `uploaded_role`, `actor_role`, `role` de tareas/comentarios:

- `Admin`
- `Manager`
- `Marketing`
- `Diseño`
- `I+D`
- `Comercial` (según tenant; el demo suele usar Marketing / Diseño / I+D)

Los usuarios se resuelven así:

1. Si hay `owner_name` / `design_lead` / `regulatory_contact` y existe un usuario activo con ese nombre → se usa.
2. Si no, el **primer usuario activo** con ese rol.
3. Si no hay nadie de ese rol → fallback al actor / primer usuario.

---

## Estructura del JSON

Campos raíz:

```json
{
  "$schema_note": "opcional, texto libre",
  "project": { },
  "proposals": [ ],
  "phase_actions": [ ],
  "activity": [ ],
  "tasks": [ ],
  "comments": [ ],
  "time_entries": [ ]
}
```

Solo **`project`** es obligatorio. El resto es opcional.

### `project` (obligatorio)

| Campo | Tipo | Obligatorio | Notas |
|-------|------|-------------|--------|
| `name` | string | sí | Nombre del proyecto |
| `sku` | string | sí | Por defecto se añade sufijo único al importar |
| `phase` | string | sí | Una de las fases del orden oficial |
| `status` | string | no | Ver tabla fase→status |
| `lifecycle_status` | string | no | p. ej. `Borrador`, `Pendiente SAP`, `Vigente`, `Temporal`, `Descatalogado` |
| `flow_type` | string | no | p. ej. `Nacional` (default) |
| `product_line` | string | no | Gama |
| `format` | string | no | Formato de envase |
| `markets` | string[] | no | Códigos mercado, p. ej. `["ES","PT"]` (default `["ES"]`) |
| `label_languages` | string[] | no | |
| `label_languages_front` | string[] | no | |
| `label_languages_back` | string[] | no | |
| `launch_date` | string | no | `YYYY-MM-DD` |
| `art_deadline` | string | no | `YYYY-MM-DD` |
| `description` | string | no | |
| `briefing_notes` | string | no | Texto del briefing (puede llevar `\\n`) |
| `owner_role` | string | no | Default `Marketing` |
| `design_lead_role` | string | no | Default `Diseño` |
| `regulatory_role` | string | no | Default `I+D` |
| `owner_name` | string | no | Nombre exacto de usuario si se quiere forzar |
| `design_lead` | string | no | |
| `regulatory_contact` | string | no | |

### `proposals[]`

| Campo | Tipo | Notas |
|-------|------|--------|
| `name` | string | Obligatorio en la práctica |
| `version` | string | p. ej. `v1`, `v2` |
| `comments` | string | |
| `uploaded_role` | string | Default `Diseño` |
| `uploaded_phase` | string | Fase en la que se “subió”: `Diseño` o `Creación Desarrollo` |
| `days_ago` | number | Antigüedad relativa (mayor = más antiguo) |
| `files` | string[] | Rutas en el ZIP, p. ej. `["files/propuesta-v1.pdf"]` |

Convención útil:

- Primera propuesta en `uploaded_phase: "Diseño"`
- Revisiones de desarrollo en `uploaded_phase: "Creación Desarrollo"`

### `phase_actions[]`

| Campo | Tipo | Valores |
|-------|------|---------|
| `phase` | string | Fase de revisión |
| `type` | string | `approve` \| `reject` \| `comment` |
| `comment` | string | Texto de la acción |
| `actor_role` | string | Rol del actor |
| `days_ago` | number | Cronología relativa |

### `activity[]`

| Campo | Tipo | Notas |
|-------|------|--------|
| `type` | string | p. ej. `PROJECT_CREATED`, `DOCUMENT_UPLOADED`, `PHASE_CHANGED`, `REVIEW_APPROVED`, `REVIEW_REJECTED` |
| `text` | string | Descripción legible |
| `actor_role` | string | |
| `days_ago` | number | |

### `tasks[]`

| Campo | Tipo | Valores |
|-------|------|---------|
| `title` | string | |
| `role` | string | Rol asignado |
| `status` | string | `Pendiente` \| `Completada` |
| `priority` | string | `Alta` \| `Media` \| `Baja` |
| `due_days_from_now` | number | Negativo = vencida en el pasado |

### `comments[]`

| Campo | Tipo | Notas |
|-------|------|--------|
| `text` | string | |
| `role` | string | |
| `resolved` | boolean | |
| `days_ago` | number | |

### `time_entries[]`

| Campo | Tipo | Notas |
|-------|------|--------|
| `employee_name` | string | Nombre libre (no tiene que existir como usuario) |
| `hours` | number | |
| `description` | string | |
| `entry_date_days_ago` | number | Antigüedad del día trabajado |

---

## Cronología (`days_ago`)

- Número **mayor** = evento **más antiguo**.
- Mantén coherencia narrativa, por ejemplo:

```text
20  PROJECT_CREATED
18  propuesta v1 (Diseño) + cambio a Aprobación Diseño
16  reject Aprobación Diseño
14  approve Aprobación Diseño
 7  propuesta v2 (Creación Desarrollo)
 4  approve Validación diseño
 3  approve Aprobación Legal
 2  approve Arte final
 1  approve Aprobación final → phase Aprobado
```

Para el gate paralelo: ambos `approve` de Validación y Legal deben tener `days_ago` **menor** que el de la última propuesta de `Creación Desarrollo`.

---

## Ejemplo mínimo (sin ficheros)

```json
{
  "project": {
    "name": "Mermelada Demo 340g",
    "sku": "DEMO-MIN-340",
    "phase": "Aprobado",
    "status": "Aprobado",
    "markets": ["ES"],
    "flow_type": "Nacional",
    "owner_role": "Marketing",
    "design_lead_role": "Diseño",
    "regulatory_role": "I+D"
  },
  "proposals": [
    {
      "name": "Propuesta v1",
      "version": "v1",
      "uploaded_role": "Diseño",
      "uploaded_phase": "Diseño",
      "days_ago": 10
    },
    {
      "name": "Propuesta v2",
      "version": "v2",
      "uploaded_role": "Diseño",
      "uploaded_phase": "Creación Desarrollo",
      "days_ago": 5
    }
  ],
  "phase_actions": [
    {
      "phase": "Aprobación Diseño",
      "type": "approve",
      "comment": "OK diseño",
      "actor_role": "Marketing",
      "days_ago": 8
    },
    {
      "phase": "Validación diseño",
      "type": "approve",
      "comment": "OK validación",
      "actor_role": "Marketing",
      "days_ago": 3
    },
    {
      "phase": "Aprobación Legal",
      "type": "approve",
      "comment": "OK legal",
      "actor_role": "I+D",
      "days_ago": 3
    },
    {
      "phase": "Arte final",
      "type": "approve",
      "comment": "OK arte final",
      "actor_role": "Diseño",
      "days_ago": 2
    },
    {
      "phase": "Aprobación final",
      "type": "approve",
      "comment": "Aprobado",
      "actor_role": "Marketing",
      "days_ago": 1
    }
  ]
}
```

---

## Ejemplo con ficheros (ZIP)

JSON:

```json
{
  "project": {
    "name": "Mermelada Demo 340g",
    "sku": "DEMO-ZIP-340",
    "phase": "Aprobado",
    "status": "Aprobado",
    "markets": ["ES", "PT"]
  },
  "proposals": [
    {
      "name": "Propuesta v1",
      "version": "v1",
      "uploaded_phase": "Diseño",
      "days_ago": 10,
      "files": ["files/propuesta-v1.pdf"]
    },
    {
      "name": "Propuesta v2",
      "version": "v2",
      "uploaded_phase": "Creación Desarrollo",
      "days_ago": 5,
      "files": ["files/propuesta-v2.pdf"]
    }
  ],
  "phase_actions": [
    { "phase": "Aprobación Diseño", "type": "approve", "actor_role": "Marketing", "days_ago": 8 },
    { "phase": "Validación diseño", "type": "approve", "actor_role": "Marketing", "days_ago": 3 },
    { "phase": "Aprobación Legal", "type": "approve", "actor_role": "I+D", "days_ago": 3 },
    { "phase": "Arte final", "type": "approve", "actor_role": "Diseño", "days_ago": 2 },
    { "phase": "Aprobación final", "type": "approve", "actor_role": "Marketing", "days_ago": 1 }
  ]
}
```

ZIP:

```text
demo.zip
├── demo-project.json
└── files/
    ├── propuesta-v1.pdf
    └── propuesta-v2.pdf
```

Formatos de fichero habituales: PDF, PNG, JPG, WEBP. Se suben a Storage bajo `projects/{id}/proposals/`.

---

## Instrucciones para una IA generadora

Cuando te pidan “generar un proyecto demo PackLens”:

1. Devuelve **JSON válido** con la estructura de este documento (o un ZIP descrito + el JSON).
2. Usa literales de fase **exactos** (incluyendo tildes y mayúsculas): `Validación diseño`, `Aprobación Legal`, etc.
3. Si el proyecto debe verse **completo**, pon `phase`/`status` en `Aprobado` y añade **ambas** aprobaciones del gate paralelo.
4. Mantén `days_ago` coherente (más alto = más antiguo; aprobaciones paralelas después de la última propuesta de desarrollo).
5. Si hay artefactos, referencia rutas en `proposals[].files` y lista los ficheros que deben ir en el ZIP.
6. No inventes campos fuera de este esquema; campos extra en la raíz se ignoran, pero `project.name`, `project.sku` y `project.phase` son obligatorios.
7. Preferible basarte en / extender `src/data/demo-project.template.json`.

---

## Cómo se importa en la app

1. Ir a **Proyectos**.
2. Pulsar **Proyecto demo** (Admin/Manager).
3. Descargar plantilla / usar incluida, o subir `.json` / `.zip`.
4. Revisar la vista previa.
5. (Opcional) desmarcar “SKU único” solo si el SKU del JSON debe forzarse.
6. **Crear proyecto**.

API (referencia técnica):

- `POST /api/v1/projects/demo`
- JSON body: `{ "template": { ... }, "unique_sku": true }`
- multipart: campo `archive` (ZIP) + `unique_sku`

---

## Plantilla de referencia

Archivo canónico en el repo:

`src/data/demo-project.template.json`
