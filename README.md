# Nomina / Plani

Sistema para cargar nomina, matrices CP, reductores y simular la planificacion de dotacion por servicio/isla.

## Stack

- Next.js + React + TypeScript
- Zustand para estado local
- TailwindCSS para UI
- `xlsx` para lectura de Excel
- `exceljs` para exportaciones

## Instalacion rapida

```bash
npm install
npm run dev
```

El servidor de desarrollo corre con Next.js. Si el puerto por defecto esta ocupado, Next propone otro puerto.

## Flujo de Plani

1. Cargar nomina.
2. Cargar matrices CP por servicio.
3. Cargar reductores o usar la calculadora.
4. Revisar resumen, curvas, francos y simulador.
5. Exportar escenarios cuando haga falta.

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

## Reductores

Los reductores representan perdida esperada de productividad:

- Deslogueo
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

## Matrices CP y horas requeridas

Cada matriz CP trae la necesidad por dia y franja. El sistema consolida esas franjas a horas requeridas mensuales por servicio:

```text
Hs requeridas servicio = total mensual de la matriz CP del servicio
```

En curvas por dia:

```text
Hs requeridas dia = total diario de la matriz CP
```

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

Cada contrato define:

- Horas semanales.
- Distribucion de jornada, cuando no se reparte de forma uniforme.
- Cantidad de francos semanales.
- Dias posibles donde puede caer cada franco.

Ejemplo de regla:

```text
Contrato 24 hs:
Franco 1: lunes a viernes
Franco 2: sabado a domingo
```

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

Ejemplo:

```text
Si un franco puede caer entre lunes y viernes:
probabilidad por cada dia = 1 / 5 = 20%
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
app/planificacion/page.tsx              Carga de archivos y calculadora de reductores
app/planificacion/resumen/page.tsx      Resumen y filtros
app/planificacion/curvas/page.tsx       Curvas por servicio
app/planificacion/franco/page.tsx       Planificacion de francos
app/planificacion/simulador/page.tsx    Simulador de dotacion
components/tables/SimuladorTable.tsx    UI del constructor de escenarios
lib/domain/calculos.ts                  Matematica principal
lib/domain/francoEngine.ts              Calculo de francos
lib/parsers/calcularReductores.ts       Calculadora de reductores
CALCULO_REDUCTORES.md                   Nota corta del calculo de reductores
```

## Comandos utiles

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

## Validaciones

Ultimas validaciones usadas durante desarrollo:

```bash
npm run lint
npx tsc --noEmit
```
