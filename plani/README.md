# Dotación HC — Konecta Soporte AR

Aplicación web para calcular y analizar el cumplimiento de dotación mensual del equipo de soporte de Konecta Argentina (~400 agentes, 8 servicios). Todo el procesamiento ocurre en el navegador; no hay backend ni base de datos.

---

## Índice

1. [Archivos de entrada](#1-archivos-de-entrada)
2. [Servicios soportados](#2-servicios-soportados)
3. [Cómo funciona el cálculo](#3-cómo-funciona-el-cálculo)
   - 3.1 [Parseo del CP](#31-parseo-del-cp)
   - 3.2 [Parseo de la nómina](#32-parseo-de-la-nómina)
   - 3.3 [Parseo de reductores](#33-parseo-de-reductores)
   - 3.4 [Horas brutas por agente](#34-horas-brutas-por-agente)
   - 3.5 [Factor productivo](#35-factor-productivo)
   - 3.6 [Horas netas y cumplimiento](#36-horas-netas-y-cumplimiento)
   - 3.7 [Delta HC @ 103%](#37-delta-hc--103)
   - 3.8 [Agentes equivalentes](#38-agentes-equivalentes)
4. [Engine de cobertura franja a franja](#4-engine-de-cobertura-franja-a-franja)
5. [Sistema de alertas](#5-sistema-de-alertas)
6. [Filtros dinámicos](#6-filtros-dinámicos)
7. [Simulador What-If](#7-simulador-what-if)
8. [Mapeo de segmentos](#8-mapeo-de-segmentos)
9. [Consideraciones y limitaciones](#9-consideraciones-y-limitaciones)
10. [Stack técnico](#10-stack-técnico)
11. [Correr en local](#11-correr-en-local)

---

## 1. Archivos de entrada

Se requieren exactamente tres archivos Excel (`.xlsx`). El procesamiento ocurre en el cliente con SheetJS.

| Archivo | Descripción | Hojas requeridas |
|---|---|---|
| **CP** (requerido del cliente) | Matriz de HC o Hs requeridas por franja horaria y día | Una por servicio + `Resumen` |
| **Reductores** | Porcentajes de deslogueo, ausentismo y rotación por servicio | Libre (se detecta por nombre de columna) |
| **Nómina** | Listado de agentes con estado, contrato, segmento y horario | Seleccionable si tiene múltiples hojas |

---

## 2. Servicios soportados

| ServicioKey | Hoja CP | Segmento en nómina |
|---|---|---|
| Conectividad | `Sop_Conectividad` | `SOPORTE-CONECTIVIDAD` |
| Entretenimiento | `Entretenimiento` | `SOPORTE-ENTRETENIMIENTO` |
| Esp.Movil | `Esp_Movil` | `SOPORTE-MOVIL` |
| Digital | `Digital` | `SOPORTE-RRSS` |
| PTF | `PTF` | `SOPORTE-CBS` |
| SMB Tec In | `SMB Tec In` | `TECNICA` |
| SMB Digital | `SMB_Digital` | `TECNICA RRSS` |
| SMB PTF | `SMB PTF` | `PWTF TECNICA` |

El mapeo es case-insensitive y normaliza espacios. Segmentos que no coinciden exactamente pueden configurarse manualmente desde la pantalla de Carga → panel "Mapeo de segmentos".

---

## 3. Cómo funciona el cálculo

### 3.1 Parseo del CP

El archivo CP tiene una hoja por servicio. La estructura esperada es:

```
Fila 0: día de semana por columna  (Lun, Mar, ..., "FERIADO", etc.)
Fila 1: fechas como serial Excel   (número entero, ej: 46000)
Fila 2+: valores por franja horaria (intervalos de 30 min, desde 00:00)
Fila N: "Total" o "TOTAL"          (suma diaria)
```

**Auto-detección de formato (Hs vs HC):**
El CP puede venir expresado en **horas** (ej: `3.5` para 3.5 hs de cobertura en esa franja) o en **HC** (ej: `7` agentes requeridos). El sistema samplea las primeras 10 filas × 5 columnas:

- Si todos los valores son enteros con promedio > 1 → formato **HC**
- Si hay decimales o promedio ≤ 1 → formato **Hs**

Internamente se mantienen dos matrices:
- `matriz`: valores crudos del archivo
- `hcMatrix`: siempre en HC. Si el CP viene en Hs: `hcMatrix[f][d] = matriz[f][d] / 0.5`

**Total mensual (`totalMes`) siempre en horas:**
- Formato HC: `Σ(hcMatrix[f][d] × 0.5)` para todos los intervalos del mes
- Formato Hs: suma de la fila "Total" diario del CP

Las fechas se convierten desde serial Excel con `EXCEL_EPOCH = 1899-12-30`. Celdas con valores no numéricos (`#VALUE!`, texto, etc.) se sanitizan a `0` con `safeNum()`.

### 3.2 Parseo de la nómina

La nómina puede tener nombres de columna variables entre meses. Se usa matching tolerante (normalización sin tildes, lowercase, trim):

| Dato | Columnas buscadas |
|---|---|
| Segmento | `segmento` |
| Estado | `estado` |
| Contrato | `contrato` |
| Horario turno | `horarios`, `horario`, `turno` |
| Sitio | `sitio`, `sede` |
| Modalidad | `modalidad`, `modalidad trabajo` |
| Jefe | `jefe`, `jefe directo`, `lider` |
| Superior | `superior`, `gerente` |

**Estado del agente:** se evalúa con `.toUpperCase() === "ACTIVO"`. Cualquier otro valor (LP, baja, licencia, etc.) se contabiliza como HC en LP y no aporta horas.

**Horario del turno:** se parsea desde la columna HORARIOS en tres formatos:
- `"09:00-15:00"` → entry `09:00`, exit `15:00`
- `"09:00 / 15:00"` → idem
- `"9 a 15"` → entry `09:00`, exit `15:00`

Si el campo está vacío o no coincide con ningún patrón, `entryTime` y `exitTime` quedan `null` y el agente usa distribución plana en el coverage engine.

**Contrato:** se extrae el primer número del texto de la columna CONTRATO con regex `/(\d+)/`. Si no hay número, se asume 36 hs semanales.

### 3.3 Parseo de reductores

El archivo de reductores debe tener columnas para servicio, deslogueo, ausentismo y rotación. Los valores se buscan por nombre de columna con matching tolerante. Los porcentajes se almacenan como decimales (ej: `0.05` para 5%).

### 3.4 Horas brutas por agente

```
hsMensualBrutas = hsSemanal × (diasDelMes / 7)
```

`diasDelMes` se toma de la cantidad de columnas con fechas válidas en el CP (no es el mes calendario sino los días reales del período).

Ejemplo: abril tiene 30 días. Un agente de 36 hs/semana aporta `36 × (30/7) = 154.3 hs brutas`.

### 3.5 Factor productivo

Combina deslogueo, ausentismo y rotación. Hay dos modos configurables:

**Multiplicativo** (default):
```
factor = (1 − deslogueo) × (1 − ausentismo) × (1 − rotación)
```

**Aditivo:**
```
factor = 1 − (deslogueo + ausentismo + rotación)
```

El modo multiplicativo es más conservador cuando los reductores son altos: cada componente actúa sobre el remanente del anterior, por lo que el impacto combinado es mayor que la suma simple.

Ejemplo con deslogueo=5%, ausentismo=4%, rotación=2%:
- Multiplicativo: `0.95 × 0.96 × 0.98 = 0.8930`
- Aditivo: `1 − 0.11 = 0.89`

Para reductores pequeños la diferencia es mínima. Para reductores altos (>15% combinado) el multiplicativo penaliza más.

### 3.6 Horas netas y cumplimiento

```
hsNetas = hsBrutas × factorProductivo
cumplimiento = (hsNetas / hsRequeridas) × 100
```

- `hsBrutas` es la suma de `hsMensualBrutas` de todos los agentes ACTIVOS del servicio.
- `hsRequeridas` es el `totalMes` de la matriz CP del servicio.
- Si `hsRequeridas = 0`, el cumplimiento se reporta como `0%` (sin división por cero).

**Niveles de cumplimiento:**

| Nivel | Rango | Color |
|---|---|---|
| Crítico | < 95% | Rojo |
| Bajo | 95% – 99.9% | Ámbar |
| Ideal | 100% – 115% | Verde |
| Alto | 115% – 130% | Celeste |
| Exceso | > 130% | Violeta |

### 3.7 Delta HC @ 103%

Responde: *¿cuántos agentes (en el contrato promedio actual) hacen falta para llegar al 103% del requerido del cliente?*

```
hsNetasObjetivo    = hsRequeridas × 1.03
hsBrutasNecesarias = hsNetasObjetivo / factorProductivo
hsBrutasActuales   = hcActivos × hsSemanalPromedio × (diasDelMes / 7)
deltaHs            = hsBrutasNecesarias − hsBrutasActuales
deltaHC103         = deltaHs / (hsSemanalPromedio × diasDelMes / 7)
```

- **Positivo** → faltan HC (déficit). Se muestra en rojo.
- **Negativo** → sobran HC (superávit). Se muestra en verde.
- `hsSemanalPromedio` es el promedio ponderado de las hs semanales de los agentes ACTIVOS del servicio.

El target del 103% (y no 100%) responde a que operar al límite exacto es frágil ante cualquier ausentismo puntual; el 3% de margen absorbe variaciones menores sin impactar el SLA.

### 3.8 Agentes equivalentes

Convierte el `deltaHC103` (en unidades HC promedio del servicio) a cantidad concreta de agentes según tipo de contrato:

```
hsPorAgente(hs)  = hs × (diasDelMes / 7) × factorProductivo
hsGap            = deltaHC103 × hsSemanalPromedio × (diasDelMes / 7)
agentesEq(hs)    = hsGap / hsPorAgente(hs)
```

Se calcula para 30, 35 y 36 hs/semana, y el "mix" usa el promedio actual del servicio.

Un agente de 30 hs aporta menos horas mensuales brutas, por lo tanto se necesitan más para cubrir el mismo gap. La diferencia no es lineal porque el factor productivo actúa igual sobre todos.

Ejemplo: gap de 500 hs netas, factor=0.90:
- 30 hs: `500 / (30 × 30/7 × 0.90) = 500 / 115.7 = 4.3 → 5 agentes`
- 36 hs: `500 / (36 × 30/7 × 0.90) = 500 / 138.9 = 3.6 → 4 agentes`

---

## 4. Engine de cobertura franja a franja

El coverage engine calcula, para cada franja de 30 minutos y cada día del mes, cuántos HC están disponibles vs cuántos requiere el CP.

### Disponibilidad de un agente en una franja

Los contratos tienen diferente cantidad de días laborales por semana, lo que afecta directamente la cobertura:

```
fraccionDias = hsSemanal === 36 ? 6/7 : 5/7
```

Los contratos de 36 hs trabajan 6 días/semana. Los de 30 y 35 hs trabajan 5 días/semana.

**Con horario real (columna HORARIOS en la nómina):**

```
duracionTurno = { 30hs: 360 min, 35hs: 420 min, 36hs: 360 min }
fin = entryTime + duracionTurno
disponibilidadEnFranja = (franja dentro del turno) ? fraccionDias : 0
```

El sistema maneja turnos que cruzan medianoche (ej: 22:00–04:00): si `fin > 1440`, el agente está disponible en franjas desde `entryTime` hasta el final del día, y también desde el inicio del día hasta `fin - 1440`.

**Sin horario real (fallback distribución plana):**

```
disponibilidad = (hsSemanal / 7) / 24
```

Distribuye las horas uniformemente en las 24h. El heatmap indica si se está usando cobertura real o distribución plana.

### Franjas críticas

Una franja se marca como **crítica** si está en déficit (`hcDisp / hcReq < 0.90`) en el 50% o más de los días del mes. Estas franjas se muestran en las alertas del dashboard.

### Escala del heatmap

| Ratio disp/req | Color | Estado |
|---|---|---|
| ≥ 1.15 | Verde oscuro | Exceso |
| 1.05 – 1.15 | Verde | Sobrante |
| 0.95 – 1.05 | Verde claro | OK |
| 0.90 – 0.95 | Amarillo | Justo |
| 0.80 – 0.90 | Rojo claro | Déficit leve |
| 0.70 – 0.80 | Rojo | Déficit |
| < 0.70 | Rojo oscuro | Gap severo |

---

## 5. Sistema de alertas

Las alertas se generan automáticamente tras cada procesamiento, ordenadas critical → warning → info.

**Global:**
- `critical` si cumplimiento total < 90%
- `warning` si cumplimiento total < 100%
- `info` si cumplimiento total > 115% (sobredotación)

**Por servicio:**
- `critical` si un servicio no tiene agentes pero sí tiene hs requeridas (indica mapeo roto)
- `critical` si cumplimiento < 80%
- `warning` si cumplimiento < 100%
- `warning` si reductor total > 8% (`deslogueo + ausentismo + rotación > 0.08`)
- `info` si cumplimiento > 115%

**Por coverage:**
- `warning` si hay franjas críticas (déficit en ≥50% de los días del mes)
- `info` si el día de peor cobertura tiene gap total < −10 HC

---

## 6. Filtros dinámicos

El dashboard permite filtrar por: sitio, modalidad, jefe, contrato (30/35/36hs) y estado (ACTIVO/LP).

Con filtro activo el sistema **recalcula los resultados** sobre el subconjunto de agentes filtrados, manteniendo las matrices CP originales como requerido. Permite responder preguntas como *"¿cómo es el cumplimiento solo para los agentes presenciales de Mar del Plata?"*

Los filtros solo aparecen si tienen más de una opción disponible.

---

## 7. Simulador What-If

Permite explorar escenarios sin modificar los archivos originales.

### Modo simple (sliders por servicio)

Ajusta directamente sobre cada servicio:
- **HC Extra**: agentes adicionales (negativo para simular salidas)
- **Hs/Sem**: contrato de los agentes extra
- **Deslogueo / Ausentismo / Rotación**: overrides de reductores

### Modo estructurado (operaciones)

| Operación | Efecto |
|---|---|
| `add_agents` | Suma HC y horas brutas al servicio con el contrato especificado |
| `remove_agents` | Resta HC y horas proporcionales al promedio del servicio |
| `move_agents` | Quita del servicio origen y suma al destino (mismas horas promedio) |
| `change_contract` | Cambia el contrato de N agentes (recalcula horas) |
| `change_reducer` | Override de deslogueo/ausentismo/rotación del servicio |

Las modificaciones estructuradas y el modo simple se acumulan. El resultado simulado combina ambas capas.

---

## 8. Mapeo de segmentos

El campo SEGMENTO de la nómina puede variar entre versiones del archivo. El sistema intenta resolver automáticamente (matching exacto case-insensitive). Si falla, se configura manualmente desde la pantalla de Carga:

1. Ingresar el texto exacto del segmento tal como aparece en la nómina
2. Seleccionar el ServicioKey de destino
3. El mapeo se aplica durante el procesamiento y persiste en la sesión

---

## 9. Consideraciones y limitaciones

**Granularidad temporal:** el cumplimiento es un valor mensual único. El CP sí tiene datos por franja y por día, pero la métrica de cumplimiento agrega todo el mes. El heatmap es donde se ve la granularidad real.

**Factor productivo homogéneo:** el reductor aplica igual a todos los agentes del servicio. No hay reductores individuales por agente ni variación diaria del ausentismo.

**hsSemanalPromedio:** si el mix de contratos cambia mucho entre meses, el `deltaHC103` puede ser impreciso porque proyecta el gap usando el promedio actual del pool, no el contrato de los agentes que se contrataría.

**Coverage sin horario real:** si la nómina no tiene columna HORARIOS o los datos no parsean, el engine usa distribución plana. En ese caso el heatmap muestra cobertura uniforme a lo largo del día, lo que puede ocultar problemas reales en franjas pico.

**Detección de formato CP:** el algoritmo Hs/HC es heurístico (samplea 10 filas × 5 columnas). Puede fallar si el CP tiene un servicio con requerido muy bajo (ej: 1 agente por franja, que es entero, pero la media da ≤ 1). Si los números del heatmap o el cumplimiento parecen desfasados exactamente por un factor 2, es probable que el formato no se detectó correctamente.

**Feriados:** se detectan si el texto del día de semana en el CP contiene la palabra "feriado". No hay validación contra calendario oficial; si el CP no lo marca, el sistema no lo sabe.

**NaN safety:** celdas del Excel con errores de fórmula (`#VALUE!`, `#REF!`, etc.) se convierten a `0`. Si un servicio muestra 0 hs requeridas siendo incorrecto, verificar que la hoja CP no tenga celdas con errores de fórmula.

**Datos en sesión únicamente:** no hay persistencia. Al cerrar o recargar el navegador, los archivos y resultados se pierden.

---

## 10. Stack técnico

| Tecnología | Uso |
|---|---|
| Next.js 16 App Router | Framework |
| TypeScript strict | Tipado |
| Tailwind CSS v4 | Estilos |
| Zustand v5 | Estado global (cliente) |
| SheetJS (xlsx) | Parseo de Excel en el navegador |
| Recharts | Gráficos |
| Framer Motion | Animaciones de transición |
| Vitest | Tests unitarios |

Todo el procesamiento ocurre en el navegador. No se envía ningún archivo a ningún servidor.

---

## 11. Correr en local

```bash
cd konecta-hc
pnpm install
pnpm dev       # http://localhost:3000
pnpm build     # build de producción
pnpm test      # tests unitarios con Vitest
```

Para deploy en Railway: el proyecto incluye configuración de Next.js standalone. Definir la variable de entorno `NODE_ENV=production` y el puerto que asigne la plataforma.
