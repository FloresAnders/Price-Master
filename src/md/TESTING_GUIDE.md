# 🧪 GUÍA DE TESTING - Sincronización Real PC-Móvil

## 🚀 CÓMO PROBAR LA IMPLEMENTACIÓN

### **Método 1: Usando la Aplicación Real**

#### **Paso 1: Iniciar el Servidor**
```powershell
cd c:\Users\chave\Desktop\Diversion\Price-Master
npm run dev
```

#### **Paso 2: Probar desde PC**
1. 🌐 Abrir: `http://localhost:3000`
2. 📱 Ir a la pestaña "Escáner Móvil"
3. 🔘 Hacer clic en "Generar Código QR para Móvil"
4. ✅ **VERIFICAR**: Debe mostrar "⏳ ESPERANDO CONEXIÓN 'MÓVIL'"

#### **Paso 3: Probar desde Móvil**
1. 📱 Escanear el QR con el móvil O abrir la URL manualmente
2. ✅ **VERIFICAR**: En móvil debe mostrar "Verificando..." → "🖥️ [TIPO] Conectado"
3. ✅ **VERIFICAR**: En PC debe cambiar a "📱 [TIPO] CONECTADO - Listo para escanear"

#### **Paso 4: Probar Detección de Dispositivos**
1. 📱 **Con iPhone**: PC debe mostrar "📱 MÓVIL CONECTADO"
2. 📱 **Con iPad**: PC debe mostrar "📱 TABLET CONECTADO"
3. 🖥️ **Con Windows**: Móvil debe mostrar "🖥️ ESCRITORIO Conectado"
4. 💻 **Con Mac**: Móvil debe mostrar "💻 LAPTOP Conectado"

#### **Paso 5: Probar Desconexión**
1. 🚪 Cerrar la página del móvil
2. ⏱️ Esperar 15-20 segundos
3. ✅ **VERIFICAR**: PC debe volver a "⏳ ESPERANDO CONEXIÓN 'MÓVIL'"

---

### **Método 2: Usando el Test de Sincronización**

#### **Abrir Archivo de Test**
```
📂 Abrir: c:\Users\chave\Desktop\Diversion\Price-Master\test-session-sync.html
```

#### **Probar Conexiones**
1. 🖥️ Hacer clic en "Simular Sesión PC"
   - ✅ Debe aparecer en el log: "Sesión PC registrada"
   - ✅ Estado: "Solo PC conectado"

2. 📱 Hacer clic en "Simular Sesión Mobile"
   - ✅ Debe aparecer en el log: "Sesión Mobile registrada"
   - ✅ Estado: "🖥️📱 PC y Mobile conectados"

3. 🛑 Hacer clic en "Detener Sesiones"
   - ✅ Estado: "❌ Ninguna sesión activa"

---

## 🔍 QUÉ VERIFICAR

### **✅ Estados en PC (BarcodeScanner)**
- 🟠 Sin dispositivo: "⏳ ESPERANDO CONEXIÓN 'MÓVIL'" + ícono WifiOff
- 🟢 Con móvil: "📱 MÓVIL CONECTADO - Listo para escanear" + ícono Wifi
- 🟢 Con tablet: "📱 TABLET CONECTADO - Listo para escanear" + ícono Wifi

### **✅ Estados en Móvil (mobile-scan)**
- 🟡 Inicial: "Verificando..."
- 🟢 Windows PC: "🖥️ ESCRITORIO Conectado" (verde)
- 🟢 Mac: "💻 LAPTOP Conectado" (verde)
- 🟢 Linux: "🖥️ PC Conectado" (verde)
- 🔴 Desconectado: "🖥️ [TIPO] Desconectado" (rojo) + alerta específica

### **✅ Sincronización en Tiempo Real**
- ⚡ Cambios detectados en ~5-15 segundos
- 💓 Heartbeats cada 5 segundos
- 🗑️ **NUEVO**: Documentos se eliminan automáticamente al desconectar
- 🧹 Base de datos siempre limpia (solo sesiones activas)

---

## 🐛 TROUBLESHOOTING

### **❌ Error Firebase: "Unsupported field value: undefined"**
- **✅ SOLUCIONADO**: El SessionSyncService ahora filtra campos undefined
- **Causa**: Firebase no permite valores undefined en documentos
- **Fix aplicado**: Solo incluir userId/userName si no son undefined

### **Si no se detectan conexiones:**
1. ✅ Verificar que Firebase esté configurado
2. ✅ Verificar conexión a internet
3. ✅ Revisar la consola del navegador para errores
4. ✅ Asegurar que ambas páginas usen el mismo sessionId

### **Si los estados no cambian:**
1. ✅ Esperar al menos 15-20 segundos
2. ✅ Verificar que los heartbeats se estén enviando
3. ✅ Revisar los listeners de Firebase

### **Si hay errores en Firebase:**
1. ✅ Verificar reglas de Firebase (deben permitir escritura)
2. ✅ Verificar índices de Firestore
3. ✅ Verificar que la colección `session_status` existe

---

## 🎯 RESULTADOS ESPERADOS

### **✅ ÉXITO: La implementación funciona si:**
- PC detecta cuando móvil se conecta realmente
- Móvil detecta cuando PC no está activo
- Estados cambian en tiempo real
- Cleanup automático funciona
- No hay estados falsos

### **❌ PROBLEMA: Contactar al desarrollador si:**
- Estados no cambian después de 30 segundos
- Errores de Firebase persistentes
- Heartbeats no se envían
- Cleanup no funciona

---

## 📊 LOGS IMPORTANTES

### **En el Navegador (Console):**
```
✅ Nuevo sesión registrada: [sessionId]
💓 PC/Mobile heartbeat enviado
🔄 Sesiones activas detectadas: 2
📱 Mobile: CONECTADO
🖥️ PC: CONECTADO
```

### **En la Aplicación:**
```
🔥 Sincronización en tiempo real activa
🔄 Próxima verificación en Xs
📱 MÓVIL CONECTADO - Listo para escanear
```

---

## 🎉 CONFIRMACIÓN FINAL

Si todos los tests pasan, la implementación de **sincronización real PC-Móvil** está funcionando correctamente y resuelve el problema original de estados falsos.
