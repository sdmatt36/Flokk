import { db } from "@/lib/db";

export type ExtractionLogInput = {
  senderEmail: string;
  subject?: string | null;
  resolutionPath: "profile_member" | "direct_user" | "delegate" | "none";
  familyProfileId?: string | null;
  extractedType?: string | null;
  matchedTripId?: string | null;
  autoCreatedTripId?: string | null;
  itineraryItemIds?: string[];
  tripDocumentId?: string | null;
  confidenceScore?: number | null;
  outcome: "success" | "partial" | "dropped" | "error" | "duplicate_skipped" | "duplicate_merged" | "duplicate_attached" | "cancellation_matched" | "cancellation_unmatched" | "cancellation_ambiguous" | "attachment_unreadable" | "cancellation_restored";
  errorMessage?: string | null;
  rawEmailSize?: number | null;
  rawEmail?: string | null;
  attachmentCount?: number | null;
  attachmentMimeTypes?: string[];
  attachmentSizeBytes?: number | null;
};

export async function logExtraction(input: ExtractionLogInput): Promise<void> {
  try {
    await db.extractionLog.create({
      data: {
        senderEmail: input.senderEmail.toLowerCase(),
        subject: input.subject ?? null,
        resolutionPath: input.resolutionPath,
        familyProfileId: input.familyProfileId ?? null,
        extractedType: input.extractedType ?? null,
        matchedTripId: input.matchedTripId ?? null,
        autoCreatedTripId: input.autoCreatedTripId ?? null,
        itineraryItemIds: input.itineraryItemIds ?? [],
        tripDocumentId: input.tripDocumentId ?? null,
        confidenceScore: input.confidenceScore ?? null,
        outcome: input.outcome,
        errorMessage: input.errorMessage ?? null,
        rawEmailSize: input.rawEmailSize ?? null,
        rawEmail: input.rawEmail ?? null,
        attachmentCount: input.attachmentCount ?? null,
        attachmentMimeTypes: input.attachmentMimeTypes ?? [],
        attachmentSizeBytes: input.attachmentSizeBytes ?? null,
      },
    });
  } catch (e) {
    console.error("[extraction-log] failed to write", e);
  }
}
