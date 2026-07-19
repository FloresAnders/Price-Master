import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const types = read("src/types/firestore.ts");
const service = read("src/services/empresas.ts");
const editor = read("src/edit/components/EmpresasEditorSection.tsx");
const dataEditor = read("src/edit/DataEditor.tsx");

assert.match(types, /editBy\?: string;/, "Empresas type exposes editBy");
assert.match(service, /editBy:\s*empresa\.editBy\s*\|\|\s*""/, "addEmpresa persists editBy");
assert.match(editor, /const currentUserEditBy\s*=/, "editor computes current user editBy label");
assert.match(editor, /editBy:\s*currentUserEditBy/, "company save sets editBy");
assert.match(editor, /empresaEditSnapshots/, "editor stores edit snapshots");
assert.match(editor, /const empresaHasChanges\s*=/, "editor compares current company against snapshot");
assert.match(editor, /editBy:\s*empresaHasChanges[\s\S]*\? currentUserEditBy : e\.editBy/, "company save preserves editBy when unchanged");
assert.match(editor, /currentUser\?\.role === "superadmin"[\s\S]*Editado por/, "superadmin-only editBy card is rendered");
assert.match(editor, /Unico cierre[\s\S]*Verificacion sistemas/, "read-only cards include the two missing company flags");
assert.match(dataEditor, /\[originalEmpresasData, setOriginalEmpresasData\]/, "bulk save keeps original empresas for comparison");
assert.match(dataEditor, /const empresaHasChanges\s*=/, "bulk save compares company changes");
assert.match(dataEditor, /editBy:\s*empresaHasChanges[\s\S]*\? currentUserEditBy : empresa\.editBy/, "bulk save preserves editBy when unchanged");
