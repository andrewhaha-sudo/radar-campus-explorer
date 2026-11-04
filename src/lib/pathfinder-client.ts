import type { SceneId } from "../components/map/campus-data.ts";
import { parseFloorDocument } from "./floorplan.ts";
import type { createFloorDocument } from "./floorplan.ts";
type FloorDocument = ReturnType<typeof createFloorDocument>;
/** Publishing is additive: never replace a shared floor or another staff member's notes. */
export async function publishFloorDraft(
  id: SceneId,
  document: FloorDocument,
  request: typeof fetch = fetch,
): Promise<string> {
  const annotations = parseFloorDocument(JSON.stringify(document), id);
  const auth = await request("/api/auth/me");
  if (!auth.ok)
    throw new Error(
      "Sign in to Facilities with a staff account before publishing.",
    );
  const { user } = await auth.json();
  if (!["staff", "admin"].includes(user?.role))
    throw new Error("A staff or administrator account is required to publish.");
  const manifest = await request("/campus-registry.json");
  if (!manifest.ok)
    throw new Error("The shared campus workspace is not configured.");
  const rows = await manifest.json();
  const floor = Array.isArray(rows)
    ? rows.find((row: Record<string, unknown>) => row.sceneId === id)
    : null;
  if (
    !floor ||
    JSON.stringify(floor.sourceRegistration) !==
      JSON.stringify(document.radar.registration)
  )
    throw new Error(
      "The shared floor drawing does not match this device draft.",
    );
  const pdf = await request(
    `/api/documents/${encodeURIComponent(floor.documentId)}/file`,
    { method: "HEAD" },
  );
  if (!pdf.ok)
    throw new Error(
      "The shared floor PDF is unavailable. Ask an administrator to initialize its object storage.",
    );
  const created = await request("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: floor.projectId,
      filename: `${floor.name} - device draft ${new Date().toISOString()}.pdf`,
      storage_key: floor.storageKey,
      page_count: 1,
      doc_type: "floorplan",
      mime_type: "application/pdf",
    }),
  });
  if (!created.ok)
    throw new Error(
      "The shared document could not be created. Your local draft is unchanged.",
    );
  const data = await created.json();
  const docId = data.document?.id;
  if (typeof docId !== "string" || !docId)
    throw new Error("The shared server returned an invalid document ID.");
  const saved = await request(
    `/api/documents/${encodeURIComponent(docId)}/annotations`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ annotations }),
    },
  );
  if (!saved.ok)
    throw new Error(
      "The document was created but its annotations could not be saved. Keep your local draft and retry.",
    );
  const result = await saved.json();
  if (!result.ok || result.count !== annotations.length)
    throw new Error(
      "The shared server did not confirm every annotation. Keep your local draft.",
    );
  return docId;
}
