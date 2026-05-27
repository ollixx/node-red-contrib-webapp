export const packageName = "@node-red-contrib-webapp/editor";

export { emitNodeDefinition, nodeSet, validateEditorNodeConfig } from "./nodes";
export {
    buildEditorStructureView,
    findStructureItem,
    selectFromCanvas,
    selectFromStructure
} from "./structure-view";
export type {
    EditorValidationIssue,
    IdentifiedEditorConfig,
    NodeEditorConfig,
    NodeEditorDefinition,
    NodeEditorType,
    UiActionEditorConfig,
    UiAppEditorConfig,
    UiButtonEditorConfig,
    UiContainerEditorConfig,
    UiDialogEditorConfig,
    UiInputEditorConfig,
    UiLayoutEditorConfig,
    UiNavigationEditorConfig,
    UiQueryEditorConfig,
    UiRouteEditorConfig,
    UiSlotEditorConfig,
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