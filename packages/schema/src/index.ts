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
    uiAlertNodeDefinitionSchema,
    uiAppNodeDefinitionSchema,
    uiBadgeNodeDefinitionSchema,
    uiButtonNodeDefinitionSchema,
    uiCheckboxNodeDefinitionSchema,
    uiContainerNodeDefinitionSchema,
    uiDatepickerNodeDefinitionSchema,
    uiDialogNodeDefinitionSchema,
    uiEmptyStateNodeDefinitionSchema,
    uiInputNodeDefinitionSchema,
    uiNavigationNodeDefinitionSchema,
    uiNodeDefinitionSchema,
    uiProgressNodeDefinitionSchema,
    uiQueryNodeDefinitionSchema,
    uiRadioNodeDefinitionSchema,
    uiRouteNodeDefinitionSchema,
    uiSelectNodeDefinitionSchema,
    uiSkeletonNodeDefinitionSchema,
    uiSliderNodeDefinitionSchema,
    uiStoreNodeDefinitionSchema,
    uiSwitchNodeDefinitionSchema,
    uiTableNodeDefinitionSchema,
    uiTextareaNodeDefinitionSchema,
    uiTextNodeDefinitionSchema,
    uiToastNodeDefinitionSchema,
    validateUiNodeDefinition
} from "./node-definitions";
export type {
    UiActionNodeDefinition,
    UiAlertNodeDefinition,
    UiAppNodeDefinition,
    UiBadgeNodeDefinition,
    UiButtonNodeDefinition,
    UiCheckboxNodeDefinition,
    UiContainerNodeDefinition,
    UiDatepickerNodeDefinition,
    UiDialogNodeDefinition,
    UiEmptyStateNodeDefinition,
    UiInputNodeDefinition,
    UiNavigationNodeDefinition,
    UiNodeDefinition,
    UiProgressNodeDefinition,
    UiQueryNodeDefinition,
    UiRadioNodeDefinition,
    UiRouteNodeDefinition,
    UiSelectNodeDefinition,
    UiSkeletonNodeDefinition,
    UiSliderNodeDefinition,
    UiStoreNodeDefinition,
    UiSwitchNodeDefinition,
    UiTableNodeDefinition,
    UiTextareaNodeDefinition,
    UiTextNodeDefinition,
    UiToastNodeDefinition
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
