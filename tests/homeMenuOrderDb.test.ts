import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";

import {
  addHomeMenuFavorite,
  getHomeMenuFavorites,
  getHomeMenuOrder,
  setHomeMenuOrder,
} from "@/services/homeMenuFavoritesDb";

describe("orden de tarjetas del HomeMenu en IndexedDB", () => {
  it("guarda y recupera el orden por usuario", async () => {
    await setHomeMenuOrder("ana@example.com", [
      "scanner",
      "calculator",
      "xml",
    ]);

    await expect(getHomeMenuOrder("ana@example.com")).resolves.toEqual([
      "scanner",
      "calculator",
      "xml",
    ]);
  });

  it("no mezcla el orden entre usuarios", async () => {
    await setHomeMenuOrder("usuario-a", ["a", "b"]);
    await setHomeMenuOrder("usuario-b", ["x", "y"]);

    await expect(getHomeMenuOrder("usuario-a")).resolves.toEqual(["a", "b"]);
    await expect(getHomeMenuOrder("usuario-b")).resolves.toEqual(["x", "y"]);
  });

  it("sobrescribe el orden anterior del mismo usuario", async () => {
    await setHomeMenuOrder("usuario-c", ["1", "2"]);
    await setHomeMenuOrder("usuario-c", ["3", "4", "5"]);

    await expect(getHomeMenuOrder("usuario-c")).resolves.toEqual([
      "3",
      "4",
      "5",
    ]);
  });

  it("devuelve lista vacía cuando no hay orden guardado", async () => {
    await expect(getHomeMenuOrder("sin-orden")).resolves.toEqual([]);
  });

  it("normaliza la clave del usuario (mayúsculas y espacios)", async () => {
    await setHomeMenuOrder("  Usuario-F  ", ["a"]);

    await expect(getHomeMenuOrder("usuario-f")).resolves.toEqual(["a"]);
  });

  it("convive con los favoritos en la misma base", async () => {
    await addHomeMenuFavorite("usuario-e", "scanner");
    await setHomeMenuOrder("usuario-e", ["calculator"]);

    await expect(getHomeMenuFavorites("usuario-e")).resolves.toEqual([
      "scanner",
    ]);
    await expect(getHomeMenuOrder("usuario-e")).resolves.toEqual([
      "calculator",
    ]);
  });
});