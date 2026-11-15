import { execFileSync } from "node:child_process";

const APP_ID = "com.timemaster.app";
const EXPECTED_ORIGIN = "https://www.timemaster.es";
const DEBUG_PORT = "9222";

function adb(...args) {
  return execFileSync("adb", args, { encoding: "utf8" }).trim();
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function evaluate(webSocketUrl, expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Tiempo agotado esperando respuesta CDP."));
    }, 10_000);

    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, returnByValue: true },
        }),
      );
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data.toString());
      if (message.id !== 1) return;
      clearTimeout(timeout);
      socket.close();
      if (message.error) {
        reject(new Error(`CDP rechazó evaluación: ${message.error.message}`));
        return;
      }
      if (message.result?.exceptionDetails) {
        reject(new Error("WebView lanzó una excepción durante evaluación CDP."));
        return;
      }
      resolve(message.result.result.value);
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("No fue posible conectar con CDP del WebView."));
    });
  });
}

async function retry(operation, description, timeoutMilliseconds = 10_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await operation();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await wait(250);
  }
  throw new Error(
    `${description} no disponible.${lastError ? ` ${lastError.message}` : ""}`,
  );
}

async function main() {
  if (adb("get-state") !== "device") {
    throw new Error("No hay dispositivo ADB listo.");
  }

  const activity = adb("shell", "cmd", "package", "resolve-activity", "--brief", APP_ID)
    .split(/\r?\n/)
    .at(-1);
  if (!activity) throw new Error(`Actividad de ${APP_ID} no encontrada.`);

  adb("shell", "am", "start", "-W", "-n", activity);
  const pid = await retry(
    () => adb("shell", "pidof", "-s", APP_ID),
    `PID de ${APP_ID}`,
  );
  const socketName = await retry(() => {
    const sockets = adb("shell", "cat", "/proc/net/unix");
    return sockets.match(new RegExp(`@(webview_devtools_remote_${pid})\\b`))?.[1];
  }, "Socket CDP del WebView de Time Master");

  adb("forward", `tcp:${DEBUG_PORT}`, `localabstract:${socketName}`);
  try {
    const page = await retry(async () => {
      const pages = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
      return pages.find(
        (candidate) =>
          candidate.type === "page" &&
          new URL(candidate.url).origin === EXPECTED_ORIGIN,
      );
    }, "Página .es del WebView de Time Master");

    const support = await evaluate(
      page.webSocketDebuggerUrl,
      `({
        origin: location.origin,
        secure: isSecureContext,
        publicKeyCredential: typeof PublicKeyCredential,
        navigatorCredentials: typeof navigator.credentials,
        create: typeof navigator.credentials?.create,
        get: typeof navigator.credentials?.get,
        activationDisabled: document.querySelector('[aria-label="Activar passkey en este dispositivo"]')?.disabled ?? null
      })`,
    );

    if (support.origin !== EXPECTED_ORIGIN) {
      throw new Error(`Origen incorrecto: ${support.origin}`);
    }
    if (!support.secure) throw new Error("WebView no está en contexto seguro.");
    if (support.publicKeyCredential !== "function") {
      throw new Error(`PublicKeyCredential es ${support.publicKeyCredential}.`);
    }
    if (support.navigatorCredentials !== "object") {
      throw new Error(`navigator.credentials es ${support.navigatorCredentials}.`);
    }
    if (support.create !== "function" || support.get !== "function") {
      throw new Error("navigator.credentials.create/get no están disponibles.");
    }
    if (support.activationDisabled === true) {
      throw new Error("Control de activación de passkey permanece deshabilitado.");
    }

    console.log(
      JSON.stringify({
        ...support,
        activationControlChecked:
          support.activationDisabled === null ? "not-present" : "present",
      }),
    );
  } finally {
    adb("forward", "--remove", `tcp:${DEBUG_PORT}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
