# Calculo de reductores

La calculadora de Plani arma el archivo `reductores-calculados.xlsx` a partir de tres fuentes:

- `DESLOGUEO Real.xlsx`: toma la columna `% DO`.
- `AUSENTISMO Real.xlsx`: toma la columna `Indice SLP`.
- `ROTACION Real (Portal de Datos).xlsx`: toma la columna `% Rotacion`.

Para cada indicador usa los ultimos tres meses cerrados disponibles en las hojas mensuales y calcula un promedio ponderado:

```text
(mes 1 * 80 + mes 2 * 90 + mes 3 * 100) / 270
```

Ejemplo: para proyectar mayo, usa febrero, marzo y abril.

## Deslogueo

Busca el servicio en cada hoja mensual y toma `% DO`. Acepta columnas `Servicio` y `Servico`. Si para un mismo servicio/mes aparecen varias filas, promedia esas filas antes de aplicar la ponderacion mensual.

## Ausentismo

Busca el servicio en cada hoja mensual y toma `Indice SLP`, es decir ausentismo sin LP. Si para un mismo servicio/mes aparecen varias filas, promedia esas filas antes de aplicar la ponderacion mensual.

## Rotacion

El archivo de rotacion viene por `Subarea`, no siempre por isla. Por eso la calculadora toma `% Rotacion` por subarea y lo expande a los servicios de Plani.

Ejemplo:

```text
SOPORTE TECNICO -> SOPORTE-CBS, SOPORTE-CONECTIVIDAD,
                  SOPORTE-ENTRETENIMIENTO, SOPORTE-MOVIL, SOPORTE-RRSS
```

Otros mapeos usados:

```text
MOVIL -> servicios que contengan MOVIL o INDIVIDUOS
HOGAR -> HOGAR, COMBO, CONVERGENTE, FACTURA, ONBOARDING, WHATSAPP
CORPORATIVO B2B -> CORPORATIVO, B2B, BO GC
EXPERIENCIA Y ENTRENAMIENTO -> ENTRENAMIENTO, FORMADOR, CAPA
SMB -> SMB
RETENCION -> RETENCION
```

La calculadora tambien mantiene compatibilidad con archivos historicos que traigan una hoja de reductores proyectados o una tabla simple por servicio.

## Resultado final

La calculadora genera una hoja llamada `RESUMEN PONDERADO` con estas columnas:

```text
Servicio | Deslogueo | Ausentismo | Rotacion
```

Ese formato es el que usa Plani para calcular el factor productivo y el cumplimiento estimado.
