export {
  createAnnotationKey,
  createAnnotationTargetKey,
  createDiffAnnotationIdentityKey,
  createDraftDiffAnnotation,
} from "@/diff-viewer/annotations/identity"
export {
  createSavedAnnotation,
  getSavedAnnotationsForDiff,
  pruneSavedAnnotationsForDiff,
  pruneSavedAnnotationsForFiles,
  removeSavedAnnotation,
  upsertSavedAnnotation,
} from "@/diff-viewer/annotations/lifecycle"
export { formatSavedAnnotationsForCopy } from "@/diff-viewer/annotations/format"
export { findPatchMetadataForAnnotation } from "@/diff-viewer/annotations/patch-metadata"
export { loadSavedAnnotations, persistSavedAnnotations } from "@/diff-viewer/annotations/storage"

export type {
  DraftDiffAnnotation,
  SavedAnnotationTarget,
  SaveDiffAnnotationInput,
  SavedDiffAnnotation,
  SavedDiffPatchMetadata,
} from "@/diff-viewer/annotations/types"
