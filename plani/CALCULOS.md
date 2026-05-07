# Lógica de cálculos — Planificación Konecta

## Glosario

| Término | Significado |
|---|---|
| **HC** | Headcount (cantidad de personas) |
| **Hs Brutas** | Horas contractuales del agente en el mes, sin restar ausentismos |
| **Hs Netas** | Horas realmente disponibles luego de aplicar el factor productivo |
| **Hs Requeridas** | Horas de cobertura que pide el cliente (100% del CP) |
| **Factor Productivo** | Qué fracción de las hs brutas se convierten en hs efectivas |
| **CP** | Capacity Plan — el archivo Excel con el HC requerido por franja horaria |
| **LP** | Licencia/Permiso — agente no disponible |

---

## 1. Horas brutas mensuales por agente

```
Hs Brutas = HsSemanal × (DíasDeMes / 7)
```

Ejemplo: agente de 36 hs/semana en un mes de 30 días  
→ `36 × (30 / 7) = 154.3 hs`

---

## 2. Factor Productivo

Captura las pérdidas operativas: deslogueo (pausas no autorizadas), ausentismo y rotación de personal.

### Modo Multiplicativo (por defecto)

```
Factor = (1 − Deslogueo) × (1 − Ausentismo) × (1 − Rotación)
```

Ejemplo: 5% deslogueo, 10% ausentismo, 2% rotación  
→ `0.95 × 0.90 × 0.98 = 0.837` (solo el 83.7% de las hs brutas son productivas)

### Modo Aditivo (alternativo)

```
Factor = max(0,  1 − (Deslogueo + Ausentismo + Rotación))
```

Mismo ejemplo: `1 − (0.05 + 0.10 + 0.02) = 0.83`

---

## 3. Horas Netas

```
Hs Netas = Hs Brutas Totales del servicio × Factor Productivo
```

Las "Hs Brutas Totales del servicio" son la suma de las hs brutas de todos los agentes ACTIVOS de ese segmento.

---

## 4. Horas Requeridas (100%)

Provienen del CP (Capacity Plan). El archivo Excel define cuántos HC se necesitan en cada franja de 30 minutos de cada día del mes. El sistema convierte ese HC×franja a horas:

```
Hs Requeridas = Σ (HC requerido en franja × 0.5 hs) para todo el mes
```

Este número representa lo que el **cliente pide al 100%**.

---

## 5. Cumplimiento

```
Cumplimiento = (Hs Netas / Hs Requeridas) × 100
```

Niveles de color:

| Rango | Nivel | Color |
|---|---|---|
| < 95% | Crítico | Rojo |
| 95–99% | Bajo | Ámbar |
| 100–103% | Ideal | Verde |
| 103–115% | Alto | Azul |
| > 115% | Exceso | Violeta |

---

## 6. Desvíos al 103%

El cliente pide al 100%, pero el contrato nos permite facturar hasta el **103%**. Este es el margen operativo que tenemos.

La columna "Desvíos al 103%" indica cuántos agentes equivalentes (en HC) faltan o sobran para cubrir exactamente el 103% de lo requerido.

### Cálculo paso a paso

```
1. Hs Netas objetivo  = Hs Requeridas × 1.03
2. Hs Brutas necesarias = Hs Netas objetivo / Factor Productivo
3. Hs Brutas actuales   = HC Activos × Hs Semanal Promedio × (Días / 7)
4. Diferencia (Hs)      = Hs Brutas necesarias − Hs Brutas actuales
5. Hs por agente        = Hs Semanal Promedio × (Días / 7)
6. Desvío (HC)          = Diferencia / Hs por agente
```

### Interpretación del signo

| Valor | Significado |
|---|---|
| **Negativo** (ej. −5.3 A) | Faltan agentes para alcanzar el 103% |
| **Positivo** (ej. +2.1 A) | Hay excedente respecto al 103% |

Ejemplo:
- Hs Requeridas = 1000 hs → objetivo 103% = 1030 hs netas
- Factor productivo = 0.90 → se necesitan `1030 / 0.90 = 1144 hs brutas`
- Tenemos 15 agentes de 36 hs en 30 días → `15 × 36 × (30/7) = 2314 hs brutas`
- Diferencia = `1144 − 2314 = −1170 hs` → excedente → desvío positivo

---

## 7. Columnas de Facturación

### Hs Fact. 100%

Lo máximo que podemos facturar si el tope fuera el 100% del pedido:

```
Hs Fact. 100% = min(Hs Netas, Hs Requeridas)
```

Si nuestras hs netas son menores a lo requerido, facturamos lo que tenemos.  
Si superamos el 100%, solo facturamos hasta el tope del cliente.

### Hs Fact. 103%

Lo máximo que podemos facturar con el margen del 103%:

```
Hs Fact. 103% = min(Hs Netas, Hs Requeridas × 1.03)
```

Esta es la cifra real de facturación: si producimos más del 103%, el exceso queda como "Recorte" y no se factura.

### Diferencia entre ambas

`Hs Fact. 103% − Hs Fact. 100%` muestra cuántas horas adicionales podemos facturar gracias al margen del 3% que permite el contrato.

### Recorte

```
Recorte = max(0, Hs Netas − Hs Requeridas × 1.03)
```

Horas que producimos pero que NO podemos facturar porque superan el 103%.

---

## 8. Agentes Equivalentes (para cerrar el gap)

Cuando hay desvío negativo (faltan personas), el sistema calcula cuántos agentes de cada tipo de contrato se necesitarían para cerrar exactamente ese gap:

```
Hs del gap = |Desvío en HC| × Hs Semanal Promedio × (Días / 7)

Para contratos de N hs:
  Agentes necesarios = Hs del gap / (N × (Días / 7) × Factor Productivo)
```

---

## 9. Coverage por franja horaria

Independientemente del cálculo mensual de horas, el sistema también evalúa si hay suficiente gente en cada franja de 30 minutos de cada día:

- Si el agente tiene horario registrado: se asigna disponibilidad 1 en las franjas de su turno, 0 fuera
- Si no tiene horario: se distribuye su carga de forma plana a lo largo del día
- Se compara la disponibilidad acumulada vs. el HC requerido en el CP

| Resultado | Umbral |
|---|---|
| **Surplus** | Disponible ≥ 105% del requerido |
| **OK** | Disponible entre 90% y 105% |
| **Déficit** | Disponible < 90% del requerido |

Una franja se marca como **crítica** si está en déficit en al menos el 50% de los días del mes.

---

## Ejercicio completo — Servicio "Conectividad", Mayo (31 días)

### Datos de entrada

**Nómina:**
| Agente | Contrato | Estado |
|---|---|---|
| Agente 1 | 36 hs/sem | ACTIVO |
| Agente 2 | 36 hs/sem | ACTIVO |
| Agente 3 | 35 hs/sem | ACTIVO |
| Agente 4 | 30 hs/sem | ACTIVO |
| Agente 5 | 36 hs/sem | LP |

**Reductores:**
- Deslogueo: 5%
- Ausentismo: 8%
- Rotación: 2%

**CP (extracto del Excel, formato HC):**

El CP define por ejemplo 4 HC en la franja 09:00–09:30 todos los días hábiles y 2 HC en franjas nocturnas. El total del mes suma **1.200 celdas × HC promedio × 0.5** = **1.400 hs requeridas**.

---

### Paso 1 — Horas Brutas por agente

```
Días del mes = 31

Agente 1 (36 hs): 36 × (31 / 7) = 36 × 4.429 = 159.4 hs
Agente 2 (36 hs): 159.4 hs
Agente 3 (35 hs): 35 × 4.429 = 155.0 hs
Agente 4 (30 hs): 30 × 4.429 = 132.9 hs
Agente 5 (36 hs): LP → no cuenta
```

**Total Hs Brutas del servicio** (solo ACTIVOS):
```
159.4 + 159.4 + 155.0 + 132.9 = 606.7 hs brutas
```

**Hs Semanal Promedio** de los activos:
```
(36 + 36 + 35 + 30) / 4 = 34.25 hs/sem
```

---

### Paso 2 — Factor Productivo (modo multiplicativo)

```
Factor = (1 − 0.05) × (1 − 0.08) × (1 − 0.02)
       = 0.95 × 0.92 × 0.98
       = 0.857
```

El 85.7% de las horas brutas se convierten en horas productivas.

---

### Paso 3 — Horas Netas

```
Hs Netas = 606.7 × 0.857 = 519.9 hs
```

---

### Paso 4 — Horas Requeridas (desde el CP)

El CP tiene celdas en formato HC. Por ejemplo, si en toda la grilla mensual la suma de HC es 2.800 celdas con un HC promedio de 1 cada una:

```
Hs Requeridas = 2.800 celdas × 0.5 hs = 1.400 hs
```

> En este ejemplo usamos **Hs Requeridas = 1.400 hs**.

---

### Paso 5 — Cumplimiento

```
Cumplimiento = (519.9 / 1.400) × 100 = 37.1%   → CRÍTICO (rojo)
```

Con solo 4 agentes activos para un servicio que necesita 1.400 hs, el cumplimiento es muy bajo. Hace falta mucha más gente.

---

### Paso 6 — Desvíos al 103%

```
1. Objetivo neto al 103%   = 1.400 × 1.03 = 1.442 hs netas
2. Hs brutas necesarias    = 1.442 / 0.857 = 1.683 hs brutas
3. Hs brutas actuales      = 4 agentes × 34.25 hs/sem × (31 / 7)
                           = 4 × 34.25 × 4.429
                           = 606.9 hs brutas
4. Diferencia              = 1.683 − 606.9 = +1.076.1 hs (faltan)
5. Hs por agente           = 34.25 × (31 / 7) = 151.7 hs
6. Desvío                  = 1.076.1 / 151.7 = 7.1 HC
```

**Resultado en tabla: −7.1 A** (negativo = faltan 7.1 agentes equivalentes para alcanzar el 103%)

---

### Paso 7 — Facturación

```
Hs Req. 100%  = 1.400 hs   (lo que pide el cliente)
Hs Req. 103%  = 1.442 hs   (nuestro techo contractual)

Hs Fact. 100% = min(519.9, 1.400) = 519.9 hs  (producimos menos que lo pedido)
Hs Fact. 103% = min(519.9, 1.442) = 519.9 hs  (ídem, no llegamos al tope)

Recorte       = max(0, 519.9 − 1.442) = 0 hs  (no hay excedente que recortar)
```

> En este caso ambas columnas de facturación son iguales porque estamos muy por debajo del 100%. El recorte solo aparece cuando la producción **supera** el 103%.

---

### Paso 8 — Agentes Equivalentes para cerrar el gap

Con desvío de 7.1 HC, ¿cuántos agentes de cada contrato hacen falta?

```
Hs del gap = 7.1 × 151.7 = 1.077 hs

Para contratos 36 hs:
  Hs por agente = 36 × (31/7) × 0.857 = 136.9 hs netas
  Agentes necesarios = 1.077 / 136.9 = 7.9 → 8 personas

Para contratos 35 hs:
  Hs por agente = 35 × (31/7) × 0.857 = 133.1 hs netas
  Agentes necesarios = 1.077 / 133.1 = 8.1 → 9 personas

Para contratos 30 hs:
  Hs por agente = 30 × (31/7) × 0.857 = 114.1 hs netas
  Agentes necesarios = 1.077 / 114.1 = 9.4 → 10 personas
```

**Conclusión:** para cerrar el gap y llegar al 103% hacen falta ~8 agentes de 36 hs, o ~9 de 35 hs, o ~10 de 30 hs (o alguna combinación del mix actual).

---

### Resumen del ejercicio

| Métrica | Valor |
|---|---|
| HC Activos | 4 |
| HC en LP | 1 |
| Hs Semanal Promedio | 34.25 hs |
| Hs Brutas | 606.7 hs |
| Factor Productivo | 85.7% |
| Hs Netas | 519.9 hs |
| Hs Req. 100% | 1.400 hs |
| Hs Req. 103% | 1.442 hs |
| Cumplimiento | 37.1% 🔴 |
| Desvíos al 103% | −7.1 A |
| Hs Fact. 100% | 519.9 hs |
| Hs Fact. 103% | 519.9 hs |
| Recorte | 0 hs |
