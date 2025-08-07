# Configuración de Gmail para Price Master

Este documento explica cómo configurar el envío de correos electrónicos mediante Gmail en el sistema Price Master.

## 📧 Requisitos Previos

1. **Cuenta de Gmail activa**
2. **Verificación en 2 pasos habilitada** en tu cuenta de Google
3. **Contraseña de aplicación** generada desde Google

## 🔧 Configuración Paso a Paso

### 1. Habilitar Verificación en 2 Pasos

1. Ve a [myaccount.google.com](https://myaccount.google.com)
2. En el panel izquierdo, haz clic en **"Seguridad"**
3. En "Iniciar sesión en Google", haz clic en **"Verificación en 2 pasos"**
4. Sigue las instrucciones para configurarla

### 2. Generar Contraseña de Aplicación

1. Una vez habilitada la verificación en 2 pasos, regresa a **"Seguridad"**
2. En "Iniciar sesión en Google", haz clic en **"Contraseñas de aplicaciones"**
3. En "Seleccionar aplicación", elige **"Otra (nombre personalizado)"**
4. Escribe **"Price Master"** como nombre
5. Haz clic en **"Generar"**
6. **Copia la contraseña de 16 caracteres** que aparece

### 3. Configurar Variables de Entorno

Crea o edita el archivo `.env.local` en la raíz del proyecto:

```env
# Configuración de Gmail para envío de correos
GMAIL_USER=tu-email@gmail.com
GMAIL_APP_PASSWORD=abcd-efgh-ijkl-mnop
```

**Importante:** 
- Reemplaza `tu-email@gmail.com` con tu dirección de Gmail
- Reemplaza `abcd-efgh-ijkl-mnop` con la contraseña de aplicación generada
- **NO uses tu contraseña normal de Gmail**

### 4. Reiniciar el Servidor

Después de configurar las variables de entorno:

```bash
npm run dev
```

## ✅ Verificar Configuración

1. Ve al **Backdoor** → **Pruebas** → **Correo Electrónico (Gmail)**
2. Ejecuta **"Verificar Configuración"**
3. Si está configurado correctamente, verás un mensaje de éxito

## 📨 Funcionalidades Disponibles

### 1. Verificar Configuración
- Comprueba que las credenciales de Gmail sean válidas
- Verifica la conexión con los servidores de Gmail

### 2. Enviar Correo de Prueba
- Envía un correo de prueba a cualquier dirección
- Incluye información del sistema y configuración
- Útil para verificar que todo funciona correctamente

### 3. Enviar Correo Personalizado
- Permite componer y enviar correos personalizados
- Campos: destinatario, asunto y mensaje
- Útil para notificaciones del sistema

## 🛡️ Configuración Anti-Spam

El sistema incluye las siguientes configuraciones para evitar que los correos lleguen a spam:

### Headers Configurados
- `X-Priority: 3` (prioridad normal)
- `X-MSMail-Priority: Normal`
- `Importance: Normal`
- `X-Mailer: Price Master System`
- `Reply-To` configurado correctamente

### Formato del Correo
- **From**: Nombre descriptivo "Price Master System"
- **HTML limpio**: Estructura bien formada con estilos inline
- **Texto alternativo**: Versión de texto plano incluida
- **Message-ID único**: Generado automáticamente

### Buenas Prácticas Implementadas
- ✅ **Rate limiting**: Máximo 5 correos cada 20 segundos
- ✅ **Pool de conexiones**: Reutilización eficiente de conexiones
- ✅ **Validación de emails**: Formato verificado antes del envío
- ✅ **Manejo de errores**: Mensajes descriptivos para debugging

## 🚨 Solución de Problemas

### Error: "Invalid login"
- Verifica que `GMAIL_USER` sea correcto
- Asegúrate de usar la **contraseña de aplicación**, no tu contraseña normal
- Confirma que la verificación en 2 pasos esté habilitada

### Error: "Timeout"
- Revisa tu conexión a internet
- Verifica que no haya firewall bloqueando el puerto 587

### Los correos llegan a spam
- Asegúrate de que el dominio esté configurado correctamente
- Evita palabras spam en el asunto
- Mantén un volumen de envío moderado

### Variables de entorno no reconocidas
- Asegúrate de que el archivo se llame exactamente `.env.local`
- Reinicia el servidor después de cambiar las variables
- Verifica que no haya espacios extra en las variables

## 📝 Ejemplos de Uso

### Correo de Prueba Típico
```
Para: destinatario@ejemplo.com
Asunto: Prueba de envío - Price Master System
Contenido: Información del sistema, fecha/hora, estado de configuración
```

### Correo Personalizado de Ejemplo
```
Para: administrador@empresa.com
Asunto: Reporte de inventario - Sistema Price Master
Contenido: Se ha completado el inventario del día. 
          Total de productos escaneados: 1,234
          Ubicación: Tienda Principal
          Fecha: 07/08/2025
```

## 🔒 Seguridad

- **No commitees** el archivo `.env.local` al repositorio
- **Regenera** la contraseña de aplicación si se compromete
- **Revisa** regularmente las sesiones activas en tu cuenta de Google
- **Usa** diferentes contraseñas de aplicación para diferentes proyectos

## 💡 Consejos

1. **Prueba primero**: Siempre usa "Enviar Correo de Prueba" antes de envíos importantes
2. **Revisa spam**: Los primeros correos pueden llegar a spam hasta establecer reputación
3. **Monitorea**: Revisa los logs del sistema para cualquier error de envío
4. **Backup**: Mantén respaldo de la configuración de las variables de entorno
