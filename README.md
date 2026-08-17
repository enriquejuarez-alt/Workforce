# Nomina / Plani

Sistema para cargar nomina, matrices CP, reductores y simular la planificacion de dotacion por servicio/isla.

## Stack

- Next.js + React + TypeScript
- Zustand para estado local
- TailwindCSS para UI
- `xlsx` para lectura de Excel
- `exceljs` para exportaciones
- `react-hot-toast` para notificaciones

## Instalacion rapida

```bash
npm install
npm run dev
```

El servidor de desarrollo corre con Next.js. Si el puerto por defecto esta ocupado, Next propone otro puerto.

## Flujo de Plani

1. Seleccionar servicio (requerido antes de procesar).
2. Cargar matrices CP por servicio.
3. Cargar reductores, usar la calculadora o elegir un set guardado.
4. Cargar nomina desde sistema (con filtro opcional por isla) o subir Excel manualmente.
5. Revisar resumen, curvas, francos y simulador.
6. Exportar escenarios cuando haga falta.

## Conceptos base

### Agentes activos

Solo los agentes con estado `ACTIVO` suman horas productivas. Los agentes en LP o estados no activos se cuentan aparte como `hcLP`.

Para cada servicio:

```text
HC activos = cantidad de agentes activos del servicio
HC LP      = cantidad de agentes no activos del servicio
HC capa    = cantidad de agentes activos marcados como capa/capacitacion
```

### Horas brutas mensuales

Cada agente aporta horas brutas segun su contrato semanal y los dias del mes:

```text
Hs mensuales brutas del agente = hs semanales * (dias del mes / 7)
```

Para cada servicio:

```text
Hs brutas servicio = suma de hs mensuales brutas de sus agentes activos
Hs semanal promedio = suma de hs semanales activas / HC activos
```

### Nomina por isla

Algunos servicios (ej. Soporte Tecnico) agrupan varias islas bajo un unico
`servicio_id` del sistema (CBS, Conectividad, Entretenimiento, Movil, RRSS
mas otros segmentos no relacionados). La distincion real vive en el campo
`segmento` de cada agente, no en el `servicio_id`.

En el paso "Nomina activa" de Planificacion aparece un selector de isla
cuando el servicio activo agrupa mas de una (`getServiciosActivos().length > 1`
en `lib/config/servicesRuntime.ts`). Muestra la cantidad de agentes
detectados por isla y permite acotar el calculo a una isla puntual en vez
del agregado completo.

Servicios agrupados disponibles: Soporte Tecnico (CBS, Conectividad,
Entretenimiento, Movil, RRSS), Movil (Abonos, Prepago, WhatsApp, Degradados,
Madrugada), Hogares Convergentes (WhatsApp Factura Unificada, FTU, Flow Plus)
y Hogares No Convergentes. Los tres ultimos (`lib/config/servicesMovil.ts`,
`servicesHogarConvergente.ts`, `servicesHogarNoConvergente.ts`) todavia usan
`segmentosNomina` estimados porque no hay un archivo de Nomina real para
esos servicios: ajustar apenas se cargue uno.

## Agentes hipoteticos

En la card "Nomina activa" de Planificacion, una vez cargada la nomina, se
pueden agregar agentes que todavia no existen en el sistema (contrataciones
o traslados en curso) para simular su impacto: servicio destino, cantidad,
contrato (30/35/36/40 hs o uno libre) y horario opcional (sin horario usan
distribucion plana en el motor de curvas).

No tienen DNI/usuario real (`HIP-<id>-<n>`) y no se persisten en la nomina;
viven solo en el estado del formulario de carga. Al procesar, se expanden a
`Agente[]` (`lib/domain/agentesHipoteticos.ts::expandirAgentesHipoteticos`)
y se concatenan a los agentes reales antes de `aplicarDiasAlMes`, asi que
cuentan en todo el calculo: cumplimiento, curvas, francos y exportaciones.
La action bar muestra cuantos hay incluidos en la corrida actual.

## Nomina General

Pagina `/planificacion/nomina-general`: precarga el archivo "Nomina de
servicios.xlsx" (Dni, Representante, Servicios, Hs FINAL, Contratos, Activo)
**una sola vez por mes**, en vez de subirlo isla por isla.

- Se guarda como una unica `NominaMensual` bajo un Servicio "paraguas" fijo
  llamado `Nómina General` (creado por upsert en
  `importNominaServicios`, `backend/src/controllers/nominas.ts`). El
  segmento de cada agente no se parte por isla al importar: se resuelve
  dinamicamente en Planificacion segun la isla activa.
- Es visible desde cualquier isla ademas de la nomina propia de ese
  servicio (`listNominas` agrega el id de `Nómina General` a los servicios
  visibles del usuario, sea admin o no).
- Se puede editar el mes/año de una carga ya hecha (`PATCH
  /nominas/:id/periodo`, `updateNominaPeriodo`) sin tener que volver a
  subir el archivo, y borrarla cuando ya no hace falta.
- El listado de nominas de cada isla en `/planificacion` (paso "Nomina
  activa") ahora se consulta tambien para islas "demo" sin Servicio propio,
  ya que la Nómina General puede cubrirlas igual.
- Fix relacionado: el selector de Isla en `FilterBar` filtraba mal cuando la
  nomina cargada trae agentes de toda la empresa (justamente lo que hace la
  Nómina General) — antes listaba cualquier segmento presente en la nomina;
  ahora solo ofrece las islas realmente configuradas para el servicio activo
  (`getServiciosKeys()` en `lib/config/servicesRuntime.ts`).

## Reductores

Los reductores representan perdida esperada de productividad:

- Deslogueo operativo
- Ausentismo sin LP
- Rotacion

Los valores se guardan como decimal. Ejemplo: `8% = 0.08`.

### Factor productivo

Hay dos modos posibles:

```text
Modo multiplicativo:
factor productivo = (1 - deslogueo) * (1 - ausentismo) * (1 - rotacion)

Modo aditivo:
factor productivo = max(0, 1 - (deslogueo + ausentismo + rotacion))
```

El modo multiplicativo conserva la interaccion entre reductores. El modo aditivo resta todo linealmente.

### Horas netas

```text
Hs netas = Hs brutas * factor productivo
```

Estas son las horas que se comparan contra la necesidad del cliente.

## Calculadora de reductores

La calculadora genera `reductores-calculados.xlsx` desde tres archivos:

- `DESLOGUEO Real.xlsx`: usa `% DO`.
- `AUSENTISMO Real.xlsx`: usa `Indice SLP`.
- `ROTACION Real (Portal de Datos).xlsx`: usa `% Rotacion`.

Para cada indicador toma los ultimos tres meses cerrados y calcula:

```text
promedio ponderado = (mes 1 * 80 + mes 2 * 90 + mes 3 * 100) / 270
```

Ejemplo: para proyectar mayo, usa febrero, marzo y abril.

### Calculo de rotacion real

```text
Rotacion mes = bajas del mes / ((nomina inicio del mes + nomina fin del mes) / 2)
```

### Mapeo de rotacion

El archivo de rotacion viene por `Subarea`, por eso se mapea a servicios de Plani. Ejemplo:

```text
SOPORTE TECNICO -> SOPORTE-CBS
SOPORTE TECNICO -> SOPORTE-CONECTIVIDAD
SOPORTE TECNICO -> SOPORTE-ENTRETENIMIENTO
SOPORTE TECNICO -> SOPORTE-MOVIL
SOPORTE TECNICO -> SOPORTE-RRSS
```

El resultado final queda en la hoja:

```text
RESUMEN PONDERADO

Servicio | Deslogueo | Ausentismo | Rotacion
```

## Reductores guardados

Ademas de subir un archivo o usar la calculadora, los reductores se pueden
persistir en la base (pestaña "Guardados" del paso 2 en Planificacion):

- Guardar el set actual (`reductoresPreview`) con mes/anio y un nombre
  opcional para reutilizarlo despues sin volver a subir el archivo.
- Se permiten varias versiones guardadas para el mismo mes/anio (no se
  pisan entre si); se listan por fecha de carga, mas reciente primero.
- Editar valores individuales por servicio (deslogueo/ausentismo/rotacion)
  desde la misma lista.
- Borrar un set completo cuando ya no hace falta.

Al elegir un set guardado, se reconstruye un Excel sintetico con el mismo
formato `RESUMEN PONDERADO` (reutilizando `buildWorkbook`/`reductoresAFile`
de `lib/parsers/calcularReductores.ts`), asi el resto del flujo de
Procesar no distingue si los reductores vinieron de un archivo, la
calculadora o un set guardado.

Backend: modelos `ReductorImportacion`/`ReductorServicio` (Prisma) y CRUD
en `backend/src/controllers/reductores.ts` (`GET/POST /reductores`,
`GET /reductores/:id`, `PATCH /reductores/:id/servicios/:servicioId`,
`DELETE /reductores/:id`).

## Planificaciones guardadas

Distinto de "Reductores guardados" (que solo persiste el set de
deslogueo/ausentismo/rotacion): esto guarda la foto completa de una
corrida ya procesada — CP, reductores, nomina, resultado y alertas — para
poder volver a abrirla despues sin repetir la carga de archivos.

- Boton "Guardar planificacion" en `/planificacion/resumen`, con nombre
  opcional. Guarda el estado vigente del store (`resultado`, `matrices`,
  `agentes`, `reductores`, `francosServicio`, `alertas`, `diasDelMes`,
  `topeFacturacion`, `modoReductor`) junto al servicio activo
  (`servicioKey`/`servicioNombre`, seteados por `setServicioActivo` al
  terminar de procesar en `app/planificacion/page.tsx`).
  **Fix:** antes no se guardaba `francosServicio` — una planificacion
  guardada que usaba el motor dia a dia volvia silenciosamente al modelo
  plano al recargarla desde "Cargar en sesion activa". Ahora se persiste
  (columna `francos_servicio`, nullable) y se restaura junto al resto.
- Listado en `/planificacion/guardadas` con filtro por servicio y por
  mes/anio, y borrado individual.
- Ficha en `/planificacion/guardadas/:id` con los KPIs, alertas, grafico de
  cumplimiento y tabla resumen de esa corrida puntual, mas un boton
  "Cargar en sesion activa" que rehidrata todos los stores (Resultados,
  Uploads, FrancoConfig) para habilitar Curvas/Francos/Simulador sobre esa
  planificacion.
- Las matrices se guardan como JSON via `lib/domain/serializacion.ts`
  (`serializarMatrices`/`deserializarMatrices`), que convierte el `Map` a
  entries y las fechas de cada dia a ISO string (y de vuelta a `Date` al
  leer).

Backend: modelo `PlanificacionGuardada` (Prisma) y CRUD en
`backend/src/controllers/planificacionesGuardadas.ts`
(`GET/POST /planificaciones-guardadas`, `GET /planificaciones-guardadas/:id`,
`DELETE /planificaciones-guardadas/:id`), con auditoria de creacion/borrado.

## Francos reales y motor de calculo dia a dia

No confundir con la seccion "Contratos y francos" de mas abajo (esa es un
**modelo probabilistico** de franco por tipo de contrato, usado en Curvas).
Esta es la carga del **% de franco real** medido, servicio por servicio.

Pagina `/planificacion/francos`: importa un Excel de francos. El parser
(`lib/parsers/parseFrancos.ts::parseFrancos`) detecta automaticamente cual
de los dos formatos soportados trae el archivo:

- **Agregado** (`% Francos Julio` + `Detalle Contratos`, dos hojas fijas):
  - `% Francos Julio`: grilla de bloques de 8 filas por servicio (1 fila de
    encabezado + Lun..Dom) con el % real de gente de franco cada dia.
  - `Detalle Contratos`: dotacion, horas ponderadas y dias ponderados por
    servicio.
  - Se cruzan ambas hojas por nombre de servicio normalizado
    (`parseFrancosAgregado`).
- **Roster por agente** (una sola hoja, una fila por agente): columnas
  `Nombre / DNI / Gestion / Horas / Dias / Lunes..Domingo`, donde cada
  columna de dia es un indicador `0`/`1` de franco ese dia
  (`parseFrancosPorAgente`, detectado por encabezado en
  `detectarHojaPorAgente`). Se agrega por servicio (columna `Gestion`):
  dotacion = cantidad de agentes, horas/dias ponderados = promedio simple
  de `Horas`/`Dias` de esos agentes, y el % de franco de un dia = fraccion
  de agentes del servicio con el indicador en `1` ese dia. Es el roster
  crudo del que sale el formato agregado — mismo resultado, sin el paso
  intermedio de agregacion manual en Excel.

Si el archivo no matchea ninguno de los dos formatos, se devuelve un error
en vez de importar datos parciales. El resultado de cualquiera de los dos
caminos es el mismo `FrancoServicioDatos[]`, asi que el resto del flujo
(guardado, edicion, motor de calculo) no distingue de donde vino.

Se guarda con mes/año (`FrancoImportacion`/`FrancoServicio`,
CRUD en `backend/src/controllers/francos.ts`:
`GET/POST /francos`, `GET /francos/:id`,
`PATCH /francos/:id/servicios/:servicioId`, `DELETE /francos/:id`), se
puede editar valor por valor despues de importar, y se listan varias cargas
por mes (se usa la mas reciente).

### Como se conecta al calculo

Al procesar en `/planificacion` (`app/planificacion/page.tsx`), antes de
calcular resultados:

1. Busca si hay Francos cargados para el mes/año de la corrida y el
   servicio activo (matcheando por los mismos alias de nombre que usa el
   resto del sistema).
2. Busca tambien vacaciones que se superponen con ese rango de fechas
   (`GET /vacaciones?desde=&hasta=`) y arma un descuento real por DNI
   (`construirVacacionesPorDni`), en vez de estimarlo.

Si hay Francos para ese servicio+mes+año, `calcularResultados`
(`lib/domain/calculos.ts`) reemplaza el modelo plano
(`Hs netas = Hs brutas * factor productivo`) por el motor dia a dia
(`lib/domain/hsLogueoDiaADia.ts::calcularHsLogueoDiaADia`), que para cada
dia del mes encadena:

```text
nomina activa dia = nomina inicial - vacaciones dia - licencia - bajas por rotacion (en rampa lineal)
agentes de franco dia = % franco real del dia de semana * nomina activa dia
agentes ausentes dia  = (nomina activa dia - agentes de franco dia) * ausentismo mensual
agentes presentes dia = nomina activa dia - agentes de franco dia - agentes ausentes dia
hs logueo dia         = agentes presentes dia * horas ponderadas * (1 - deslogueo mensual)
```

`totalHsLogueo` (suma de todos los dias) pasa a ser las HS Netas del
servicio, y el factor productivo mostrado se recalcula como
`hsNetas / hsBrutas` solo para mantener coherente el resto de la UI. Si no
hay Francos cargados para ese servicio+mes+año, se sigue usando el modelo
plano de siempre sin cambios.

`calcularResultados` arma el input del motor via el helper compartido
`construirInputDiaADia` (`lib/domain/calculos.ts`), reutilizado tambien por
`simularDiaADiaServicio` (ver "Simulador dia a dia" mas abajo) para que el
calculo "oficial" y el simulador nunca diverjan.

**Fix de parseo de fechas incluido:** el export de vacaciones trae fechas
`d/m/yyyy` sin cero a la izquierda (ej. `31/8/2026`); el regex de
`parseWfDate` (`backend/src/controllers/vacaciones.ts`) antes exigia
`dd/mm/yyyy` exacto y caia al parser nativo de `Date()` (que interpreta
`mm/dd/yyyy` en inglés), corrompiendo fechas. Ahora acepta 1 o 2 digitos y
los rellena con cero antes de armar el ISO string.

### Feriados dentro del motor dia a dia

El calculo de HS de logueo en un dia FERIADO usa la misma cadena de arriba,
cambiando unicamente la cantidad de francos de ese dia. Formula dada por el
area de referencia (verificada formula-por-formula contra su Excel, ver
`lib/domain/hsLogueoDiaADia.ts::calcularHsLogueoDiaADia`):

```text
Dias no feriados: Francos = Dotacion Activa * %Francos (normal del dia de semana)
Dias feriados:     Francos = Dotacion Activa * %Francos
                            + Dotacion Activa * (1 - %Francos) * (1 - %HsRequeridasFeriado)
```

`%HsRequeridasFeriado` (el "%Presente" que la referencia declara a mano por
feriado) se deriva automaticamente de la propia curva del CP:
`calcularFrancoFeriados` compara el Requerido de ese feriado puntual contra
el promedio de Requerido de los demas dias con el mismo dia de semana en el
mes ("dias similares"). Si el feriado pide la mitad de lo habitual da 0.5;
si pide lo mismo de siempre da 1 (sin ajuste extra); si es cierre total da 0
(todos los que quedaban pasan a franco). El ajuste se SUMA sobre el franco
normal del dia, nunca lo reemplaza.

Un dia se considera feriado si el CP lo marca explicitamente en su fila de
dia de semana (texto "Feriado"), **o** si la fecha cae en el calendario de
feriados nacionales de Argentina (`lib/config/feriadosArgentina.ts`,
`esDiaFeriado` en `lib/utils/excel.ts`) — red de seguridad para cuando el CP
no lo marca. Ese calendario cubre feriados de fecha fija, los calculados a
partir de la Pascua (algoritmo de Gauss: Carnaval, Viernes Santo) y los
"trasladables" por Ley 27.399 (San Martin, Diversidad Cultural, Soberania
Nacional). **No cubre** los "dias no laborables" que el Gobierno decreta
puntualmente cada año (puentes) — esos no siguen ninguna regla fija y solo
se pueden corregir marcando el CP a mano.

### Eventos de dotacion fechados (bajas/altas puntuales)

El motor tambien acepta `eventosPorDia` (`Map<dia, delta>`) en
`InputDiaADia`: un delta neto de nomina para un dia puntual del mes,
acumulado dia a dia a partir de ese dia. Replica la columna "Ingresos" del
archivo de referencia del cliente, que hace que la Nomina Final baje o suba
en una fecha concreta en vez de asumir una nomina constante todo el mes.
Sin `eventosPorDia`, el comportamiento es identico al de antes. Ver
"Simulador dia a dia" para donde se cargan estos eventos.

**La rampa de rotacion se calcula sobre la nomina BASE del dia (nomina
inicial + eventos acumulados hasta ese punto), no sobre la nomina inicial
constante.** Esto se corrigio despues de verificar la formula real de la
referencia contra un archivo CON eventos reales (con un archivo sin
eventos no se puede distinguir entre las dos formas de calcularla, porque
nomina base y nomina inicial coinciden todo el mes) — su Excel calcula
`Rotacion = %Rotacion * (dia/diasDelMes) * Nomina Final del dia`, y "Nomina
Final" arrastra los Ingresos acumulados. Verificado exacto, digito por
digito, contra los dias con eventos reales de Soporte-Entretenimiento
(julio 2026: -5 el dia 8, -9 el dia 14).

## Formatos de CP soportados

### Soporte (default)

Una hoja por servicio nombrada igual al servicio. El sistema valida que las hojas esperadas existan.

`validarHojasCP` (`lib/parsers/parseCP.ts`) distingue dos niveles de error: que falte la
hoja de UN servicio puntual es un aviso no bloqueante (normal que un CP no
traiga todas las islas), pero si **ninguna** hoja de servicio matcheo, es
señal de que el archivo no es un CP válido para este formato — ese caso
bloquea la carga con un mensaje explícito en vez de procesar en silencio
con 0 horas requeridas y 0% de cumplimiento. Los otros 4 formatos (Ventas,
SMB, Onboarding, Personal Pay) ya tenían esta misma protección via su hoja
obligatoria (`TOTAL HS`, `Resumen`, `KON`, etc.).

### KON (Personal Pay)

Hoja unica llamada `KON` con todas las islas del servicio como secciones consecutivas.
El parser detecta cada seccion buscando encabezados que no sean `Requeridas`/`RQ` y localiza la fila resumen 48 filas mas abajo.

### Formato Onboarding (ONB)

Estructura propia con hojas separadas por isla.

### Formato SMB

Estructura propia para las islas SMB.

## CPs guardados

Igual que Francos reales y Reductores: en vez de subir el archivo de CP
(Requerido del cliente) cada vez que se quiere planificar un servicio, se
puede guardar por mes/año/formato una sola vez y despues elegirlo desde
Planificación sin volver a subir el archivo.

- Pagina `/planificacion/cp`: arrastrás uno o varios archivos de CP a la vez
  (o hacés clic para elegirlos), de formatos distintos entre si. Por default
  el formato esta en **"Detectar automáticamente"**: cada archivo prueba los
  5 formatos (Ventas → SMB → Onboarding → Personal Pay → General, en ese
  orden) y se queda con el primero que realmente encuentre servicios — no
  hace falta separar en tandas ni elegir nada de antemano (probado contra
  los 13 CP reales de un mes completo: cada archivo matcheo con exactamente
  un formato, sin ambiguedad). Si la detección se equivoca con algún archivo
  puntual, se puede forzar un formato especifico en el selector para todo
  el lote. Cada archivo tambien detecta su propio mes/año a partir de las
  fechas que trae adentro (misma fecha que usa el resto de la app para
  matchear Francos/Reductores por mes) — no hace falta re-seleccionar
  mes/año entre archivo y archivo, así que se puede soltar de una vez el CP
  de varios meses juntos. El selector de Mes/Año de la pantalla solo se usa
  como *fallback* si algún archivo no trae fechas reconocibles.
  Usa el mismo parser y la misma validación que ya usa la carga normal para
  ese formato (`parseCP`/`parseCPVentas`/`parseCPSmb`/`parseCPOnb`/
  `parseCPPpay`), así que un CP inválido para ese formato se rechaza igual
  que en la carga directa — el resultado por archivo (ok/error, con mensaje)
  se muestra debajo del dropzone al terminar el lote. Cada servicio
  encontrado se guarda con su `MatrizServicio` completa serializada a JSON
  (mismo formato que `lib/domain/serializacion.ts` usa para Planificaciones
  guardadas), más `dias_del_mes` y `total_mes` para no tener que
  deserializar solo para mostrar el listado.
  **"General"** no es solo "Soporte": cubre todas las islas que comparten el
  mismo parser de una-hoja-por-servicio (Soporte Técnico, Retención, Móvil,
  Hogares Convergentes/No Convergentes) validadas contra la unión de esos
  universos a la vez (`SERVICIOS_GENERICO` en la página) — a diferencia del
  flujo principal, esta pantalla no tiene un "servicio activo" del que
  heredar `getServiciosActivos()`, así que valida contra todo junto en vez
  de contra un estado global que puede haber quedado en cualquier cosa.
  BO GC, TECH, Integral Móvil y Migración Cobre quedan afuera a propósito:
  sus `ServiceDefinition` usan alias de hoja placeholder pensados para
  cuando ya se sabe de antemano cuál es el único servicio activo, y
  mezclarlos en un universo genérico causaría matcheos ambiguos.
- En la pantalla principal de Planificación (`app/planificacion/page.tsx`),
  la Card 1 ("Requerido del cliente") tiene un toggle **Subir archivo /
  CP guardado** — coexisten los dos modos, no se reemplaza uno por el otro.
  En modo "CP guardado" el listado se filtra en dos niveles: primero por
  formato activo (el mismo que decide que parser usar hoy: General/Ventas/
  SMB/Onboarding/Personal Pay), y despues por si el CP realmente CONTIENE
  el servicio activo (comparando `servicios[].servicio_norm` contra el
  universo de `ServiceDefinition` de ese servicio). Sin este segundo filtro,
  el universo "General" agrupa Soporte/Retencion/Movil/Hogares Convergentes/
  Hogares No Convergentes — CPs de islas totalmente distintas que comparten
  formato — y el picker los listaba mezclados e indistinguibles ("Agosto
  2026 · N servicios" x5), obligando a abrir uno por uno para encontrar el
  correcto. El endpoint `GET /cp-importaciones` devuelve ahora, ademas de
  `_count.servicios`, un `servicios[]` liviano (`servicio`/`servicio_norm`
  nomas, sin la `matriz` pesada) para poder filtrar y mostrar el nombre del
  servicio en cada item de la lista sin traer las matrices completas de
  todos los CPs solo para listarlos. Al elegir uno, se reconstruye el `Map`
  de matrices con `deserializarMatrices` y se salta el parseo del archivo —
  el resto del flujo (`handleProcesar`) es identico a partir de ahi. Cuando
  hay mas de un mes disponible para el servicio activo, aparece ademas un
  selector de Mes/Año (derivado de los periodos que realmente existen entre
  los CPs ya filtrados por formato+servicio — no un combo generico de los
  12 meses) para no tener que scrollear la lista buscando el periodo a ojo.
- Backend: modelo `CpImportacion`/`CpServicio` (Prisma) y CRUD en
  `backend/src/controllers/cp.ts` (`GET/POST /cp-importaciones`,
  `GET /cp-importaciones/:id`, `DELETE /cp-importaciones/:id`), mismo patron
  que `francos.ts`/`reductores.ts` (transaccion crear importacion + servicios,
  audit log). Subir un CP para un mes/año/formato que ya tenia uno cargado
  crea una versión nueva, no pisa la anterior — hay que borrar la vieja a mano
  si no se necesita mas.

## Matrices CP y horas requeridas

Cada matriz CP trae la necesidad por dia y franja. El sistema consolida esas franjas a horas requeridas mensuales por servicio:

```text
Hs requeridas servicio = total mensual de la matriz CP del servicio
```

En curvas por dia:

```text
Hs requeridas dia = total diario de la matriz CP
```

Si al archivo CP le falta la hoja de alguna isla del servicio agrupado, esa
isla no bloquea la carga ni el procesamiento: queda con 0 hs requeridas y se
avisa por toast ("Sin requerido este mes para: ..."). El resto de errores
del CP (formato invalido, hoja sin franjas horarias validas) si siguen
bloqueando.

## Cumplimiento

El cumplimiento compara horas netas contra horas requeridas:

```text
Cumplimiento % = (Hs netas / Hs requeridas) * 100
```

Si `Hs requeridas = 0`, el cumplimiento devuelve `0` para evitar divisiones invalidas.

Cumplimiento total:

```text
Cumplimiento total % = (sumatoria Hs netas / sumatoria Hs requeridas) * 100
```

### Niveles de cumplimiento

| Nivel  | Rango         |
|--------|---------------|
| Critico | < 95%        |
| Bajo   | 95% – 99%    |
| Ideal  | 100% – 103%  |
| Alto   | 104% – 115%  |
| Exceso | > 115%       |

## Objetivo 103%

La planificacion usa 103% como objetivo operativo.

```text
Hs netas objetivo 103 = Hs requeridas * 1.03
Hs brutas necesarias  = Hs netas objetivo 103 / factor productivo
Hs brutas actuales    = HC activos * hs semanal promedio * (dias del mes / 7)
Delta hs brutas       = Hs brutas necesarias - Hs brutas actuales
Hs por agente promedio = hs semanal promedio * (dias del mes / 7)
Delta HC 103          = Delta hs brutas / Hs por agente promedio
```

Interpretacion:

- `Delta HC 103 > 0`: faltan agentes para llegar al 103%.
- `Delta HC 103 < 0`: sobran agentes respecto del 103%.
- `Delta HC 103 = 0`: esta justo en el objetivo.

## Agentes equivalentes

Cuando falta dotacion, el sistema estima cuantos agentes equivalentes hacen falta con contratos de 30, 35 y 36 hs.

```text
Hs gap = Delta HC 103 * (hs semanal promedio * dias del mes / 7)
Agentes equivalentes contrato X = Hs gap / (X * dias del mes / 7 * factor productivo)
```

El valor `mix` mantiene el delta con el contrato promedio real del servicio.

## Tope facturable y recorte

El tope de facturacion se calcula sobre las horas requeridas:

```text
Tope = Hs requeridas * (tope facturacion / 100)
Teorico a facturar = min(Hs netas, Tope)
Hs facturable 100  = min(Hs netas, Hs requeridas)
Recorte            = max(0, Hs netas - Tope)
Faltante           = max(0, Hs requeridas - Hs netas)
```

Por defecto el tope suele analizarse al 103%, pero puede ajustarse desde la UI.

## Contratos y francos

La pagina `/planificacion/contratos` permite configurar contratos y reglas de franco por servicio o como default global.

Cada contrato define:

- Horas semanales.
- Distribucion de jornada, cuando no se reparte de forma uniforme.
- Cantidad de francos semanales.
- Dias posibles donde puede caer cada franco.

Los servicios con configuracion personalizada muestran un punto naranja en el selector de servicio.
Si no hay configuracion personalizada para un servicio, aplican los valores default globales.

Contratos rapidos disponibles: 30, 35, 36 y 40 hs.

### Contratos decimales y 32 1/2

El parser de nomina soporta contratos enteros y decimales. Estos formatos se interpretan como `32.5`:

```text
32.5
32,5
32 1/2
32½
32 horas y media
```

Para un contrato especial, como Ventas con `32.5 hs`, se puede configurar una distribucion de jornada:

```text
Contrato 32.5 hs
Tipo de distribucion: Base + extra diario
Horas base por dia: 6
Extra por dia: 0.5
Dias laborables: lunes a viernes
Dias con extra: lunes a viernes
```

La hora disponible del agente para un dia se calcula asi:

```text
Si el dia no esta en dias laborables:
Hs dia agente = 0

Si el dia esta en dias laborables:
Hs dia agente = hs base dia + extra dia si el dia esta en dias con extra
```

Ejemplo para `32.5 hs`:

```text
Lunes a viernes = 6 + 0.5 = 6.5 hs por dia
Sabado y domingo = 0 hs por dia
Total semanal = 6.5 * 5 = 32.5 hs
```

Si la distribucion queda en `Uniforme`, se mantiene el calculo historico:

```text
Hs base dia agente = hs mensuales brutas agente / dias del mes
```

La probabilidad esperada de franco por dia se calcula asi:

```text
Probabilidad franco dia = suma de 1 / cantidad de dias de cada ventana que contiene ese dia
```

En la vista de francos:

```text
Ausentes esperados dia = suma(cantidad agentes contrato * probabilidad franco dia)
HC disponible dia      = HC activos - ausentes esperados dia
```

El CP por dia de semana se promedia desde la matriz:

```text
HC requerido lunes = promedio de requerimiento de todos los lunes del mes
```

Estado por dia:

```text
ratio = HC disponible / HC requerido

ratio >= 1.03 -> surplus
ratio >= 1.00 -> ok
ratio >= 0.95 -> justo
ratio <  0.95 -> deficit
```

### Dimensionamiento con franco

Para estimar plantilla necesaria considerando un peor dia de franco:

```text
fraccion ausente = ausentes esperados / HC activos
fraccion disponible = 1 - fraccion ausente
HC necesario total = HC requerido / fraccion disponible
```

En resumen tambien se muestra un ajuste simplificado:

```text
factor disponible = 1 - fraccion afectada / dias ventana
HC necesario bruto = HC activos + Delta HC 103
HC con franco = HC necesario bruto / factor disponible
Extra por franco = HC con franco - HC necesario bruto
```

## Curvas

Las curvas comparan horas requeridas y disponibles dia a dia.

Requeridas:

```text
Requeridas dia = total diario de la matriz CP
```

Disponibles:

```text
Si el contrato tiene distribucion uniforme:
Hs dia agente = hs mensuales brutas agente / dias del mes

Si el contrato tiene distribucion Base + extra diario:
Hs dia agente = horas configuradas para ese dia de semana

Disponibles dia = suma(Hs dia agente * factor productivo * (1 - probabilidad franco dia))
```

Esto hace que las horas disponibles cambien por dia cuando los contratos/francos no caen igual todos los dias.

## Simulador

El simulador aplica cambios sobre el resultado base sin alterar la carga original.

### Agregar agentes

```text
Delta HC = +cantidad
Delta hs brutas = cantidad * hs semanal * (dias efectivos / 7)
```

### Quitar agentes

Usa el promedio actual del servicio:

```text
Hs por agente = (Hs brutas servicio / HC activos) * (dias efectivos / dias del mes)
Delta HC = -cantidad
Delta hs brutas = -cantidad * Hs por agente
```

### Reasignar agentes por cantidad

Mueve agentes promedio desde origen hacia destino:

```text
Hs por agente origen = (Hs brutas origen / HC activos origen) * (dias efectivos / dias del mes)
Origen:  Delta HC = -cantidad; Delta hs = -cantidad * Hs por agente origen
Destino: Delta HC = +cantidad; Delta hs = +cantidad * Hs por agente origen
```

### Mover agente nominal

Permite mover una persona concreta por nombre/DNI/usuario. En este caso no se usa promedio, se usan las horas reales del agente:

```text
Hs prorrateadas agente = hs mensuales brutas agente * (dias efectivos / dias del mes)
Origen:  Delta HC = -1; Delta hs = -Hs prorrateadas agente
Destino: Delta HC = +1; Delta hs = +Hs prorrateadas agente
```

Despues del movimiento, esas horas quedan dentro del servicio destino y se recalculan con los reductores del destino.

### Cambiar contrato

```text
Hs semanal base = (Hs brutas servicio / HC activos) / (dias del mes / 7)
Delta hs = cantidad * (hs semanal nueva - hs semanal base) * (dias efectivos / 7)
```

### Vigencia parcial

Si se define un periodo desde/hasta, todos los cambios se prorratean:

```text
dias efectivos = dias del periodo que intersectan con el mes cargado
```

## Simulador dia a dia

Pagina separada (`/planificacion/simulador-dia-a-dia`), distinta del
Simulador de arriba — ese usa un prorrateo lineal por cantidad de dias
(exacto para el modelo plano, pero una aproximacion para servicios con
Francos reales); este re-corre el motor dia a dia real
(`simularDiaADiaServicio`, `lib/domain/calculos.ts`) para simular el
impacto exacto de un movimiento en una fecha puntual, replicando la columna
"Ingresos" del archivo de referencia del cliente.

- Solo lista servicios con Francos reales cargados (donde el motor dia a
  dia esta activo); para el resto, el prorrateo lineal del simulador
  clasico ya es exacto.
- Alta de eventos con calendario (`store/useSimuladorDiaADia.ts`): Alta,
  Baja o Cambio de servicio, con dia del mes, cantidad y (para cambio de
  servicio) servicio destino. Un cambio de servicio resta en el origen y
  suma en el destino el mismo dia (`eventosADeltasPorDia`).
- Tabla dia a dia completa (dia, dia semana, nomina base, nomina activa,
  francos, ausentes, presentes, HS logueo) comparando la corrida base
  contra la corrida con los eventos cargados, con el dia donde impacta cada
  evento resaltado.
- Panel "Fuente de datos": permite cargar cualquier planificacion guardada
  directamente desde esta pantalla (sin pasar por `/planificacion/guardadas`)
  para simular sobre datos ya guardados, ademas de los que se acaban de
  procesar en la sesion activa.

## Exportacion Excel

El exportable `planificador_<mes>.xlsx` genera 5 hojas:

| Hoja | Contenido |
|------|-----------|
| Estado Actual | Dotacion, reductores operativos (Deslogueo / Ausentismo / Rotacion) y cumplimiento por servicio |
| Simulado | Comparacion base vs. escenario simulado. Muestra "Sin cambios" si los valores son identicos |
| Brechas | Servicios en deficit y analisis de impacto en facturacion |
| Resumen | Resumen ejecutivo por servicio con delta en pp |
| Reductores | Deslogueo, Ausentismo, Rotacion, Hs Brutas, Hs Netas e Hs Impactadas por servicio |

## Dashboard y filtros

Los filtros recalculan el resultado mostrado con la nomina filtrada:

- Isla/servicio
- Sitio
- Modalidad
- Jefe
- Contrato
- Estado

Al filtrar, se recalculan HC, horas brutas, horas netas, cumplimiento y deltas sobre el subconjunto visible.

## Archivos importantes

```text
app/planificacion/page.tsx              Carga de archivos, seleccion de servicio y proceso principal
app/planificacion/resumen/page.tsx      Resumen, filtros y guardar planificacion
app/planificacion/guardadas/page.tsx    Listado de planificaciones guardadas
app/planificacion/guardadas/[id]/page.tsx Ficha de una planificacion guardada + cargar en sesion
app/planificacion/curvas/page.tsx       Curvas por servicio
app/planificacion/franco/page.tsx       Planificacion de francos (modelo probabilistico)
app/planificacion/francos/page.tsx      Importador de francos reales y contratos (motor dia a dia)
app/planificacion/cp/page.tsx           Biblioteca de CPs guardados por mes/año/formato
app/planificacion/nomina-general/page.tsx Precarga de Nomina General (todas las islas, una sola carga)
app/planificacion/contratos/page.tsx    Configuracion de contratos y francos por servicio
app/planificacion/simulador/page.tsx    Simulador de dotacion
app/planificacion/simulador-dia-a-dia/page.tsx Simulador dia a dia (eventos fechados sobre el motor real)
app/ppay/page.tsx                       Flujo especifico para Personal Pay (formato KON)
components/config/FrancoRulesEditor.tsx Editor de reglas de contratos y francos
components/tables/SimuladorTable.tsx    UI del constructor de escenarios
components/charts/CumplimientoBarChart.tsx Grafico de cumplimiento con leyenda de niveles
lib/domain/calculos.ts                  Matematica principal
lib/domain/francoEngine.ts              Calculo de francos (modelo probabilistico)
lib/domain/hsLogueoDiaADia.ts           Motor de HS Netas dia a dia (con Francos reales cargados), feriados y eventosPorDia
lib/config/feriadosArgentina.ts         Calendario de feriados nacionales de Argentina (fallback cuando el CP no marca el feriado)
store/useSimuladorDiaADia.ts            Eventos de dotacion fechados (altas/bajas/cambios de servicio) para el Simulador dia a dia
lib/parsers/parseFrancos.ts             Parser de Francos: formato agregado o roster por agente (autodetectado)
lib/domain/agentesHipoteticos.ts        Expande filas de agentes hipoteticos a Agente[]
lib/domain/serializacion.ts             Serializa/deserializa el Map de matrices CP para guardar como JSON
lib/config/servicesMovil.ts             Definicion de servicio Movil (segmentos estimados)
lib/config/servicesHogarConvergente.ts  Definicion de servicio Hogares Convergentes (segmentos estimados)
lib/config/servicesHogarNoConvergente.ts Definicion de servicio Hogares No Convergentes (segmentos estimados)
lib/parsers/calcularReductores.ts       Calculadora de reductores (ponderacion 80/90/100) + buildWorkbook/reductoresAFile
lib/parsers/parseCP.ts                  Parser formato Soporte (+ KON)
lib/parsers/parseCPPpay.ts              Parser formato Personal Pay
lib/parsers/parseCPSmb.ts               Parser formato SMB
lib/parsers/parseCPOnb.ts               Parser formato Onboarding
lib/utils/exportSimulador.ts            Exportacion Excel (5 hojas)
backend/src/controllers/reductores.ts   CRUD de reductores guardados (ReductorImportacion/ReductorServicio)
backend/src/controllers/planificacionesGuardadas.ts CRUD de planificaciones guardadas (PlanificacionGuardada)
backend/src/controllers/francos.ts      CRUD de francos reales cargados (FrancoImportacion/FrancoServicio)
backend/src/controllers/cp.ts           CRUD de CPs guardados (CpImportacion/CpServicio)
CALCULO_REDUCTORES.md                   Nota corta del calculo de reductores
```

## Comandos utiles

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```
