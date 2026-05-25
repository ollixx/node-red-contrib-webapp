export const packageName = "@node-red-contrib-webapp/editor";

export { emitNodeDefinition, nodeSet, validateEditorNodeConfig } from "./nodes";
export {
    buildEditorStructureView,
    findStructureItem,
    selectFromCanvas,
    selectFromStructure
} from "./structure-view";
export type {
    AppScopedEditorConfig,
    EditorValidationIssue,
    NodeEditorConfig,
    NodeEditorDefinition,
    NodeEditorType,
    UiActionEditorConfig,
    UiAppEditorConfig,
    UiButtonEditorConfig,
    UiDialogEditorConfig,
    UiFormEditorConfig,
    UiLayoutEditorConfig,
    UiNavigationEditorConfig,
    UiQueryEditorConfig,
    UiRegionEditorConfig,
    UiRouteEditorConfig,
    UiStoreEditorConfig,
    UiTableEditorConfig,
    UiTextEditorConfig
} from "./nodes";
export type {
    CompiledRegistrySnapshot,
    EditorStructureDiagnostic,
    EditorStructureItem,
    EditorStructureSelection,
    EditorStructureView,
    MountableEditorSourceNode
} from "./structure-view";