import { NextRequest, NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import {
  applyTemplateAliasInputData,
  buildInitialInputData,
  normalizeDocumentType,
  normalizeFolderGenerationPath,
  normalizeTemplateSchema,
  renderDocumentHtml,
  renderTemplateFileNamePattern,
  sanitizeGeneratedFileName,
  validateTemplateInput,
  withNumericSuffix,
} from "@/lib/document-generation";
import {
  assertWorkInTenant,
  canEditGeneratedDocument,
  insertGeneratedDocumentEvent,
  loadDocumentGenerationPermissions,
  syncGeneratedDocumentExtractionRows,
  validateGenerationTarget,
} from "@/lib/document-generation-server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type GenerateRequestBody = {
  draftId?: string;
  generatedDocumentId?: string;
  workId?: string;
  folderPath?: string;
  documentType?: string;
  templateId?: string;
  fileName?: string;
  inputData?: Record<string, unknown>;
};

const DOCUMENTS_BUCKET = "obra-documents";

async function rollbackGeneratedDocumentArtifacts(params: {
  access: {
    supabase: Awaited<ReturnType<typeof resolveRequestAccessContext>>["supabase"];
  };
  generatedDocumentId?: string | null;
  storagePath: string;
  tablaCount?: number;
}) {
  const { supabase } = params.access;
  const admin = createSupabaseAdminClient();

  if (params.generatedDocumentId) {
    const { error } = await supabase
      .from("generated_documents")
      .delete()
      .eq("id", params.generatedDocumentId);
    if (error) {
      console.error("[document-generation/generate] rollback generated document failed", error);
    }
  }

  const { error: deleteRowsError } = await supabase
    .from("obra_tabla_rows")
    .delete()
    .contains("data", { __docPath: params.storagePath });
  if (deleteRowsError) {
    console.error("[document-generation/generate] rollback extraction rows failed", deleteRowsError);
  }

  const { error: uploadTrackingDeleteError } = await supabase
    .from("obra_document_uploads")
    .delete()
    .eq("storage_path", params.storagePath);
  if (uploadTrackingDeleteError) {
    console.error("[document-generation/generate] rollback upload tracking failed", uploadTrackingDeleteError);
  }

  const { error: storageDeleteError } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .remove([params.storagePath]);
  if (storageDeleteError) {
    console.error("[document-generation/generate] rollback storage cleanup failed", storageDeleteError);
  }
}

function buildDocumentFileName(params: {
  documentType: string;
  workName: string;
  folderPath: string;
  fileName?: string | null;
  inputData: Record<string, unknown>;
}) {
  const requestedFileName = typeof params.fileName === "string" ? params.fileName.trim() : "";
  if (requestedFileName) {
    const withExtension = /\.pdf$/i.test(requestedFileName) ? requestedFileName : `${requestedFileName}.pdf`;
    return sanitizeGeneratedFileName(withExtension);
  }

  const numberLike =
    typeof params.inputData.certificateNumber === "string"
      ? params.inputData.certificateNumber
      : typeof params.inputData.orderNumber === "string"
        ? params.inputData.orderNumber
        : typeof params.inputData.invoiceNumber === "string"
          ? params.inputData.invoiceNumber
          : "";
  const stem = [
    params.documentType.toLowerCase(),
    params.workName.toLowerCase().replace(/\s+/g, "-"),
    numberLike ? String(numberLike).toLowerCase() : "",
  ]
    .filter(Boolean)
    .join("-");
  return sanitizeGeneratedFileName(`${stem || params.folderPath}.pdf`);
}

function isAlreadyExistsError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  const statusCode = Number((error as { statusCode?: number | string })?.statusCode ?? 0);
  return (
    statusCode === 409 ||
    message.includes("already exists") ||
    message.includes("duplicate") ||
    message.includes("resource already exists")
  );
}

const REGENERATED_STATUS = "UNDER_REVIEW";

async function ensureUploadTracking(params: {
  supabase: Awaited<ReturnType<typeof resolveRequestAccessContext>>["supabase"];
  workId: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  userId: string;
  skipIfExists?: boolean;
}) {
  if (params.skipIfExists) {
    const { data: existingTracking, error: existingTrackingError } = await params.supabase
      .from("obra_document_uploads")
      .select("id")
      .eq("storage_path", params.storagePath)
      .maybeSingle();
    if (existingTrackingError) throw existingTrackingError;
    if (existingTracking) {
      return;
    }
  }

  const { error } = await params.supabase.from("obra_document_uploads").upsert(
    {
      obra_id: params.workId,
      storage_bucket: params.storageBucket,
      storage_path: params.storagePath,
      file_name: params.fileName,
      uploaded_by: params.userId,
    },
    { onConflict: "storage_path" },
  );
  if (error) throw error;
}

async function generatedStoragePathIsAvailable(
  supabase: Awaited<ReturnType<typeof resolveRequestAccessContext>>["supabase"],
  storagePath: string,
) {
  const [{ data: generated, error: generatedError }, { data: upload, error: uploadError }] = await Promise.all([
    supabase.from("generated_documents").select("id").eq("storage_path", storagePath).maybeSingle(),
    supabase.from("obra_document_uploads").select("id").eq("storage_path", storagePath).maybeSingle(),
  ]);
  if (generatedError) throw generatedError;
  if (uploadError) throw uploadError;
  return !generated && !upload;
}

export async function POST(request: NextRequest) {
  try {
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId, actorType } = access;
    const admin = createSupabaseAdminClient();

    if (!user && actorType !== "demo") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!tenantId || !user?.id) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    const accessContext = {
      supabase,
      tenantId,
      userId: user.id,
    };
    const permissions = await loadDocumentGenerationPermissions(accessContext);
    if (!permissions.canCreate) {
      return NextResponse.json({ error: "Sin permisos para generar documentos." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as GenerateRequestBody;
    if (body.draftId && body.generatedDocumentId) {
      return NextResponse.json(
        { error: "No se puede regenerar un documento y usar un borrador al mismo tiempo." },
        { status: 400 },
      );
    }

    let workId = typeof body.workId === "string" ? body.workId : "";
    let folderPath = normalizeFolderGenerationPath(body.folderPath);
    let documentType = normalizeDocumentType(body.documentType);
    let templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
    let inputData =
      body.inputData && typeof body.inputData === "object" && !Array.isArray(body.inputData)
        ? body.inputData
        : {};
    let sourceDraftId: string | null = null;
    let editingGeneratedDocument:
      | {
          id: string;
          storageBucket: string | null;
          storagePath: string;
          fileName: string;
          status: string;
          sourceDraftId: string | null;
        }
      | null = null;

    if (typeof body.draftId === "string" && body.draftId.trim()) {
      const { data: draft, error: draftError } = await supabase
        .from("generated_document_drafts")
        .select("*")
        .eq("id", body.draftId.trim())
        .eq("created_by", user.id)
        .maybeSingle();
      if (draftError) throw draftError;
      if (!draft) {
        return NextResponse.json({ error: "Borrador no encontrado" }, { status: 404 });
      }
      workId = draft.obra_id as string;
      folderPath = normalizeFolderGenerationPath(draft.folder_path);
      documentType = normalizeDocumentType(draft.document_type);
      templateId = String(draft.template_id ?? "");
      inputData =
        draft.input_data && typeof draft.input_data === "object" && !Array.isArray(draft.input_data)
          ? (draft.input_data as Record<string, unknown>)
          : inputData;
      sourceDraftId = String(draft.id);
    }

    if (typeof body.generatedDocumentId === "string" && body.generatedDocumentId.trim()) {
      const { data: existingGeneratedDocument, error: existingGeneratedDocumentError } = await supabase
        .from("generated_documents")
        .select(
          "id, obra_id, folder_path, document_type, template_id, source_draft_id, storage_bucket, storage_path, file_name, status, generated_by, input_data",
        )
        .eq("id", body.generatedDocumentId.trim())
        .maybeSingle();
      if (existingGeneratedDocumentError) throw existingGeneratedDocumentError;
      if (!existingGeneratedDocument) {
        return NextResponse.json({ error: "Documento generado no encontrado" }, { status: 404 });
      }
      if (
        !canEditGeneratedDocument({
          canCreate: permissions.canCreate,
          userId: user.id,
          generatedBy:
            typeof existingGeneratedDocument.generated_by === "string"
              ? existingGeneratedDocument.generated_by
              : null,
          status:
            typeof existingGeneratedDocument.status === "string"
              ? existingGeneratedDocument.status
              : null,
        })
      ) {
        return NextResponse.json(
          { error: "Solo puedes editar documentos tuyos que aun no fueron aprobados." },
          { status: 403 },
        );
      }

      workId = String(existingGeneratedDocument.obra_id ?? workId);
      folderPath = normalizeFolderGenerationPath(existingGeneratedDocument.folder_path);
      documentType = normalizeDocumentType(existingGeneratedDocument.document_type);
      templateId = templateId || String(existingGeneratedDocument.template_id ?? "");
      inputData =
        body.inputData && typeof body.inputData === "object" && !Array.isArray(body.inputData)
          ? body.inputData
          : existingGeneratedDocument.input_data &&
              typeof existingGeneratedDocument.input_data === "object" &&
              !Array.isArray(existingGeneratedDocument.input_data)
            ? (existingGeneratedDocument.input_data as Record<string, unknown>)
            : inputData;
      sourceDraftId =
        typeof existingGeneratedDocument.source_draft_id === "string"
          ? existingGeneratedDocument.source_draft_id
          : null;
      editingGeneratedDocument = {
        id: String(existingGeneratedDocument.id),
        storageBucket:
          typeof existingGeneratedDocument.storage_bucket === "string"
            ? existingGeneratedDocument.storage_bucket
            : null,
        storagePath: String(existingGeneratedDocument.storage_path ?? ""),
        fileName: String(existingGeneratedDocument.file_name ?? ""),
        status: String(existingGeneratedDocument.status ?? REGENERATED_STATUS),
        sourceDraftId,
      };
    }

    if (!workId) {
      return NextResponse.json({ error: "No se puede generar un documento sin obra." }, { status: 400 });
    }
    if (!folderPath) {
      return NextResponse.json({ error: "No se puede generar un documento sin carpeta destino." }, { status: 400 });
    }
    if (!documentType) {
      return NextResponse.json({ error: "Falta el tipo documental." }, { status: 400 });
    }
    if (!templateId) {
      return NextResponse.json({ error: "No hay una plantilla activa para generar este tipo de documento." }, { status: 400 });
    }

    const work = await assertWorkInTenant(supabase, tenantId, workId);
    if (!work) {
      return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
    }

    const targetValidation = await validateGenerationTarget(
      accessContext,
      { workId, folderPath, documentType },
    );
    if (!targetValidation.valid) {
      return NextResponse.json({ error: targetValidation.error }, { status: 400 });
    }

    const { data: template, error: templateError } = await supabase
      .from("document_generation_templates")
      .select("id, name, version, document_type, target_folder_path, schema, content_html")
      .eq("id", templateId)
      .eq("status", "active")
      .maybeSingle();
    if (templateError) throw templateError;
    if (!template) {
      return NextResponse.json({ error: "No hay una plantilla activa para generar este tipo de documento." }, { status: 400 });
    }

    const templateDocumentType = normalizeDocumentType(template.document_type);
    const templateFolderPath = normalizeFolderGenerationPath(template.target_folder_path);
    if (templateDocumentType !== documentType) {
      return NextResponse.json({ error: "La plantilla seleccionada no corresponde al tipo documental." }, { status: 400 });
    }
    if (templateFolderPath && templateFolderPath !== folderPath) {
      return NextResponse.json({ error: "La plantilla seleccionada no corresponde a la carpeta destino." }, { status: 400 });
    }

    const schema = normalizeTemplateSchema(template.schema);
    const hydratedInputData = applyTemplateAliasInputData(schema, buildInitialInputData(schema, inputData));
    const validationErrors = validateTemplateInput(schema, hydratedInputData);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "No se puede generar documento con campos obligatorios incompletos.", validationErrors },
        { status: 400 },
      );
    }

    const workName = [work.n != null ? String(work.n) : "", work.designacion_y_ubicacion ?? ""]
      .filter(Boolean)
      .join(" ")
      .trim();

    const html = renderDocumentHtml(template.content_html as string, hydratedInputData, {
      workName,
      generatedAt: new Date().toLocaleDateString("es-AR"),
    });
    const pdfHtml = `${html}<style>.oc{--oc-font-size:12px !important;}</style>`;

    const pdfResponse = await fetch(new URL("/api/pdf-render", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: pdfHtml,
        options: {
          companyName: "Síntesis",
          reportTitle: String(template.name ?? "Documento"),
          date: new Date().toLocaleDateString("es-AR"),
          format: "A4",
          landscape: false,
        },
      }),
    });

    if (!pdfResponse.ok) {
      const payload = await pdfResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: typeof payload.error === "string" ? payload.error : "No se pudo renderizar el PDF." },
        { status: 500 },
      );
    }

    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    const baseFileName = buildDocumentFileName({
      documentType,
      workName: workName || workId,
      folderPath,
      fileName:
        typeof body.fileName === "string" && body.fileName.trim()
          ? body.fileName
          : renderTemplateFileNamePattern(schema.fileNamePattern, hydratedInputData, {
              templateName: String(template.name ?? ""),
              documentType,
              workName,
              folderPath,
              documentNumberFieldKey: schema.documentNumberFieldKey,
            }),
      inputData: hydratedInputData,
    });

    let storagePath = "";
    let finalFileName = baseFileName;
    if (editingGeneratedDocument) {
      storagePath = editingGeneratedDocument.storagePath;
      finalFileName = editingGeneratedDocument.fileName;
      const { error: uploadError } = await admin.storage
        .from(editingGeneratedDocument.storageBucket || DOCUMENTS_BUCKET)
        .upload(storagePath, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (uploadError) {
        throw uploadError;
      }
    } else {
      let uploaded = false;
      for (let attempt = 1; attempt <= 200; attempt += 1) {
        finalFileName = withNumericSuffix(baseFileName, attempt);
        storagePath = `${workId}/${folderPath}/${finalFileName}`;
        if (!(await generatedStoragePathIsAvailable(supabase, storagePath))) {
          continue;
        }
        const { error: uploadError } = await admin.storage
          .from(DOCUMENTS_BUCKET)
          .upload(storagePath, pdfBytes, {
            contentType: "application/pdf",
            upsert: false,
          });
        if (!uploadError) {
          uploaded = true;
          break;
        }
        if (!isAlreadyExistsError(uploadError)) {
          throw uploadError;
        }
        if (attempt === 200) {
          throw uploadError;
        }
      }
      if (!uploaded) {
        throw new Error("No se pudo encontrar un nombre disponible para guardar el documento.");
      }
    }

    try {
      await ensureUploadTracking({
        supabase,
        workId,
        storageBucket: editingGeneratedDocument?.storageBucket || DOCUMENTS_BUCKET,
        storagePath,
        fileName: finalFileName,
        userId: user.id,
        skipIfExists: Boolean(editingGeneratedDocument),
      });
    } catch (uploadTrackingError) {
      console.error("[document-generation/generate] upload tracking failed", uploadTrackingError);
    }

    let generatedDocument: Record<string, unknown> | null = null;
    if (editingGeneratedDocument) {
      const { data, error } = await supabase
        .from("generated_documents")
        .update({
          folder_path: folderPath,
          document_type: documentType,
          template_id: template.id,
          template_version: Number(template.version) || 1,
          source_draft_id: sourceDraftId,
          storage_bucket: editingGeneratedDocument.storageBucket || DOCUMENTS_BUCKET,
          storage_path: storagePath,
          file_name: finalFileName,
          status: REGENERATED_STATUS,
          input_data: hydratedInputData,
          generated_at: new Date().toISOString(),
        })
        .eq("id", editingGeneratedDocument.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      generatedDocument = data;
    } else {
      const { data, error } = await supabase
        .from("generated_documents")
        .insert({
          tenant_id: tenantId,
          obra_id: workId,
          folder_path: folderPath,
          document_type: documentType,
          template_id: template.id,
          template_version: Number(template.version) || 1,
          source_draft_id: sourceDraftId,
          storage_bucket: DOCUMENTS_BUCKET,
          storage_path: storagePath,
          file_name: finalFileName,
          status: REGENERATED_STATUS,
          input_data: hydratedInputData,
          generated_by: user.id,
        })
        .select("*")
        .maybeSingle();
      if (error) {
        await rollbackGeneratedDocumentArtifacts({
          access: { supabase },
          storagePath,
        });
        throw error;
      }
      generatedDocument = data;
    }

    try {
      const syncedTableCount = await syncGeneratedDocumentExtractionRows({
        access: accessContext,
        workId,
        folderPath,
        documentType,
        schema,
        inputData: hydratedInputData,
        documentMeta: {
          bucket: DOCUMENTS_BUCKET,
          path: storagePath,
          fileName: finalFileName,
        },
      });
      if (syncedTableCount === 0) {
        throw new Error(
          "La carpeta destino no tiene una tabla de extraccion materializada para guardar los datos del documento.",
        );
      }
    } catch (syncError) {
      if (!editingGeneratedDocument) {
        await rollbackGeneratedDocumentArtifacts({
          access: { supabase },
          generatedDocumentId: String(generatedDocument?.id ?? ""),
          storagePath,
        });
      }
      throw syncError;
    }

    if (sourceDraftId) {
      const { error: draftSyncError } = await supabase
        .from("generated_document_drafts")
        .update({
          status: "READY_TO_GENERATE",
          validation_errors: [],
          input_data: hydratedInputData,
        })
        .eq("id", sourceDraftId)
        .eq("created_by", user.id);
      if (draftSyncError) {
        console.error("[document-generation/generate] draft sync failed", draftSyncError);
      }
    }

    try {
      await insertGeneratedDocumentEvent(
        { supabase, tenantId, userId: user.id },
        String(generatedDocument?.id),
        editingGeneratedDocument ? "DocumentRegenerated" : "DocumentGenerated",
        {
          workId,
          folderPath,
          documentType,
          templateId: template.id,
          fileName: finalFileName,
          storagePath,
          sourceDraftId,
          generatedDocumentId: editingGeneratedDocument?.id ?? null,
        },
        editingGeneratedDocument?.status ?? null,
        REGENERATED_STATUS,
      );
    } catch (eventError) {
      console.error("[document-generation/generate] event logging failed", eventError);
    }

    return NextResponse.json({
      generatedDocument,
      relativeFolderPath: folderPath,
      relativeFilePath: `${folderPath}/${finalFileName}`,
      previewHtml: html,
    });
  } catch (error) {
    console.error("[document-generation/generate]", error);
    const message = error instanceof Error ? error.message : "Error al generar documento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
