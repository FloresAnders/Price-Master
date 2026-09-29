import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Condiciones del Servicio | TimeMaster",
  description:
    "Condiciones generales aplicables al acceso y uso de la plataforma TimeMaster.",
  alternates: {
    canonical: "https://www.timemaster.es/terms",
  },
};

const sectionClassName =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-7 dark:border-white/10 dark:bg-slate-950/80";
const headingClassName =
  "mb-3 text-xl font-semibold tracking-tight text-slate-950 dark:text-white";
const paragraphClassName =
  "text-sm leading-7 text-slate-700 sm:text-base dark:text-slate-300";
const listClassName =
  "mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-700 marker:text-violet-600 sm:text-base dark:text-slate-300 dark:marker:text-violet-400";
const linkClassName =
  "font-semibold text-violet-700 underline decoration-violet-500/40 underline-offset-4 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200";

export default function TermsPage() {
  return (
    <div className="relative isolate overflow-hidden px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.18),transparent_65%)]"
      />

      <article className="mx-auto max-w-4xl">
        <header className="mb-8 rounded-3xl border border-violet-900/10 bg-slate-950 px-6 py-9 text-white shadow-2xl shadow-slate-950/20 sm:px-10 sm:py-12 dark:border-violet-300/15">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
            Documento público
          </p>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Condiciones del Servicio de TimeMaster
          </h1>
          <p className="mt-5 text-sm text-slate-300 sm:text-base">
            Última actualización: 29 de septiembre de 2026
          </p>
        </header>

        <div className="space-y-5">
          <section className={sectionClassName} aria-labelledby="aceptacion">
            <h2 id="aceptacion" className={headingClassName}>
              Aceptación
            </h2>
            <p className={paragraphClassName}>
              Estas condiciones regulan el acceso y uso de TimeMaster. Al usar
              la plataforma o autorizar una integración, la persona usuaria
              confirma que conoce estas condiciones y que tiene capacidad o
              autorización suficiente para actuar en nombre de la empresa
              correspondiente.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="servicio">
            <h2 id="servicio" className={headingClassName}>
              Descripción del servicio
            </h2>
            <p className={paragraphClassName}>
              TimeMaster proporciona herramientas de apoyo para procesos
              empresariales, incluidos inventario, precios, fondos, proveedores,
              horarios, ventas, reportes y notificaciones SINPE. Las funciones
              disponibles dependen de la configuración, los permisos y las
              integraciones habilitadas para cada empresa.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="cuentas">
            <h2 id="cuentas" className={headingClassName}>
              Cuentas y responsabilidades
            </h2>
            <ul className={listClassName}>
              <li>
                Cada usuario debe proporcionar información correcta y proteger
                sus credenciales y dispositivos autorizados.
              </li>
              <li>
                Los administradores son responsables de asignar permisos y
                vincular únicamente cuentas y empresas que estén autorizados a
                gestionar.
              </li>
              <li>
                Debe notificarse cualquier acceso no autorizado o incidente de
                seguridad tan pronto como sea detectado.
              </li>
            </ul>
          </section>

          <section className={sectionClassName} aria-labelledby="gmail">
            <h2 id="gmail" className={headingClassName}>
              Integración con Gmail
            </h2>
            <p className={paragraphClassName}>
              La integración de Gmail es opcional y requiere consentimiento
              OAuth de la cuenta correspondiente. Se utiliza para consultar
              correos de solo lectura y detectar notificaciones SINPE. El
              titular puede revocar el permiso desde su Cuenta de Google. El
              tratamiento de estos datos se describe en la{" "}
              <a className={linkClassName} href="/privacy/gmail-sinpe">
                Política de Privacidad de Gmail y SINPE
              </a>
              .
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="uso-aceptable">
            <h2 id="uso-aceptable" className={headingClassName}>
              Uso aceptable
            </h2>
            <p className={paragraphClassName}>No se permite utilizar TimeMaster para:</p>
            <ul className={listClassName}>
              <li>Acceder a cuentas, empresas o datos sin autorización.</li>
              <li>
                Interferir con la seguridad, disponibilidad o funcionamiento de
                la plataforma o de servicios de terceros.
              </li>
              <li>
                Introducir contenido malicioso, evadir controles de acceso o
                utilizar la plataforma para actividades ilícitas.
              </li>
              <li>
                Copiar, revender o explotar el servicio de manera no autorizada.
              </li>
            </ul>
          </section>

          <section className={sectionClassName} aria-labelledby="terceros">
            <h2 id="terceros" className={headingClassName}>
              Servicios de terceros
            </h2>
            <p className={paragraphClassName}>
              Algunas funciones dependen de servicios externos como Google,
              Firebase, Vercel, navegadores, bancos o plataformas empresariales.
              Su disponibilidad y funcionamiento también están sujetos a las
              condiciones de esos proveedores. TimeMaster no controla las
              interrupciones o modificaciones realizadas por terceros.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="disponibilidad">
            <h2 id="disponibilidad" className={headingClassName}>
              Disponibilidad y exactitud
            </h2>
            <p className={paragraphClassName}>
              Se procura mantener TimeMaster disponible y la información
              procesada correctamente, pero pueden existir interrupciones,
              retrasos o errores. Las notificaciones y reportes son herramientas
              de apoyo y deben verificarse contra las fuentes operativas u
              oficiales antes de tomar decisiones financieras o contables.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="propiedad">
            <h2 id="propiedad" className={headingClassName}>
              Propiedad intelectual
            </h2>
            <p className={paragraphClassName}>
              TimeMaster, su diseño, código, marcas y contenido están protegidos
              por los derechos aplicables. Estas condiciones conceden únicamente
              un permiso limitado de uso de la plataforma y no transfieren
              derechos de propiedad intelectual.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="suspension">
            <h2 id="suspension" className={headingClassName}>
              Suspensión y terminación
            </h2>
            <p className={paragraphClassName}>
              El acceso puede suspenderse o terminarse cuando exista una
              solicitud de la empresa responsable, un riesgo de seguridad, un
              incumplimiento de estas condiciones o una obligación legal. La
              persona usuaria puede dejar de utilizar el servicio y solicitar la
              desvinculación de sus integraciones.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="responsabilidad">
            <h2 id="responsabilidad" className={headingClassName}>
              Limitación de responsabilidad
            </h2>
            <p className={paragraphClassName}>
              En la medida permitida por la legislación aplicable, TimeMaster no
              será responsable por pérdidas indirectas causadas por decisiones
              tomadas sin verificar la información, indisponibilidad de
              servicios de terceros, uso no autorizado de credenciales o eventos
              fuera de su control razonable. Esta disposición no limita derechos
              que legalmente no puedan excluirse.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="cambios">
            <h2 id="cambios" className={headingClassName}>
              Modificaciones
            </h2>
            <p className={paragraphClassName}>
              Estas condiciones pueden actualizarse para reflejar cambios del
              servicio o requisitos aplicables. La versión vigente y su fecha de
              actualización se publicarán en esta misma dirección. El uso
              continuado después de la entrada en vigor de una actualización
              implica la aceptación de la versión vigente.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="ley">
            <h2 id="ley" className={headingClassName}>
              Legislación aplicable
            </h2>
            <p className={paragraphClassName}>
              Estas condiciones se interpretan de acuerdo con la legislación
              aplicable en Costa Rica, sin perjuicio de los derechos obligatorios
              que correspondan a la persona usuaria por su jurisdicción.
            </p>
          </section>

          <section className={sectionClassName} aria-labelledby="contacto">
            <h2 id="contacto" className={headingClassName}>
              Contacto
            </h2>
            <p className={paragraphClassName}>
              Para consultas sobre estas condiciones o sobre el servicio,
              escribe a{" "}
              <a className={linkClassName} href="mailto:busticketsuna@gmail.com">
                busticketsuna@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
