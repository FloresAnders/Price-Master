# Plan de implementación — Festividades y efectos visuales de TimeMaster

**Estado:** implementado localmente; despliegue y activación global pendientes.
**Proyecto:** TimeMaster (Next.js, React, Firebase).
**Zona horaria de referencia:** `America/Costa_Rica`.
**Exclusión obligatoria:** el **15 de septiembre** ya tiene una implementación. **No modificar sus componentes, estilos, animaciones, assets, lógica de activación ni configuración existente.**

## 1. Objetivo

Incorporar decoraciones alusivas y microefectos animados para cada fecha del calendario, manteniendo la identidad minimalista de TimeMaster, sin interferir con los módulos operativos (horarios, fondo general, caja, proveedores, saldos, facturas y control horario).

Los efectos deben ser discretos, responsivos, accesibles, fáciles de desactivar y eficientes en dispositivos de gama baja. Se ejecutarán únicamente en las fechas configuradas, con una **vista previa exclusiva para superadmin**.

## 2. Calendario y propuesta visual

| Fecha | Identificador | Decoración y paleta | Efecto ligero sugerido |
|---|---|---|---|
| 1 de enero — Año Nuevo | `new-year` | Confeti estilizado en dorado, blanco y azul noche; tarjeta «¡Feliz Año Nuevo!» | Pequeña caída de confeti durante 3–5 segundos al entrar, una sola vez por sesión |
| Jueves Santo | `holy-thursday` | Motivos sobrios de ramas de olivo/palma, beige y verde oliva | Suave aparición gradual de hojas en los bordes; sin lluvia continua |
| Viernes Santo | `good-friday` | Composición respetuosa y discreta con siluetas de palma, crema y morado tenue | Transición lenta de iluminación en el encabezado; sin elementos festivos invasivos |
| 11 de abril — Juan Santamaría | `juan-santamaria` | Colores patrios, escarapela y silueta ilustrativa histórica (asset validado) | Cinta tricolor que aparece suavemente en la parte superior |
| 1 de mayo — Día del Trabajador | `workers-day` | Iconografía de herramientas y engranajes lineales, azul y naranja cálido | Engranaje decorativo con giro breve al abrir la página |
| 25 de julio — Anexión del Partido de Nicoya | `nicoya` | Motivos guanacastecos, sabanero, árbol de Guanacaste y tonos tierra | Hojas o pequeñas formas folclóricas flotantes solo en bordes |
| 2 de agosto — Virgen de los Ángeles | `virgen-angeles` | Cartago, romería, flores suaves y azul mariano | Brillos tenues y espaciados alrededor de una ilustración decorativa, sin tapar datos |
| 15 de agosto — Día de la Madre | `mothers-day` | Flores estilizadas, rosa viejo, lavanda y crema | Pétalos animados brevemente en esquinas, sin cubrir formularios |
| 31 de agosto — Persona Negra y Cultura Afrocostarricense | `afro-culture` | Patrones geométricos inspirados en expresiones culturales afrocostarricenses, colores vivos y elementos del Caribe | Entrada lateral breve de patrones decorativos; diseño culturalmente respetuoso y revisado |
| 15 de septiembre — Independencia | `independence-existing` | **EXISTENTE** | **No tocar. Solo detectar y evitar superposiciones.** |
| 1 de diciembre — Abolición del Ejército | `army-abolition` | Paloma de paz, ramas, blanco y azul suave | Silueta de paloma con recorrido corto al iniciar, una vez |
| 25 de diciembre — Navidad | `christmas` | Abeto geométrico, estrellas, verde pino, rojo y dorado | Copos de nieve o luces tenues en el borde superior, con límite de partículas |
| 31 de diciembre — Fin de Año | `year-end` | Reloj abstracto, estrellas y dorado sobre azul oscuro | Destellos breves en el encabezado; sin cuenta regresiva persistente |

### Criterios culturales

- Evitar caricaturas y símbolos estereotipados, especialmente en la conmemoración afrocostarricense.
- Mantener un tono respetuoso para Jueves Santo, Viernes Santo y el 2 de agosto.
- Usar ilustraciones vectoriales propias/licenciadas, no fotografías de personas ni imágenes religiosas no autorizadas.
- **No asumir que todas las fechas anteriores son feriados de pago obligatorio**: este calendario controla decoración, no reglas laborales ni cálculos de planilla.

## 3. Política de activación

1. La configuración estándar muestra cada temática **solo durante la fecha local** (`00:00:00`–`23:59:59` de Costa Rica).
2. Jueves y Viernes Santo se calculan a partir del Domingo de Pascua para **cada año** (algoritmo gregoriano probado), sin fechas fijas ni valores quemados.
3. Los días fijos se repiten anualmente; el año de la animación de Año Nuevo/Fin de Año se deriva del reloj local.
4. Se puede definir una ventana opcional por tema (`startOffsetDays`, `endOffsetDays`), por defecto cero; **no usar anticipación sin autorización del superadmin**.
5. Si hay dos temas activos en el futuro, ordenar por `priority` y mostrar solo uno; `independence-existing` tiene prioridad y aislamiento absoluto.
6. Si la fecha o configuración falla, no mostrar el overlay. Si se oculta, el uso normal de TimeMaster continúa.
7. El cambio de fecha se recalcula a medianoche local y cuando la pestaña vuelva a estar visible, sin requerir recarga manual.

## 4. Arquitectura propuesta

**Ajustar las rutas según la estructura real del repositorio antes de crear archivos.**

```text
src/
  components/celebraciones/
    index.ts                          # API pública del módulo
    PatrioticSeptemberBadge.tsx      # Implementación existente del 15 de septiembre
    seasonalTheme.ts                 # Activación existente del tema patrio
    PLAN_EFECTOS_FESTIVIDADES_TIMEMASTER.md
    config/festivities.ts              # Catálogo tipado y metadatos visuales
    lib/costaRicaDate.ts               # Zona horaria y comparación por día
    lib/easter.ts                      # Cálculo anual de Semana Santa
    lib/resolveActiveFestivity.ts      # Selección y prioridades
    components/SeasonalEffectsHost.tsx # Capa aislada global
    components/FestivityBanner.tsx     # Mensaje opcional, no bloqueante
    components/effects/                # Efectos decorativos por festividad
    styles/seasonal-effects.module.css
    assets/                             # banderaCR.png y futuros SVG/AVIF/WebP optimizados
    __tests__/                          # Fechas, prioridades, accesibilidad
```

- Montar **un único host global** en el layout principal después de autenticación, fuera de componentes que se remontan en cada cambio de ruta.
- Resolver la festividad con una función pura (`date`, `timezone`, `config`), independiente de React.
- Renderizar por carga diferida el componente visual activo; jamás cargar animaciones de todas las festividades a la vez.
- Usar CSS Modules, variables CSS y CSS/React nativos; **no introducir Tailwind, Bootstrap ni una librería pesada de partículas**.
- Elementos decorativos: `pointer-events: none`, `aria-hidden="true"`, `position: fixed` y un `z-index` inferior a modales, menús y notificaciones.
- El banner de texto es opcional y se integra sin desplazar controles críticos. No reutilizar ni sobrescribir el sistema de anuncios/mantenimiento de TimeMaster.
- Respetar `prefers-reduced-motion: reduce`: quitar movimientos y conservar solamente una ilustración estática.
- Respetar `prefers-color-scheme` o el tema vigente de TimeMaster; verificar contraste en modo claro y oscuro.

### Contrato de datos sugerido

```ts
type FestivityId =
  | 'new-year' | 'holy-thursday' | 'good-friday' | 'juan-santamaria'
  | 'workers-day' | 'nicoya' | 'virgen-angeles' | 'mothers-day'
  | 'afro-culture' | 'army-abolition' | 'christmas' | 'year-end';

type FestivityConfig = {
  id: FestivityId;
  enabled: boolean;
  title: string;
  message?: string;
  intensity: 'off' | 'subtle' | 'normal';
  showBanner: boolean;
  priority: number;
  startOffsetDays: number;
  endOffsetDays: number;
};
```

El identificador del 15 de septiembre **no forma parte del nuevo catálogo editable**: conservar el sistema que ya existe. El resolver nuevo debe tener un guard explícito que impida cargar decoraciones nuevas ese día.

## 5. Configuración superadmin (Firebase)

Incluir una sección **«Festividades y efectos»** dentro de la pestaña de **Mantenimiento** ya prevista para superadmin (o en su ubicación existente, si ya está implementada).

- Interruptor global `enabled`.
- Lista anual con fecha, nombre, estado y miniatura representativa.
- Interruptor individual y nivel de intensidad por celebración.
- Campos de título y texto del banner; vista previa en escritorio y móvil.
- Botón «Probar ahora» que activa un tema **solo en la sesión del superadmin**, sin fingir que la fecha actual cambió para otros usuarios.
- Botón «Restablecer configuración predeterminada» con confirmación.
- Estados de carga, guardado, error y confirmación; evitar guardados automáticos en cada tecla.
- Almacenar únicamente ajustes pequeños (ejemplo: `system_config/seasonal_effects`); assets estáticos se sirven con la aplicación, no desde Firestore.
- Validar esquema y longitudes en cliente y backend/reglas; solo superadmin puede escribir. Usuarios autenticados autorizados pueden leer la configuración pública y no sensible.
- Priorizar una sola lectura inicial/caché compartida con la configuración global. **No crear un `onSnapshot` por festividad ni por módulo** para no disparar las lecturas de Firestore.
- Definir valor predeterminado local si no se puede leer Firebase y registrar errores sin bloquear el inicio.

## 6. Reglas de experiencia y rendimiento

- Animación de entrada máxima recomendada: **3–5 s**; sin loops continuos, salvo efecto muy tenue, opcional y verificado.
- Entre **8 y 16 partículas** como límite inicial en escritorio, y menos en móvil; preferir transformaciones `opacity`/`transform`.
- Mantener constante el layout (sin CLS) y no interrumpir tipeo, lectura de tablas o botones.
- No animar dentro de modales de pago, cierre de caja, lectura de QR, impresión o formularios de alto uso.
- Opción de **ocultar efectos** por usuario para la sesión o preferencia persistente, sin modificar el ajuste global.
- Cualquier imagen debe tener versión estática optimizada; evitar videos y descargas grandes.
- Verificar que en pestañas múltiples no aparezcan animaciones de entrada repetidas de manera molesta.
- Presupuesto inicial orientativo: assets del tema activo por debajo de 100 KB comprimidos y animación estable a 60 FPS en equipo promedio; medir y adaptar a móviles.

## 7. Etapas de implementación

### Fase 0 — Reconocimiento y respaldo

- [x] Identificar layout raíz, estilos globales, proveedor de sesión, temas y permisos de superadmin.
- [x] Localizar implementación del **15 de septiembre**, anotar puntos de montaje y probar que permanece intacta.
- [x] Verificar si la pestaña Mantenimiento y `system_config` ya existen para reutilizarlas.
- [ ] Tomar capturas de referencia de escritorio/móvil y establecer una línea base de rendimiento.

### Fase 1 — Motor de calendario

- [x] Crear catálogo, tipos, validador y resolver de fecha.
- [x] Implementar cómputo anual de Jueves/Viernes Santo.
- [x] Añadir guard de exclusión del 15 de septiembre y política de prioridades.
- [x] Crear tests de zona horaria, cambio de año, medianoche y rango de fechas.

### Fase 2 — UI y assets

- [x] Construir host global y banner sin bloquear interacción.
- [x] Preparar 12 kits visuales (uno por fecha/celebración nueva: Jueves y Viernes Santo cuentan por separado).
- [x] Implementar primero Año Nuevo, Navidad y Fin de Año para validar patrón; después las otras fechas.
- [x] Integrar móvil, modo oscuro, reducción de movimiento y ocultación por usuario.

### Fase 3 — Panel y persistencia

- [x] Integrar controles en Mantenimiento, con acceso superadmin.
- [x] Persistir ajustes en Firebase, con validación y reglas de escritura.
- [x] Añadir preview local de temas, sin alterar la experiencia del resto.
- [x] Auditar lecturas Firestore antes y después: un `getDoc` compartido con caché; cero listeners nuevos.

### Fase 4 — Pruebas y despliegue

- [ ] Probar manualmente las 12 temáticas, en fechas simuladas, móvil y escritorio.
- [ ] Regresión del **15 de septiembre** mediante captura visual; prueba automatizada completada.
- [ ] Verificar login, navegación, tablas, cierre de caja, impresión, modales y anuncios de mantenimiento.
- [ ] Ejecutar lint, typecheck, tests y build de producción.
- [ ] Activar con feature flag para superadmin, después para un negocio piloto y finalmente para todos.
- [x] Documentar cómo añadir una nueva festividad sin modificar el host global.

## 8. Casos mínimos de prueba

| Caso | Resultado esperado |
|---|---|
| `2026-01-01` en Costa Rica | Año Nuevo activo solo el día correspondiente |
| Jueves y Viernes Santo de dos años diferentes | Resolver obtiene fechas correctas sin hardcodear el año |
| `2026-09-15` | Solo aparece el diseño patrio existente; cero decoraciones del sistema nuevo |
| `2026-08-31` | Se activa el tema afrocostarricense, sin bloquear interacción |
| `2026-12-25` y `2026-12-31` | Navidad y Fin de Año son temas distintos |
| `2026-12-31 23:59` → `2027-01-01 00:00` | Cambio de tema en hora de Costa Rica y sin recarga |
| `prefers-reduced-motion` activo | Sin movimiento, decoración estática disponible |
| Usuario sin permisos superadmin | No puede editar configuración ni usar preview administrativo |
| Firebase temporalmente inaccesible | TimeMaster funciona con defaults seguros y sin pantallas bloqueadas |
| Móvil de rendimiento limitado | Sin desplazamiento horizontal ni caída perceptible de FPS |

## 9. Criterios de aceptación

1. Se muestran decoraciones temáticas en las **12 celebraciones nuevas** (incluyendo ambos días de Semana Santa), y en ninguna fecha no configurada.
2. El **15 de septiembre funciona exactamente como antes** y no recibe cambios en código ni presentación.
3. El superadmin puede habilitar, deshabilitar, previsualizar y ajustar intensidad/mensaje.
4. Los empleados pueden usar TimeMaster con normalidad: ningún efecto captura clics, tapa información importante ni modifica cálculos de negocio.
5. Animaciones accesibles y desempeño aceptable en móvil y escritorio.
6. El gasto de lecturas Firestore permanece prácticamente sin cambios gracias a un documento de configuración y caché compartida.

## 10. Alcance y decisiones pendientes

- La implementación vive dentro de `src/components/celebraciones`; el despliegue no forma parte de esta ejecución.
- La duración inicial recomendada es **solo el día de la celebración**; cualquier víspera o extensión se configura explícitamente.
- El diseño inicial prioriza **decoración de cabecera y esquinas**, nunca una capa que tape toda la interfaz.
- La configuración de temas será global para los negocios, con posibilidad de extender a ajustes por empresa en una fase posterior, si se justifica.

## 11. Cómo añadir una festividad

1. Agregar el identificador a `FESTIVITY_IDS` en `types.ts`.
2. Incorporar fecha, etiqueta y paleta en `config/festivities.ts`; para fechas móviles usar una regla relativa a Pascua o extender el resolver con una función pura probada.
3. Añadir los valores predeterminados en el mismo catálogo y su ilustración vectorial propia en `assets/FestivityArtwork.tsx`.
4. Añadir la clase de paleta correspondiente en `styles/seasonal-effects.module.css`.
5. Actualizar el serializador y la allowlist de `firestore.rules`; mantener un único documento y validar el límite de 1000 expresiones con el emulador.
6. Añadir casos de motor, UI y reglas. El host global y el panel consumen el catálogo, por lo que no requieren una rama nueva por festividad.

### Estado de rollout

El flag global predeterminado queda en `false`. Falta revisión visual manual autenticada, despliegue de código/reglas y activación gradual por SuperAdmin.
