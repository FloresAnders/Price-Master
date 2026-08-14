import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | TimeMaster Gente Crystal",
  description:
    "Política de privacidad de la extensión TimeMaster Gente Crystal para Microsoft Edge.",
  alternates: {
    canonical:
      "https://www.timemaster.es/privacy/gente-crystal-extension",
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

export default function GenteCrystalExtensionPrivacyPage() {
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
            Política de Privacidad – TimeMaster Gente Crystal
          </h1>
          <p className="mt-5 text-sm text-slate-300 sm:text-base">
            Última actualización: 13 de agosto de 2026
          </p>
        </header>

        <div className="space-y-5">
          <section className={sectionClassName} aria-labelledby="proposito">
            <h2 id="proposito" className={headingClassName}>
              Propósito y alcance
            </h2>
            <p className={paragraphClassName}>
              La extensión TimeMaster Gente Crystal tiene como único propósito
              detectar ventas realizadas en la plataforma Gente Crystal y
              sincronizar con TimeMaster la información necesaria para su
              registro y control. Esta política se aplica exclusivamente al
              tratamiento de datos realizado por esta extensión para Microsoft
              Edge.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="datos">
            <h2 id="datos" className={headingClassName}>
              Datos procesados
            </h2>
            <p className={paragraphClassName}>
              Para cumplir su función, la extensión puede procesar los
              siguientes datos relacionados con una venta:
            </p>
            <ul className={listClassName}>
              <li>Número de tiquete de la venta.</li>
              <li>Sorteo seleccionado.</li>
              <li>Monto de la venta.</li>
              <li>Fecha y hora de la venta.</li>
              <li>Estado de la venta, por ejemplo activa o anulada.</li>
              <li>
                Origen de captura, para distinguir si la venta fue confirmada
                mediante la acción local correspondiente o detectada de forma
                indirecta.
              </li>
              <li>
                Identificadores de la empresa y del dispositivo vinculados a
                TimeMaster.
              </li>
              <li>
                Datos técnicos de sincronización, como intentos, marcas de
                tiempo, confirmaciones y errores de conexión.
              </li>
            </ul>
          </section>

          <section className={sectionClassName} aria-labelledby="exclusiones">
            <h2 id="exclusiones" className={headingClassName}>
              Datos que no se recopilan
            </h2>
            <p className={paragraphClassName}>
              La extensión no recopila contraseñas de Gente Crystal, números de
              tarjetas o cuentas bancarias, historial general de navegación,
              contenido de páginas ajenas a su funcionalidad, cookies para
              publicidad ni datos destinados a crear perfiles publicitarios.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="obtencion">
            <h2 id="obtencion" className={headingClassName}>
              Cómo se obtienen los datos
            </h2>
            <p className={paragraphClassName}>
              Una vez instalada y configurada por un usuario autorizado, la
              extensión examina el contenido visible necesario para identificar
              ventas en las páginas de entradas e impresión de pagos de Gente
              Crystal. No inspecciona el contenido de otros sitios web.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="uso">
            <h2 id="uso" className={headingClassName}>
              Uso de los datos
            </h2>
            <p className={paragraphClassName}>
              Los datos se utilizan exclusivamente para registrar y sincronizar
              las ventas de Gente Crystal con TimeMaster, evitar registros
              duplicados, conservar su origen de captura, actualizar su estado y
              mostrar la información operativa a usuarios autorizados de la
              empresa correspondiente.
            </p>
          </section>

          <section
            className={sectionClassName}
            aria-labelledby="almacenamiento-local"
          >
            <h2 id="almacenamiento-local" className={headingClassName}>
              Almacenamiento local en Microsoft Edge
            </h2>
            <p className={paragraphClassName}>
              La extensión utiliza el almacenamiento local de Microsoft Edge
              para conservar la lista de ventas detectadas, la cola de
              sincronización, confirmaciones, información de reintentos, la
              dirección de la API y el token del dispositivo. Esto permite
              recuperar la sincronización después de un problema temporal de
              conexión o de cerrar el navegador.
            </p>
            <p className={paragraphClassName + " mt-3"}>
              El botón <strong>Limpiar</strong> de la extensión elimina la lista
              local visible de ventas. Desinstalar la extensión detiene el
              procesamiento y elimina su almacenamiento local administrado por
              Edge. El token del dispositivo no es la contraseña de Gente
              Crystal y se utiliza únicamente para autenticar solicitudes hacia
              TimeMaster.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="transmision">
            <h2 id="transmision" className={headingClassName}>
              Transmisión, almacenamiento y divulgación
            </h2>
            <p className={paragraphClassName}>
              En producción, los datos de ventas se transmiten mediante HTTPS a
              los servidores de TimeMaster. El token autentica el dispositivo y
              permite asociar cada registro con la empresa autorizada. Los
              registros se almacenan en Google Firebase Cloud Firestore, que
              actúa como proveedor de infraestructura en la nube para TimeMaster.
            </p>
            <p className={paragraphClassName + " mt-3"}>
              La información solo puede ser utilizada por TimeMaster, sus
              usuarios empresariales autorizados y sus proveedores técnicos en
              la medida necesaria para prestar el servicio. No se vende, no se
              alquila, no se utiliza con fines publicitarios y no se comparte
              para seguimiento de usuarios por Internet.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="retencion">
            <h2 id="retencion" className={headingClassName}>
              Conservación de los datos
            </h2>
            <p className={paragraphClassName}>
              Los datos locales se conservan mientras sean necesarios para el
              historial y la sincronización de la extensión, hasta que se
              eliminen mediante los controles disponibles o se desinstale la
              extensión. Los registros enviados a TimeMaster se conservan
              mientras sean necesarios para la operación de la empresa, la
              prevención de duplicados y las obligaciones aplicables. Una venta
              anulada puede conservar su estado para impedir que vuelva a
              registrarse como activa.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="acceso-sitios">
            <h2 id="acceso-sitios" className={headingClassName}>
              Acceso a sitios web y permisos
            </h2>
            <p className={paragraphClassName}>
              La extensión solicita acceso al dominio de Gente Crystal para
              detectar ventas; sus scripts de detección se ejecutan en las
              páginas <code>entradas.php</code> y <code>print_pagos.php</code>.
              También accede a los dominios de TimeMaster necesarios para
              sincronizar los registros. Los permisos de almacenamiento,
              pestaña activa y alarmas se utilizan para guardar el estado local,
              ejecutar acciones solicitadas desde la extensión y reintentar la
              sincronización. Las direcciones locales incluidas en versiones de
              desarrollo se utilizan únicamente para pruebas autorizadas.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="seguridad">
            <h2 id="seguridad" className={headingClassName}>
              Seguridad
            </h2>
            <p className={paragraphClassName}>
              La comunicación con TimeMaster en producción se realiza mediante
              conexiones HTTPS. Para pruebas autorizadas, la extensión admite
              HTTP únicamente hacia <code>localhost</code> y{" "}
              <code>127.0.0.1</code>; debido a que esa conexión local no está
              cifrada, no debe configurarse con datos ni tokens de producción.
              El token del dispositivo se envía como credencial de autenticación
              únicamente a la API configurada de TimeMaster. El acceso a los
              registros almacenados se restringe según la empresa, el
              dispositivo y los permisos autorizados dentro del sistema.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="control">
            <h2 id="control" className={headingClassName}>
              Control, acceso y eliminación
            </h2>
            <ul className={listClassName}>
              <li>
                El usuario puede detener el tratamiento desactivando o
                desinstalando la extensión desde Microsoft Edge.
              </li>
              <li>
                El usuario puede limpiar la lista local visible mediante el
                control disponible en la extensión.
              </li>
              <li>
                Los administradores autorizados pueden consultar los registros
                de su empresa mediante las funciones disponibles en TimeMaster.
              </li>
              <li>
                Para solicitar acceso, corrección o eliminación de datos
                almacenados, se puede escribir a{" "}
                <a
                  className="font-semibold text-cyan-700 underline decoration-cyan-500/40 underline-offset-4 hover:text-cyan-900 dark:text-cyan-300 dark:hover:text-cyan-200"
                  href="mailto:price.master.srl@gmail.com"
                >
                  price.master.srl@gmail.com
                </a>
                . La solicitud debe incluir información suficiente para
                identificar la empresa o el dispositivo correspondiente.
              </li>
            </ul>
          </section>

          <section className={sectionClassName} aria-labelledby="cambios">
            <h2 id="cambios" className={headingClassName}>
              Cambios a esta política
            </h2>
            <p className={paragraphClassName}>
              Esta política podrá actualizarse cuando cambie la funcionalidad de
              la extensión o el tratamiento de datos. La versión vigente y su
              fecha de actualización estarán disponibles permanentemente en
              esta misma dirección.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="contacto">
            <h2 id="contacto" className={headingClassName}>
              Contacto
            </h2>
            <p className={paragraphClassName}>
              Para consultas relacionadas con privacidad, datos o funcionamiento
              de la extensión, escriba a{" "}
              <a
                className="font-semibold text-cyan-700 underline decoration-cyan-500/40 underline-offset-4 hover:text-cyan-900 dark:text-cyan-300 dark:hover:text-cyan-200"
                href="mailto:price.master.srl@gmail.com"
              >
                price.master.srl@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
