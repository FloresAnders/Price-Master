import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad de Gmail y SINPE | TimeMaster",
  description:
    "Política de privacidad aplicable a la integración de Gmail para notificaciones SINPE en TimeMaster.",
  alternates: {
    canonical: "https://www.timemaster.es/privacy/gmail-sinpe",
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

export default function GmailSinpePrivacyPage() {
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
            Política de Privacidad de Gmail y SINPE
          </h1>
          <p className="mt-5 text-sm text-slate-300 sm:text-base">
            Última actualización: 6 de octubre de 2026
          </p>
        </header>

        <div className="space-y-5">
          <section className={sectionClassName} aria-labelledby="alcance">
            <h2 id="alcance" className={headingClassName}>
              Alcance y responsable
            </h2>
            <p className={paragraphClassName}>
              Esta política explica cómo TimeMaster accede, utiliza, almacena y
              protege los datos obtenidos mediante la integración de Gmail para
              detectar notificaciones de transferencias SINPE. Se aplica a las
              cuentas vinculadas voluntariamente por administradores
              autorizados de las empresas que utilizan TimeMaster.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="permiso">
            <h2 id="permiso" className={headingClassName}>
              Permiso solicitado
            </h2>
            <p className={paragraphClassName}>
              TimeMaster solicita el alcance OAuth de solo lectura{" "}
              <code>https://www.googleapis.com/auth/gmail.readonly</code>. Este
              permiso permite consultar mensajes y su información asociada. La
              integración no envía, edita, archiva ni elimina correos, y tampoco
              modifica la configuración de Gmail.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="datos">
            <h2 id="datos" className={headingClassName}>
              Datos a los que se accede
            </h2>
            <p className={paragraphClassName}>
              Para operar la integración se pueden procesar los siguientes
              datos:
            </p>
            <ul className={listClassName}>
              <li>Dirección de la cuenta de Gmail vinculada.</li>
              <li>
                Identificador del mensaje, remitente, asunto, fecha y hora de
                recepción.
              </li>
              <li>
                Contenido de mensajes que coinciden con los criterios de una
                notificación SINPE válida del Banco de Costa Rica.
              </li>
              <li>
                Datos extraídos de la transferencia: referencia, monto, nombre
                del cliente, teléfono, banco, motivo, fecha y hora.
              </li>
              <li>
                Token OAuth de actualización, identificadores de historial,
                vencimiento del canal de notificaciones y datos técnicos de
                procesamiento y reintento.
              </li>
              <li>
                Identificadores de la empresa y de los usuarios autorizados que
                reciben la notificación dentro de TimeMaster.
              </li>
            </ul>
          </section>

          <section className={sectionClassName} aria-labelledby="uso">
            <h2 id="uso" className={headingClassName}>
              Finalidad y uso de los datos
            </h2>
            <p className={paragraphClassName}>
              Los datos se utilizan únicamente para detectar nuevas
              transferencias SINPE, validar que correspondan a la empresa
              vinculada, evitar notificaciones duplicadas, mostrar avisos en
              tiempo real a usuarios autorizados y mantener operativo el canal
              de Gmail. TimeMaster no utiliza estos datos para publicidad,
              perfilado, venta de información ni evaluación crediticia.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="automatizacion">
            <h2 id="automatizacion" className={headingClassName}>
              Procesamiento automatizado
            </h2>
            <p className={paragraphClassName}>
              Gmail notifica a TimeMaster que existe un cambio en la bandeja por
              medio de Google Cloud Pub/Sub. TimeMaster consulta el historial,
              revisa primero el remitente y el asunto y solo descarga el
              contenido completo cuando el mensaje parece corresponder a una
              notificación SINPE admitida. Los datos se analizan mediante reglas
              determinísticas; no se utilizan para entrenar modelos de
              inteligencia artificial.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="ai-ncii">
            <h2 id="ai-ncii" className={headingClassName}>
              Uso responsable y exclusión de AI NCII
            </h2>
            <p className={paragraphClassName}>
              TimeMaster no utiliza las APIs de Google ni la información
              obtenida de Gmail para crear, procesar, almacenar, distribuir o
              facilitar imágenes o videos íntimos no consensuados, incluidos
              contenidos íntimos no consensuados generados por inteligencia
              artificial (AI NCII). La integración no genera ni analiza
              imágenes y no utiliza inteligencia artificial.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="almacenamiento">
            <h2 id="almacenamiento" className={headingClassName}>
              Almacenamiento y seguridad
            </h2>
            <p className={paragraphClassName}>
              El token OAuth de actualización se cifra con AES-256-GCM antes de
              almacenarse. Los tokens, estados de Gmail y trabajos técnicos se
              administran exclusivamente en el servidor y no se exponen al
              navegador. Los eventos SINPE se separan por empresa y solo pueden
              ser consultados por usuarios autenticados con el permiso
              correspondiente. Las comunicaciones de producción utilizan HTTPS.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="proveedores">
            <h2 id="proveedores" className={headingClassName}>
              Proveedores y divulgación
            </h2>
            <p className={paragraphClassName}>
              TimeMaster utiliza servicios de Google, incluidos Gmail API,
              Google Cloud Pub/Sub y Firebase, así como infraestructura de
              alojamiento de Vercel. Estos proveedores procesan información en
              la medida necesaria para prestar sus servicios. TimeMaster no
              vende ni alquila datos de Gmail y no los comparte con terceros
              para publicidad. La información solo podrá divulgarse cuando sea
              necesario para operar el servicio, atender una solicitud válida
              del usuario o cumplir una obligación legal aplicable.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="retencion">
            <h2 id="retencion" className={headingClassName}>
              Conservación
            </h2>
            <p className={paragraphClassName}>
              Los tokens y datos técnicos de integración se conservan mientras
              la cuenta permanezca vinculada y sean necesarios para mantener el
              servicio. Los eventos SINPE se conservan mientras sean necesarios
              para la operación, trazabilidad y prevención de duplicados de la
              empresa, o para cumplir obligaciones aplicables. Cuando se aprueba
              una solicitud de eliminación, los datos se eliminan o anonimizan,
              salvo aquellos que deban conservarse por motivos legales o de
              seguridad documentados.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="control">
            <h2 id="control" className={headingClassName}>
              Revocación, acceso y eliminación
            </h2>
            <ul className={listClassName}>
              <li>
                El titular puede revocar el acceso de TimeMaster desde la
                sección de seguridad y conexiones de su Cuenta de Google.
              </li>
              <li>
                Revocar el acceso detiene las consultas futuras, pero no elimina
                automáticamente los eventos ya registrados en TimeMaster.
              </li>
              <li>
                Para solicitar acceso, corrección, desvinculación o eliminación
                de datos almacenados, debe escribirse a{" "}
                <a className={linkClassName} href="mailto:busticketsuna@gmail.com">
                  busticketsuna@gmail.com
                </a>{" "}
                indicando la cuenta y empresa correspondientes.
              </li>
            </ul>
          </section>

          <section className={sectionClassName} aria-labelledby="google-policy">
            <h2 id="google-policy" className={headingClassName}>
              Uso limitado de datos de Google
            </h2>
            <p className={paragraphClassName}>
              El uso y la transferencia de información recibida de las APIs de
              Google por parte de TimeMaster cumplen la Política de Datos de
              Usuario de los Servicios API de Google, incluidos sus requisitos
              de Uso Limitado. Los datos de Google se utilizan únicamente para
              proporcionar y mejorar la función visible de notificaciones SINPE
              autorizada por el usuario.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="cambios">
            <h2 id="cambios" className={headingClassName}>
              Cambios a esta política
            </h2>
            <p className={paragraphClassName}>
              Esta política puede actualizarse cuando cambien la integración o
              los requisitos aplicables. La versión vigente y su fecha de
              actualización estarán disponibles permanentemente en esta misma
              dirección.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="contacto">
            <h2 id="contacto" className={headingClassName}>
              Contacto
            </h2>
            <p className={paragraphClassName}>
              Para consultas sobre privacidad o datos de Gmail, escribe a{" "}
              <a className={linkClassName} href="mailto:busticketsuna@gmail.com">
                busticketsuna@gmail.com
              </a>
              . También puedes consultar la{" "}
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
