import type { LayoutDefinition, RouteDefinition } from "./contracts";

export const standardLayoutPresetIds = ["horizontal", "vertical", "app", "grid", "absolute", "dialog", "breadcrumb"] as const;

export type StandardLayoutPresetId = (typeof standardLayoutPresetIds)[number];

const standardLayoutPresets: Record<StandardLayoutPresetId, LayoutDefinition> = {
    horizontal: {
        id: "horizontal",
        title: "Horizontal",
        slots: [{ name: "content" }]
    },
    vertical: {
        id: "vertical",
        title: "Vertical",
        slots: [{ name: "content" }]
    },
    app: {
        id: "app",
        title: "App",
        slots: [{ name: "header" }, { name: "navbar" }, { name: "content" }, { name: "footer" }]
    },
    grid: {
        id: "grid",
        title: "Grid",
        slots: [{ name: "content" }]
    },
    absolute: {
        id: "absolute",
        title: "Absolute",
        slots: [{ name: "content" }]
    },
    // P64: dialog layout preset. Its slots map onto the native <sl-dialog> slots:
    //   header         → sl-dialog `label`          (the dialog title region)
    //   header-actions → sl-dialog `header-actions` (controls beside the native X)
    //   content        → sl-dialog default slot     (the dialog body)
    //   footer         → sl-dialog `footer`
    dialog: {
        id: "dialog",
        title: "Dialog",
        slots: [{ name: "header" }, { name: "header-actions" }, { name: "content" }, { name: "footer" }]
    },
    // P95: breadcrumb layout preset — allows child nodes to be used as breadcrumb
    // items (slot "default") or as a custom separator (slot "separator").
    //   default   → each child becomes a <sl-breadcrumb-item> wrapper; click emits
    //               the child node's id as params.action
    //   separator → child(ren) rendered into the sl-breadcrumb separator slot
    breadcrumb: {
        id: "breadcrumb",
        title: "Breadcrumb",
        slots: [{ name: "default" }, { name: "separator" }]
    }
};

export function isStandardLayoutPreset(value: string): value is StandardLayoutPresetId {
    return standardLayoutPresetIds.includes(value as StandardLayoutPresetId);
}

export function getStandardLayoutPresetDefinition(layoutId: string): LayoutDefinition | undefined {
    if (!isStandardLayoutPreset(layoutId)) {
        return undefined;
    }

    const definition = standardLayoutPresets[layoutId];

    return {
        id: definition.id,
        title: definition.title,
        slots: definition.slots.map((slot) => ({ ...slot }))
    };
}

export function collectMissingStandardLayouts(layoutIds: Iterable<string>, existingLayoutIds: Iterable<string>): LayoutDefinition[] {
    const existing = new Set(existingLayoutIds);
    const missing = new Set<StandardLayoutPresetId>();

    for (const layoutId of layoutIds) {
        if (isStandardLayoutPreset(layoutId) && !existing.has(layoutId)) {
            missing.add(layoutId);
        }
    }

    return [...missing]
        .sort((left, right) => left.localeCompare(right))
        .map((layoutId) => getStandardLayoutPresetDefinition(layoutId))
        .filter((layout): layout is LayoutDefinition => layout !== undefined);
}

export function createAppRootRoute(appId: string, appTitle: string | undefined, layoutId: StandardLayoutPresetId): RouteDefinition {
    return {
        id: appId,
        path: "/",
        title: appTitle,
        layoutId
    };
}