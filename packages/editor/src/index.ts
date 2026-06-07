export const packageName = "@node-red-contrib-webapp/editor";

export { emitNodeDefinition, nodeSet, validateEditorNodeConfig } from "./nodes";
export {
    buildEditorStructureView,
    findStructureItem,
    findUnknownStoreBindings,
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
    UiNavigationEditorConfig,
    UiQueryEditorConfig,
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