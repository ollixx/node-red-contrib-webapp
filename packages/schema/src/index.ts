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

export {
    uiActionNodeDefinitionSchema,
    uiAppNodeDefinitionSchema,
    uiButtonNodeDefinitionSchema,
    uiContainerNodeDefinitionSchema,
    uiDialogNodeDefinitionSchema,
    uiInputNodeDefinitionSchema,
    uiLayoutNodeDefinitionSchema,
    uiNavigationNodeDefinitionSchema,
    uiNodeDefinitionSchema,
    uiQueryNodeDefinitionSchema,
    uiRouteNodeDefinitionSchema,
    uiSlotNodeDefinitionSchema,
    uiStoreNodeDefinitionSchema,
    uiTableNodeDefinitionSchema,
    uiTextNodeDefinitionSchema,
    validateUiNodeDefinition
} from "./node-definitions";
export type {
    UiActionNodeDefinition,
    UiAppNodeDefinition,
    UiButtonNodeDefinition,
    UiContainerNodeDefinition,
    UiDialogNodeDefinition,
    UiInputNodeDefinition,
    UiLayoutNodeDefinition,
    UiNavigationNodeDefinition,
    UiNodeDefinition,
    UiQueryNodeDefinition,
    UiRouteNodeDefinition,
    UiSlotNodeDefinition,
    UiStoreNodeDefinition,
    UiTableNodeDefinition,
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
