function normalizeField(field) {
  const normalized = { fieldPath: String(field?.fieldPath || "") };
  if (field?.order) normalized.order = field.order;
  if (field?.arrayConfig) normalized.arrayConfig = field.arrayConfig;
  return normalized;
}

function collectionGroupFromName(name) {
  const match = String(name || "").match(/\/collectionGroups\/([^/]+)\/indexes\//);
  return match ? decodeURIComponent(match[1]) : "";
}

function normalizeIndex(index, deployed = false) {
  return {
    collectionGroup: deployed
      ? collectionGroupFromName(index?.name)
      : String(index?.collectionGroup || ""),
    queryScope: String(index?.queryScope || ""),
    fields: (index?.fields || [])
      .filter((field) => field?.fieldPath !== "__name__")
      .map(normalizeField),
  };
}

function indexSignature(index) {
  const fields = index.fields
    .map((field) => `${field.fieldPath}:${field.order || field.arrayConfig || ""}`)
    .join(",");
  return `${index.collectionGroup}|${index.queryScope}|${fields}`;
}

export function compareCompositeIndexes(localIndexes, deployedIndexes) {
  const local = localIndexes.map((index) => indexSignature(normalizeIndex(index)));
  const deployed = deployedIndexes.map((index) =>
    indexSignature(normalizeIndex(index, true)),
  );
  const localSet = new Set(local);
  const deployedSet = new Set(deployed);

  return {
    localCount: local.length,
    deployedCount: deployed.length,
    missing: local.filter((signature) => !deployedSet.has(signature)).sort(),
    unexpected: deployed.filter((signature) => !localSet.has(signature)).sort(),
    notReady: deployedIndexes
      .filter((index) => index?.state !== "READY")
      .map((index) => indexSignature(normalizeIndex(index, true)))
      .sort(),
  };
}

function eventFilterMap(eventTrigger) {
  const filters = eventTrigger?.eventFilters;
  if (Array.isArray(filters)) {
    return Object.fromEntries(
      filters.map((filter) => [String(filter?.attribute || ""), filter?.value]),
    );
  }
  return filters && typeof filters === "object" ? filters : {};
}

export function inspectRequiredFunctions(deployedFunctions, requiredFunctions) {
  const deployedByName = new Map(
    deployedFunctions.map((fn) => [String(fn?.name || "").split("/").pop(), fn]),
  );
  const failures = [];

  for (const required of requiredFunctions) {
    const deployed = deployedByName.get(required.name);
    if (!deployed) {
      failures.push(`${required.name}: no desplegada`);
      continue;
    }

    if (deployed.state !== "ACTIVE") {
      failures.push(`${required.name}: state=${deployed.state}; esperado=ACTIVE`);
    }

    const filters = eventFilterMap(deployed.eventTrigger);
    if (filters.database !== required.database) {
      failures.push(
        `${required.name}: database=${filters.database || "(sin filtro)"}; esperado=${required.database}`,
      );
    }
    if (filters.document !== required.document) {
      failures.push(
        `${required.name}: document=${filters.document || "(sin filtro)"}; esperado=${required.document}`,
      );
    }
  }

  return { checked: requiredFunctions.length, failures };
}

export function normalizeRulesSource(source) {
  const normalized = String(source || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trimEnd();
  return normalized ? `${normalized}\n` : "";
}
