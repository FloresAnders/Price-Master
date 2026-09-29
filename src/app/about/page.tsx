import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acerca de TimeMaster",
  description:
    "Información pública sobre TimeMaster y su integración de notificaciones SINPE mediante Gmail.",
  alternates: {
    canonical: "https://www.timemaster.es/about",
  },
};

const cardClassName =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-sm sm:p-8 dark:border-white/10 dark:bg-slate-950/80";
const headingClassName =
  "mb-3 text-xl font-semibold tracking-tight text-slate-950 dark:text-white";
const paragraphClassName =
  "text-sm leading-7 text-slate-700 sm:text-base dark:text-slate-300";
const linkClassName =
  "font-semibold text-cyan-700 underline decoration-cyan-500/40 underline-offset-4 hover:text-cyan-900 dark:text-cyan-300 dark:hover:text-cyan-200";

export default function AboutTimeMasterPage() {
  return (
    <div className="relative isolate overflow-hidden px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.2),transparent_65%)]"
      />

      <article className="mx-auto max-w-4xl">
        <header className="mb-8 rounded-3xl border border-cyan-900/10 bg-slate-950 px-6 py-10 text-white shadow-2xl shadow-slate-950/20 sm:px-10 sm:py-14 dark:border-cyan-300/15">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Información pública
          </p>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            TimeMaster
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
            Plataforma de apoyo operativo para empresas que centraliza procesos
            de control, registro y consulta en un solo lugar.
          </p>
        </header>

        <div className="space-y-5">
          <section className={cardClassName} aria-labelledby="que-es">
            <h2 id="que-es" className={headingClassName}>
              Qué es TimeMaster
            </h2>
            <p className={paragraphClassName}>
              TimeMaster reúne herramientas empresariales para gestionar
              precios, inventario, fondos, proveedores, horarios, ventas y
              reportes. El acceso a cada función depende de la empresa y de los
              permisos asignados a cada usuario.
            </p>
          </section>

          <section className={cardClassName} aria-labelledby="gmail-sinpe">
            <h2 id="gmail-sinpe" className={headingClassName}>
              Notificaciones SINPE mediante Gmail
            </h2>
            <p className={paragraphClassName}>
              Una empresa puede autorizar voluntariamente a TimeMaster para
              consultar una cuenta de Gmail destinada a recibir notificaciones
              de transferencias SINPE. La integración identifica correos
              compatibles del Banco de Costa Rica, extrae únicamente la
              información necesaria de la transacción y muestra el aviso a los
              usuarios autorizados de esa empresa.
            </p>
            <p className={`${paragraphClassName} mt-3`}>
              TimeMaster solicita acceso de solo lectura. No envía, modifica ni
              elimina mensajes de la cuenta de Gmail.
            </p>
          </section>

          <section className={cardClassName} aria-labelledby="control">
            <h2 id="control" className={headingClassName}>
              Control y transparencia
            </h2>
            <p className={paragraphClassName}>
              La vinculación es realizada por un administrador autorizado y
              puede revocarse desde la Cuenta de Google. Los tokens OAuth se
              almacenan cifrados y la información de integración permanece en
              servicios de servidor sin acceso directo desde el navegador.
            </p>
          </section>

          <section className={cardClassName} aria-labelledby="documentos">
            <h2 id="documentos" className={headingClassName}>
              Privacidad y condiciones
            </h2>
            <p className={paragraphClassName}>
              Consulta cómo tratamos la información de Gmail en la{" "}
              <a className={linkClassName} href="/privacy/gmail-sinpe">
                Política de Privacidad de Gmail y SINPE
              </a>{" "}
              y revisa las{" "}
              <a className={linkClassName} href="/terms">
                Condiciones del Servicio
              </a>
              .
            </p>
          </section>

          <section className={cardClassName} aria-labelledby="contacto">
            <h2 id="contacto" className={headingClassName}>
              Contacto
            </h2>
            <p className={paragraphClassName}>
              Para consultas sobre TimeMaster, el consentimiento OAuth o el
              tratamiento de datos, escribe a{" "}
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
