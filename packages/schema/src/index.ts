export const packageName = "@node-red-contrib-webapp/schema";

export {
    actionDefinitionSchema,
    appModelSchema,
    bindingSchema,
    componentDefinitionSchema,
    componentEventHandlerSchema,
    dialogDefinitionSchema,
    layoutDefinitionSchema,
    navigationDefinitionSchema,
    queryDefinitionSchema,
    regionDefinitionSchema,
    runtimeIntegrationModelSchema,
    routeDefinitionSchema,
    storeDefinitionSchema,
    uiEventMessageSchema
} from "./contracts";
export type {
    ActionDefinition,
    AppModel,
    BindingDefinition,
    ComponentDefinition,
    ComponentEventHandler,
    DialogDefinition,
    LayoutDefinition,
    NavigationDefinition,
    QueryDefinition,
    RegionDefinition,
    RuntimeIntegrationModel,
    RouteDefinition,
    StoreDefinition,
    UiEventMessage
} from "./contracts";

export {
    uiActionNodeDefinitionSchema,
    uiAppNodeDefinitionSchema,
    uiButtonNodeDefinitionSchema,
    uiDialogNodeDefinitionSchema,
    uiFormNodeDefinitionSchema,
    uiLayoutNodeDefinitionSchema,
    uiNavigationNodeDefinitionSchema,
    uiNodeDefinitionSchema,
    uiQueryNodeDefinitionSchema,
    uiRegionNodeDefinitionSchema,
    uiRouteNodeDefinitionSchema,
    uiStoreNodeDefinitionSchema,
    uiTableNodeDefinitionSchema,
    uiTextNodeDefinitionSchema,
    validateUiNodeDefinition
} from "./node-definitions";
export type {
    UiActionNodeDefinition,
    UiAppNodeDefinition,
    UiButtonNodeDefinition,
    UiDialogNodeDefinition,
    UiFormNodeDefinition,
    UiLayoutNodeDefinition,
    UiNavigationNodeDefinition,
    UiNodeDefinition,
    UiQueryNodeDefinition,
    UiRegionNodeDefinition,
    UiRouteNodeDefinition,
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
