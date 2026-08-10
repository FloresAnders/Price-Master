# Comentario opcional para T11 en modo Mixto

## Objetivo

Permitir que el usuario agregue un comentario opcional cuando registra un ticket T11 en modo Mixto dentro de Control de tiempos.

## Alcance

- El campo se mostrará únicamente en el formulario en línea de T11 cuando el modo seleccionado sea Mixto.
- El campo aparecerá entre el monto y el botón **Agregar**.
- El comentario se asociará al ticket mediante una propiedad opcional `comment`.
- Antes de guardarlo, se eliminarán los espacios al inicio y al final.
- Si el campo queda vacío o contiene solo espacios, el ticket se guardará sin comentario.
- El comentario se mostrará únicamente en la tarjeta del ticket correspondiente.
- Los tickets existentes que no tengan `comment` seguirán funcionando y no mostrarán un espacio vacío.

## Fuera de alcance

- Agregar comentarios a T11 en modo Individual.
- Agregar comentarios a T10, NNN o TTT.
- Mostrar el comentario en el resumen, el panel de totales o la exportación.
- Editar el comentario después de crear el ticket.

## Flujo de datos

1. Al iniciar un registro T11 en modo Mixto, el formulario limpia el monto y el comentario anteriores.
2. El usuario escribe un monto válido y, opcionalmente, un comentario.
3. Al pulsar **Agregar**, el comentario normalizado se guarda en el nuevo ticket cuando no está vacío.
4. El arreglo de tickets mantiene su persistencia actual en `localStorage`, incluyendo la nueva propiedad opcional.
5. `TicketCarousel` recibe el comentario y lo presenta en la tarjeta sin incluirlo en la edición.
6. Al completar el registro o iniciar otro T11 Mixto, el estado temporal del comentario se limpia.

## Interfaz

El campo tendrá la etiqueta **Comentario (opcional)** y utilizará los estilos existentes de los controles del formulario. La tarjeta mostrará el comentario de forma legible y diferenciada, sin desplazar el monto ni la hora cuando el comentario no exista.

## Validación y errores

El comentario no será obligatorio y no bloqueará el botón **Agregar**. No se añadirá validación de contenido adicional; el monto conservará las reglas actuales.

## Pruebas

- Un comentario con texto se normaliza y queda asociado al nuevo ticket T11 Mixto.
- Un comentario vacío o compuesto solo por espacios no crea contenido visible en la tarjeta.
- La tarjeta muestra el comentario cuando existe y omite su espacio cuando no existe.
- Los tickets antiguos sin `comment` continúan renderizándose.
- El comentario no se incluye en la edición ni en la exportación.
