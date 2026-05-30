export const packageName = "@node-red-contrib-webapp/schema";

export {
    actionDefinitionSchema,
    actionTargetModeSchema,
    actionTypeSchema,
    appModelSchema,
    bindingSchema,
    componentDefinitionSchema,
    componentEventHandlerSchema,
    dialogDefinitionSchema,
    layoutDefinitionSchema,
    navigationDefinitionSchema,
    queryDefinitionSchema,
    runtimeIntegrationModelSchema,
    slotDefinitionSchema,
    routeDefinitionSchema,
    storeOperationSchema,
    storeDefinitionSchema,
    uiEventMessageSchema,
    uiStoreMessageSchema
} from "./contracts";
export {
    collectMissingStandardLayouts,
    createAppRootRoute,
    getStandardLayoutPresetDefinition,
    isStandardLayoutPreset,
    standardLayoutPresetIds
} from "./layout-presets";
export type {
    ActionDefinition,
    ActionTargetMode,
    ActionType,
    AppModel,
    BindingDefinition,
    ComponentDefinition,
    ComponentEventHandler,
    DialogDefinition,
    LayoutDefinition,
    NavigationDefinition,
    QueryDefinition,
    RuntimeIntegrationModel,
    RouteDefinition,
    SlotDefinition,
    StoreOperation,
    StoreDefinition,
    UiEventMessage,
    UiStoreMessage
} from "./contracts";
export type { StandardLayoutPresetId } from "./layout-presets";

export {
    uiActionNodeDefinitionSchema,
    uiAppNodeDefinitionSchema,
    uiButtonNodeDefinitionSchema,
    uiCheckboxNodeDefinitionSchema,
    uiContainerNodeDefinitionSchema,
    uiDatepickerNodeDefinitionSchema,
    uiDialogNodeDefinitionSchema,
    uiInputNodeDefinitionSchema,
    uiNavigationNodeDefinitionSchema,
    uiNodeDefinitionSchema,
    uiQueryNodeDefinitionSchema,
    uiRadioNodeDefinitionSchema,
    uiRouteNodeDefinitionSchema,
    uiSelectNodeDefinitionSchema,
    uiSliderNodeDefinitionSchema,
    uiStoreNodeDefinitionSchema,
    uiSwitchNodeDefinitionSchema,
    uiTableNodeDefinitionSchema,
    uiTextareaNodeDefinitionSchema,
    uiTextNodeDefinitionSchema,
    validateUiNodeDefinition
} from "./node-definitions";
export type {
    UiActionNodeDefinition,
    UiAppNodeDefinition,
    UiButtonNodeDefinition,
    UiCheckboxNodeDefinition,
    UiContainerNodeDefinition,
    UiDatepickerNodeDefinition,
    UiDialogNodeDefinition,
    UiInputNodeDefinition,
    UiNavigationNodeDefinition,
    UiNodeDefinition,
    UiQueryNodeDefinition,
    UiRadioNodeDefinition,
    UiRouteNodeDefinition,
    UiSelectNodeDefinition,
    UiSliderNodeDefinition,
    UiStoreNodeDefinition,
    UiSwitchNodeDefinition,
    UiTableNodeDefinition,
    UiTextareaNodeDefinition,
    UiTextNodeDefinition
} from "./node-definitions";

export {
    formatMountResolutionError,
    formatValidationIssues,
    parseMountReference,
    resolveMountReference,
    validateAppModel,
    validateMountReference
} from "./validation";
export type {
    MountResolution,
    MountScope,
    ParsedMountReference,
    ParsedNamedMountReference,
    ParsedRouteMountReference
} from "./validation";

export {
    customersCrudAppModelFixture,
    customersCrudExampleFlowFixture,
    customersCrudNodeSetFixture,
    customersCrudRuntimeIntegrationFixture,
    fixtureAppModels,
    operationsConsoleAppModelFixture
} from "./fixtures";
