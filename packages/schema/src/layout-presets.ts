import type { LayoutDefinition, RouteDefinition } from "./contracts";

export const standardLayoutPresetIds = ["horizontal", "vertical", "app"] as const;

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

export function createAppRootRoute(appId: string, appTitle: string | undefined, layoutId: string): RouteDefinition {
    return {
        id: appId,
        path: "/",
        title: appTitle,
        layoutId
    };
}