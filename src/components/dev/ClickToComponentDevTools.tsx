"use client";

import { useEffect, useState } from "react";

type ReactSource = {
  columnNumber?: number;
  fileName?: string;
  lineNumber?: number;
};

type ReactFiber = {
  _debugOwner?: ReactFiber | null;
  _debugSource?: ReactSource | null;
  return?: ReactFiber | null;
};

type ReactDevToolsRenderer = {
  findFiberByHostInstance?: (element: Element) => ReactFiber | null;
};

type ReactDevToolsHook = {
  renderers?: {
    values: () => Iterable<ReactDevToolsRenderer>;
  };
};

const EDITOR = "vscode";
const WORKSPACE_ROOT =
  "C:/Users/ANDERS FLORES/Documents/PERSONAL/Price-Master";

function getReactDevToolsHook() {
  return (
    window as Window & {
      __REACT_DEVTOOLS_GLOBAL_HOOK__?: ReactDevToolsHook;
    }
  ).__REACT_DEVTOOLS_GLOBAL_HOOK__;
}

function getFiberFromElement(element: Element): ReactFiber | null {
  const hook = getReactDevToolsHook();

  if (hook?.renderers) {
    for (const renderer of hook.renderers.values()) {
      try {
        const fiber = renderer.findFiberByHostInstance?.(element);

        if (fiber) {
          return fiber;
        }
      } catch {
        // React may swap host instances while rendering in development.
      }
    }
  }

  const elementRecord = element as Element & Record<string, unknown>;

  for (const key in elementRecord) {
    if (
      key.startsWith("__reactFiber") ||
      key.startsWith("__reactInternalInstance$")
    ) {
      const value = elementRecord[key];

      if (value && typeof value === "object") {
        return value as ReactFiber;
      }
    }
  }

  return null;
}

function collectFiberSources(fiber: ReactFiber | null) {
  const sources: ReactSource[] = [];
  const visited = new Set<ReactFiber>();
  let current = fiber;

  while (current && !visited.has(current)) {
    visited.add(current);

    if (current._debugSource?.fileName) {
      sources.push(current._debugSource);
    }

    current = current._debugOwner ?? current.return ?? null;
  }

  return sources;
}

function findSourceForElement(element: Element) {
  const sources: ReactSource[] = [];
  let current: Element | null = element;

  while (current) {
    sources.push(...collectFiberSources(getFiberFromElement(current)));
    current = current.parentElement;
  }

  return (
    sources.find((source) => source.fileName?.includes("/src/")) ??
    sources.find((source) => source.fileName?.includes("\\src\\")) ??
    sources.find((source) => !source.fileName?.includes("node_modules")) ??
    sources[0] ??
    null
  );
}

function normalizeFileName(fileName: string) {
  const normalized = fileName.replaceAll("\\", "/");
  const localPathMatch = normalized.match(/\/\.\/(.+)$/);

  if (normalized.startsWith("webpack-internal://") && localPathMatch) {
    return `${WORKSPACE_ROOT}/${localPathMatch[1]}`;
  }

  if (/^[A-Z]:\//i.test(normalized) || normalized.startsWith("/")) {
    return normalized;
  }

  return `${WORKSPACE_ROOT}/${normalized.replace(/^\.\//, "")}`;
}

function getEditorUrl(source: ReactSource) {
  const fileName = source.fileName;

  if (!fileName) {
    return null;
  }

  const path = normalizeFileName(fileName);
  const line = source.lineNumber ?? 1;
  const column = source.columnNumber ?? 1;
  const pathToSource = `${path}:${line}:${column}`;

  if (pathToSource.startsWith("/")) {
    return `${EDITOR}://file${pathToSource}`;
  }

  return `${EDITOR}://file/${pathToSource}`;
}

export default function ClickToComponentDevTools() {
  const [target, setTarget] = useState<Element | null>(null);
  const isDevelopment = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (!isDevelopment) {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      if (event.altKey && event.target instanceof Element) {
        setTarget(event.target);
      }
    }

    function handleClick(event: MouseEvent) {
      if (!event.altKey || !(event.target instanceof Element)) {
        return;
      }

      const source = findSourceForElement(event.target);
      const editorUrl = source ? getEditorUrl(source) : null;

      if (!editorUrl) {
        console.warn("Could not find React source for element", event.target);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      window.location.assign(editorUrl);
    }

    function handleKeyUp() {
      setTarget(null);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleKeyUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleKeyUp);
    };
  }, [isDevelopment]);

  useEffect(() => {
    if (!isDevelopment) {
      return;
    }

    document.body.dataset.clickToComponent =
      target === null ? "IDLE" : "HOVER";

    return () => {
      delete document.body.dataset.clickToComponent;
    };
  }, [isDevelopment, target]);

  if (!isDevelopment) {
    return null;
  }

  return (
    <style>
      {`
        [data-click-to-component="HOVER"] * {
          cursor: context-menu !important;
        }
      `}
    </style>
  );
}
