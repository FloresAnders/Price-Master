# Price Master 🏷️

Un escáner de códigos de barras moderno y fácil de usar construido con Next.js y React.

## 🚀 Características

* **Escáner de códigos de barras** : Detecta múltiples formatos (EAN-13, CODE-128, CODE-39, UPC-A, QR Code, ITF, CODABAR)
* **Múltiples métodos de carga** :
* Pegar imagen desde portapapeles (Ctrl+V)
* Arrastrar y soltar archivos
* Seleccionar archivo desde explorador
* **Interfaz moderna** : Diseño limpio y responsivo con Tailwind CSS
* **Copia rápida** : Copia automáticamente el código detectado al portapapeles
* **Vista previa** : Muestra la imagen cargada antes del procesamiento

## 🛠️ Tecnologías

* **Next.js 15.3.2** - Framework de React con App Router
* **React 19** - Biblioteca de interfaz de usuario
* **TypeScript 5** - Tipado estático para JavaScript
* **Tailwind CSS 4** - Framework de CSS utilitario con PostCSS
* **@zxing/library 0.21.3** - Biblioteca JavaScript para detección de códigos de barras

### 📚 Sobre ZXing Library

**ZXing** (Zebra Crossing) es una biblioteca de código abierto para el procesamiento de imágenes de códigos de barras 1D/2D. En este proyecto utilizamos la versión JavaScript:

* **Origen** : Portada desde la biblioteca Java ZXing original
* **Capacidades** : Detección automática de múltiples formatos de códigos
* **Rendimiento** : Optimizada para navegadores modernos
* **Configuración** : Incluye hints para mejorar la precisión de detección

**Configuración actual en el proyecto:**

```typescript
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,     // Códigos de productos europeos
  BarcodeFormat.CODE_128,   // Códigos alfanuméricos de alta densidad
  BarcodeFormat.CODE_39,    // Códigos alfanuméricos estándar
  BarcodeFormat.UPC_A,      // Códigos de productos universales
  BarcodeFormat.QR_CODE,    // Códigos QR bidimensionales
  BarcodeFormat.ITF,        // Entrelazado 2 de 5
  BarcodeFormat.CODABAR,    // Códigos para bibliotecas/medicina
]);
hints.set(DecodeHintType.TRY_HARDER, true); // Análisis más exhaustivo
```

## 📋 Prerrequisitos

* **Node.js 18.0** o superior
* **npm, yarn, pnpm o bun** - Gestor de paquetes
* **Navegador moderno** - Con soporte para FileReader API y Canvas

## 🔧 Instalación

1. **Clona el repositorio**
   ```bash
   git clone <url-del-repositorio>
   cd price-master
   ```
2. **Instala las dependencias**
   ```bash
   npm install
   # o
   yarn install
   # o
   pnpm install
   # o
   bun install
   ```
3. **Verifica la instalación de ZXing**
   La biblioteca ZXing se instala automáticamente, pero puedes verificar:
   ```bash
   npm list @zxing/library
   ```
4. **Ejecuta el servidor de desarrollo**
   ```bash
   npm run dev
   # o
   yarn dev
   # o
   pnpm dev
   # o
   bun dev
   ```
5. **Abre tu navegador**
   Visita [http://localhost:3000](http://localhost:3000/) para ver la aplicación.

## ⚠️ Posibles Problemas de Instalación

### ZXing Library Issues

Si encuentras problemas con @zxing/library:

```bash
# Limpia caché y reinstala
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# O instala específicamente ZXing
npm install @zxing/library@^0.21.3
```

### Problemas de TypeScript

Si hay errores de tipos con ZXing:

```bash
# Instala tipos adicionales si es necesario
npm install --save-dev @types/node
```

## 📝 Scripts Disponibles

* `npm run dev` - Ejecuta el servidor de desarrollo con Turbopack
* `npm run build` - Construye la aplicación para producción
* `npm run start` - Ejecuta la aplicación en modo producción
* `npm run lint` - Ejecuta el linter de ESLint

## 🎯 Cómo usar

1. **Cargar una imagen** : Puedes cargar una imagen de tres formas:

* **Pegar** : Copia una imagen y pega con Ctrl+V
* **Arrastrar** : Arrastra una imagen desde tu explorador de archivos
* **Seleccionar** : Haz clic en el área de carga para abrir el selector de archivos

1. **Procesamiento** : La aplicación procesará automáticamente la imagen y detectará códigos de barras
2. **Resultado** : El código detectado aparecerá en el campo de texto y podrás copiarlo al portapapeles

## 📁 Estructura del Proyecto

```
price-master/
├── src/
│   ├── app/              # Páginas de Next.js (App Router)
│   ├── components/       # Componentes de React
│   └── ...
├── public/               # Archivos estáticos
├── package.json       
└── README.md
```

## 🔍 Formatos de Códigos Soportados

* **EAN-13** : Código de barras estándar europeo
* **CODE-128** : Código alfanumérico de alta densidad
* **CODE-39** : Código alfanumérico estándar
* **UPC-A** : Código de producto universal
* **QR Code** : Código de respuesta rápida
* **ITF** : Entrelazado 2 de 5
* **CODABAR** : Código utilizado en bibliotecas y bancos de sangre

## 🌐 Navegadores Compatibles

* Chrome 80+
* Firefox 75+
* Safari 13+
* Edge 80+

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -m 'Añadir nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y está destinado solo para uso interno.

## 🆘 Soporte

Si encuentras algún problema o tienes preguntas:

### Problemas Comunes con ZXing

1. **Error: "Cannot read properties of undefined"**
   ```bash
   # Reinstala ZXing
   npm uninstall @zxing/library
   npm install @zxing/library@^0.21.3
   ```
2. **Códigos no detectados correctamente**
   * Asegúrate de que la imagen tenga buena iluminación
   * Verifica que el código esté completamente visible
   * Prueba con imágenes de mayor resolución
   * Algunos códigos pueden necesitar estar horizontales
3. **Errores de memoria en imágenes grandes**
   * Redimensiona las imágenes antes del procesamiento
   * ZXing funciona mejor con imágenes entre 300x300 y 1920x1080

### Debugging ZXing

Para debuggear problemas con la detección:

```typescript
// Añade logs en tu componente
console.log('ZXing Reader initialized:', codeReaderRef.current);
console.log('Image dimensions:', img.width, 'x', img.height);
console.log('Supported formats:', BarcodeFormat);
```

### Otros Problemas

1. Revisa los logs de la consola del navegador
2. Verifica que la imagen contenga un código de barras visible
3. Prueba con diferentes formatos de imagen (PNG, JPG, GIF)
4. Asegúrate de usar un navegador compatible

### Actualizaciones de ZXing

Para actualizar ZXing a una versión más reciente:

```bash
# Verificar versión actual
npm list @zxing/library

# Actualizar a la última versión compatible
npm update @zxing/library

# O instalar versión específica
npm install @zxing/library@latest
```

 **Nota** : Siempre revisa el [changelog de ZXing](https://github.com/zxing-js/library/releases) antes de actualizar para verificar breaking changes.

## 🔄 Actualizaciones

Para mantener el proyecto actualizado:

```bash
# Verificar actualizaciones disponibles
npm outdated

# Actualizar todas las dependencias (patch y minor)
npm update

# Actualizar específicamente ZXing
npm install @zxing/library@latest

# Para actualizaciones major, revisa el changelog antes
npm install next@latest react@latest
```

### Versionado de Dependencias Críticas

* **ZXing Library** : Mantener en v0.21.x para estabilidad
* **Next.js** : Compatible con v15.x (App Router)
* **React** : v19.x para mejor rendimiento
* **TypeScript** : v5.x para tipado moderno

### Breaking Changes a Considerar

Al actualizar ZXing, ten en cuenta:

* Cambios en la API de `BrowserMultiFormatReader`
* Nuevos formatos de códigos de barras disponibles
* Mejoras en la precisión de detección
* Cambios en los hints de configuración

---

## 📖 Recursos Adicionales

### Documentación de ZXing

* [ZXing-JS Library](https://github.com/zxing-js/library) - Repositorio oficial
* [ZXing Original](https://github.com/zxing/zxing) - Proyecto Java original
* [Demos en Vivo](https://zxing-js.github.io/library/) - Ejemplos interactivos

### Herramientas de Desarrollo

* [Next.js Docs](https://nextjs.org/docs) - Documentación oficial
* [Tailwind CSS](https://tailwindcss.com/docs) - Guía de clases utilitarias
* [TypeScript Handbook](https://www.typescriptlang.org/docs/) - Referencia de TS

**¡Listo para escanear códigos de barras!** 🎉
