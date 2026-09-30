import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | Encabezado de impresión",
  description:
    "Política de privacidad de la extensión Encabezado de impresión para Google Chrome.",
  alternates: {
    canonical: "https://www.timemaster.es/privacy/encabezado-impresion",
  },
};

const sectionClassName =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-7 dark:border-white/10 dark:bg-slate-950/80";
const headingClassName =
  "mb-3 text-xl font-semibold tracking-tight text-slate-950 dark:text-white";
const paragraphClassName =
  "text-sm leading-7 text-slate-700 sm:text-base dark:text-slate-300";
const listClassName =
  "mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-700 marker:text-cyan-600 sm:text-base dark:text-slate-300 dark:marker:text-cyan-400";
const linkClassName =
  "font-semibold text-cyan-700 underline decoration-cyan-500/40 underline-offset-4 hover:text-cyan-900 dark:text-cyan-300 dark:hover:text-cyan-200";

export default function EncabezadoImpresionPrivacyPage() {
  return (
    <div className="relative isolate overflow-hidden px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top,rgba(8,145,178,0.18),transparent_65%)]"
      />

      <article className="mx-auto max-w-4xl">
        <header className="mb-8 rounded-3xl border border-cyan-900/10 bg-slate-950 px-6 py-9 text-white shadow-2xl shadow-slate-950/20 sm:px-10 sm:py-12 dark:border-cyan-300/15">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Documento público
          </p>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Política de Privacidad – Encabezado de impresión
          </h1>
          <p className="mt-5 text-sm text-slate-300 sm:text-base">
            Última actualización: 30 de septiembre de 2026
          </p>
        </header>

        <div className="space-y-5">
          <section className={sectionClassName} aria-labelledby="proposito">
            <h2 id="proposito" className={headingClassName}>
              Propósito y alcance
            </h2>
            <p className={paragraphClassName}>
              La extensión Encabezado de impresión tiene como único propósito
              permitir que el usuario agregue una imagen y líneas de texto
              centradas antes de los comprobantes impresos de Tucán y Junta.
              Esta política describe el tratamiento de información realizado
              por la extensión para Google Chrome.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="datos">
            <h2 id="datos" className={headingClassName}>
              Información procesada
            </h2>
            <p className={paragraphClassName}>
              La extensión procesa únicamente el contenido y las preferencias
              que el usuario introduce voluntariamente para crear el
              encabezado:
            </p>
            <ul className={listClassName}>
              <li>Imagen o logotipo seleccionado en formato PNG, JPEG o WebP.</li>
              <li>Líneas de texto escritas por el usuario.</li>
              <li>Fuente y tamaño elegidos para cada línea.</li>
              <li>Orden de las líneas y límite general de caracteres.</li>
            </ul>
          </section>

          <section className={sectionClassName} aria-labelledby="uso">
            <h2 id="uso" className={headingClassName}>
              Uso de la información
            </h2>
            <p className={paragraphClassName}>
              La información se utiliza exclusivamente para mostrar una vista
              previa y colocar el encabezado configurado antes del contenido
              original cuando el usuario abre una página compatible de
              impresión. No se utiliza para publicidad, análisis, seguimiento,
              elaboración de perfiles ni evaluación crediticia.
            </p>
          </section>

          <section
            className={sectionClassName}
            aria-labelledby="almacenamiento-local"
          >
            <h2 id="almacenamiento-local" className={headingClassName}>
              Almacenamiento local
            </h2>
            <p className={paragraphClassName}>
              La imagen, los textos y las preferencias se guardan únicamente
              en el dispositivo del usuario mediante{" "}
              <code>chrome.storage.local</code>. La extensión no posee
              servidores, cuentas de usuario ni mecanismos de sincronización en
              la nube, por lo que el desarrollador no recibe ese contenido.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="permisos">
            <h2 id="permisos" className={headingClassName}>
              Permisos y acceso a sitios web
            </h2>
            <ul className={listClassName}>
              <li>
                <code>storage</code> permite conservar localmente la
                configuración del encabezado.
              </li>
              <li>
                <code>fontSettings</code> se utiliza únicamente para consultar
                la lista de fuentes instaladas y presentarla al usuario. La
                extensión no modifica la configuración global de fuentes del
                navegador.
              </li>
              <li>
                El acceso a las páginas compatibles de BCR Corresponsales y{" "}
                <code>puntosventa.jpsenlinea.go.cr</code> se utiliza únicamente
                para insertar visualmente el encabezado antes del comprobante.
              </li>
            </ul>
          </section>

          <section className={sectionClassName} aria-labelledby="exclusiones">
            <h2 id="exclusiones" className={headingClassName}>
              Información que no se recopila
            </h2>
            <p className={paragraphClassName}>
              La extensión no recopila ni transmite el contenido de los
              comprobantes, historial general de navegación, contraseñas,
              cookies de autenticación, datos bancarios o información de pago.
              Tampoco incorpora herramientas de analítica, publicidad o
              seguimiento y no ejecuta código alojado de forma remota.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="divulgacion">
            <h2 id="divulgacion" className={headingClassName}>
              Transmisión y divulgación
            </h2>
            <p className={paragraphClassName}>
              La extensión no transmite la imagen, los textos ni las
              preferencias fuera del navegador. La información no se vende,
              alquila ni comparte con terceros. Tampoco se utiliza para fines
              distintos de la personalización solicitada por el usuario.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="control">
            <h2 id="control" className={headingClassName}>
              Control y eliminación
            </h2>
            <ul className={listClassName}>
              <li>
                El usuario puede quitar la imagen y eliminar o modificar las
                líneas desde la interfaz de la extensión.
              </li>
              <li>
                El usuario puede detener el procesamiento desactivando la
                extensión desde la administración de extensiones de Chrome.
              </li>
              <li>
                Desinstalar la extensión elimina su configuración almacenada
                localmente por Chrome.
              </li>
            </ul>
          </section>

          <section className={sectionClassName} aria-labelledby="seguridad">
            <h2 id="seguridad" className={headingClassName}>
              Seguridad y uso limitado
            </h2>
            <p className={paragraphClassName}>
              Todo el código ejecutable está incluido dentro del paquete de la
              extensión. El tratamiento de información se limita a la función
              visible de personalizar comprobantes y cumple la Política de Datos
              de Usuario de Chrome Web Store, incluidos sus requisitos de uso
              limitado.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="cambios">
            <h2 id="cambios" className={headingClassName}>
              Cambios a esta política
            </h2>
            <p className={paragraphClassName}>
              Esta política podrá actualizarse cuando cambien la funcionalidad
              de la extensión o los requisitos aplicables. La versión vigente y
              su fecha de actualización permanecerán disponibles en esta misma
              dirección.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="contacto">
            <h2 id="contacto" className={headingClassName}>
              Contacto
            </h2>
            <p className={paragraphClassName}>
              Para consultas sobre privacidad o funcionamiento de la extensión,
              escribe a{" "}
              <a
                className={linkClassName}
                href="mailto:price.master.srl@gmail.com"
              >
                price.master.srl@gmail.com
              </a>
              . También puedes consultar las{" "}
              <a className={linkClassName} href="/terms">
                Condiciones del Servicio
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
