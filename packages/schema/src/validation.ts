import type { ZodIssue } from "zod";

import {
    appModelSchema,
    type AppModel,
    type LayoutDefinition,
    type SlotDefinition,
    type RouteDefinition
} from "./contracts";

export type MountScope = "route" | "dialog" | "layout" | "named";

interface ParsedMountReferenceBase {
    raw: string;
    scope: MountScope;
}

export interface ParsedRouteMountReference extends ParsedMountReferenceBase {
    scope: "route";
    targetPathWithRegions: string;
}

export interface ParsedNamedMountReference extends ParsedMountReferenceBase {
    scope: "dialog" | "layout" | "named";
    target: string;
    regionPath: string[];
}

export type ParsedMountReference = ParsedRouteMountReference | ParsedNamedMountReference;

export interface MountResolution {
    scope: "route" | "dialog" | "layout";
    targetId: string;
    layoutId: string;
    regionPath: string[];
    routePath?: string;
}

type Result<T> =
    | { success: true; data: T }
    | { success: false; error: string };

function splitMountRegionPath(rawRegionPath: string): string[] {
    return rawRegionPath.split("/").filter(Boolean);
}

function splitNamedMountReference(rawMount: string): Result<ParsedNamedMountReference> {
    const segments = rawMount.split(".").filter(Boolean);

    if (segments.length < 2) {
        return {
            success: false,
            error: "Named mounts must use '<target>.<region>' syntax."
        };
    }

    const [target, ...regionPath] = segments;

    if (!target) {
        return {
            success: false,
            error: "Named mounts must include a target before the first '.'."
        };
    }

    return {
        success: true,
        data: {
            raw: rawMount,
            scope: "named",
            target,
            regionPath
        }
    };
}

function splitScopedMountReference(scope: "dialog" | "layout", rawTarget: string, rawMount: string): Result<ParsedNamedMountReference> {
    const [target, ...regionPath] = rawTarget.split("/").filter(Boolean);

    if (!target) {
        return {
            success: false,
            error: `${scope} mounts must include a target before the first '/'.`
        };
    }

    if (regionPath.length === 0) {
        return {
            success: false,
            error: `${scope} mounts must include at least one region after the target.`
        };
    }

    return {
        success: true,
        data: {
            raw: rawMount,
            scope,
            target,
            regionPath
        }
    };
}

export function parseMountReference(rawMount: string): Result<ParsedMountReference> {
    const trimmedMount = rawMount.trim();

    if (trimmedMount.length === 0) {
        return {
            success: false,
            error: "Mounts must not be empty."
        };
    }

    const explicitScopeMatch = /^([a-z]+):(.*)$/.exec(trimmedMount);

    if (!explicitScopeMatch) {
        return splitNamedMountReference(trimmedMount);
    }

    const [, scope, rawTarget] = explicitScopeMatch;

    if (scope === "route") {
        if (!rawTarget.startsWith("/")) {
            return {
                success: false,
                error: "Route mounts must start with 'route:/' so they can be matched against route paths."
            };
        }

        const pathSegments = splitMountRegionPath(rawTarget);

        if (pathSegments.length < 2) {
            return {
                success: false,
                error: "Route mounts must include a route path and at least one region, for example 'route:/customers/content'."
            };
        }

        return {
            success: true,
            data: {
                raw: trimmedMount,
                scope: "route",
                targetPathWithRegions: rawTarget
            }
        };
    }

    if (scope === "dialog" || scope === "layout") {
        return splitScopedMountReference(scope, rawTarget, trimmedMount);
    }

    return {
        success: false,
        error: `Unsupported mount scope '${scope}'. Supported scopes are route, dialog, and layout.`
    };
}

function findLayout(layouts: LayoutDefinition[], layoutId: string): LayoutDefinition | undefined {
    return layouts.find((layout) => layout.id === layoutId);
}

function findSlot(slotDefinitions: SlotDefinition[], slotName: string): SlotDefinition | undefined {
    return slotDefinitions.find((slot) => slot.name === slotName);
}

function hasSlotPath(layout: LayoutDefinition, regionPath: string[]): boolean {
    return regionPath.length === 1 && findSlot(layout.slots, regionPath[0]) !== undefined;
}

function resolveRouteMount(parsedMount: ParsedRouteMountReference, routes: RouteDefinition[]): Result<{ route: RouteDefinition; regionPath: string[] }> {
    const matchingRoutes = routes
        .map((route) => {
            const routePrefix = `${route.path}/`;

            if (!parsedMount.targetPathWithRegions.startsWith(routePrefix)) {
                return undefined;
            }

            const rawRegionPath = parsedMount.targetPathWithRegions.slice(routePrefix.length);
            const regionPath = splitMountRegionPath(rawRegionPath);

            if (regionPath.length === 0) {
                return undefined;
            }

            return { route, regionPath };
        })
        .filter((candidate): candidate is { route: RouteDefinition; regionPath: string[] } => candidate !== undefined)
        .sort((left, right) => right.route.path.length - left.route.path.length);

    const resolvedMount = matchingRoutes[0];

    if (!resolvedMount) {
        return {
            success: false,
            error: `Route mount '${parsedMount.raw}' does not match any declared route path.`
        };
    }

    return {
        success: true,
        data: resolvedMount
    };
}

function resolveNamedMount(parsedMount: ParsedNamedMountReference, appModel: AppModel): Result<MountResolution> {
    if (parsedMount.scope === "dialog") {
        const dialog = appModel.dialogs.find((candidate) => candidate.id === parsedMount.target);

        if (!dialog) {
            return {
                success: false,
                error: `Dialog mount '${parsedMount.raw}' references unknown dialog '${parsedMount.target}'.`
            };
        }

        return {
            success: true,
            data: {
                scope: "dialog",
                targetId: dialog.id,
                layoutId: dialog.layoutId,
                regionPath: parsedMount.regionPath
            }
        };
    }

    if (parsedMount.scope === "layout") {
        const layout = appModel.layouts.find((candidate) => candidate.id === parsedMount.target);

        if (!layout) {
            return {
                success: false,
                error: `Layout mount '${parsedMount.raw}' references unknown layout '${parsedMount.target}'.`
            };
        }

        return {
            success: true,
            data: {
                scope: "layout",
                targetId: layout.id,
                layoutId: layout.id,
                regionPath: parsedMount.regionPath
            }
        };
    }

    const routeMatch = appModel.routes.find((route) => route.id === parsedMount.target);
    const dialogMatch = appModel.dialogs.find((dialog) => dialog.id === parsedMount.target);
    const layoutMatch = appModel.layouts.find((layout) => layout.id === parsedMount.target);

    const matches = [routeMatch ? "route" : undefined, dialogMatch ? "dialog" : undefined, layoutMatch ? "layout" : undefined].filter(
        (value): value is "route" | "dialog" | "layout" => value !== undefined
    );

    if (matches.length === 0) {
        return {
            success: false,
            error: `Named mount '${parsedMount.raw}' does not match any route, dialog, or layout ID.`
        };
    }

    if (matches.length > 1) {
        return {
            success: false,
            error: `Named mount '${parsedMount.raw}' is ambiguous because '${parsedMount.target}' matches multiple target types.`
        };
    }

    if (routeMatch) {
        return {
            success: true,
            data: {
                scope: "route",
                targetId: routeMatch.id,
                layoutId: routeMatch.layoutId,
                regionPath: parsedMount.regionPath,
                routePath: routeMatch.path
            }
        };
    }

    if (dialogMatch) {
        return {
            success: true,
            data: {
                scope: "dialog",
                targetId: dialogMatch.id,
                layoutId: dialogMatch.layoutId,
                regionPath: parsedMount.regionPath
            }
        };
    }

    return {
        success: true,
        data: {
            scope: "layout",
            targetId: parsedMount.target,
            layoutId: parsedMount.target,
            regionPath: parsedMount.regionPath
        }
    };
}

export function resolveMountReference(rawMount: string, appModel: AppModel): Result<MountResolution> {
    const parsedMount = parseMountReference(rawMount);

    if (!parsedMount.success) {
        return parsedMount;
    }

    if (parsedMount.data.scope === "route") {
        const resolvedRoute = resolveRouteMount(parsedMount.data, appModel.routes);

        if (!resolvedRoute.success) {
            return resolvedRoute;
        }

        return {
            success: true,
            data: {
                scope: "route",
                targetId: resolvedRoute.data.route.id,
                layoutId: resolvedRoute.data.route.layoutId,
                regionPath: resolvedRoute.data.regionPath,
                routePath: resolvedRoute.data.route.path
            }
        };
    }

    return resolveNamedMount(parsedMount.data, appModel);
}

function addDuplicateIssues(values: string[], issuePrefix: string, issuePathPrefix: (string | number)[], issues: ZodIssue[]): void {
    const seenValues = new Map<string, number>();

    values.forEach((value, index) => {
        const originalIndex = seenValues.get(value);

        if (originalIndex !== undefined) {
            issues.push({
                code: "custom",
                message: `${issuePrefix} '${value}' is declared more than once.`,
                path: [...issuePathPrefix, index]
            });
            return;
        }

        seenValues.set(value, index);
    });
}

function collectAppModelIssues(appModel: AppModel): ZodIssue[] {
    const issues: ZodIssue[] = [];

    addDuplicateIssues(
        appModel.layouts.map((layout) => layout.id),
        "Layout ID",
        ["layouts"],
        issues
    );
    addDuplicateIssues(
        appModel.routes.map((route) => route.id),
        "Route ID",
        ["routes"],
        issues
    );
    addDuplicateIssues(
        appModel.routes.map((route) => route.path),
        "Route path",
        ["routes"],
        issues
    );
    addDuplicateIssues(
        appModel.dialogs.map((dialog) => dialog.id),
        "Dialog ID",
        ["dialogs"],
        issues
    );
    addDuplicateIssues(
        appModel.components.map((component) => component.id),
        "Component ID",
        ["components"],
        issues
    );

    appModel.routes.forEach((route, index) => {
        if (!findLayout(appModel.layouts, route.layoutId)) {
            issues.push({
                code: "custom",
                message: `Route '${route.id}' references unknown layout '${route.layoutId}'.`,
                path: ["routes", index, "layoutId"]
            });
        }
    });

    appModel.dialogs.forEach((dialog, index) => {
        if (!findLayout(appModel.layouts, dialog.layoutId)) {
            issues.push({
                code: "custom",
                message: `Dialog '${dialog.id}' references unknown layout '${dialog.layoutId}'.`,
                path: ["dialogs", index, "layoutId"]
            });
        }

        if (dialog.routeId && !appModel.routes.some((route) => route.id === dialog.routeId)) {
            issues.push({
                code: "custom",
                message: `Dialog '${dialog.id}' references unknown route '${dialog.routeId}'.`,
                path: ["dialogs", index, "routeId"]
            });
        }
    });

    appModel.components.forEach((component, index) => {
        const resolvedMount = resolveMountReference(component.mount, appModel);

        if (!resolvedMount.success) {
            issues.push({
                code: "custom",
                message: resolvedMount.error,
                path: ["components", index, "mount"]
            });
            return;
        }

        const targetLayout = findLayout(appModel.layouts, resolvedMount.data.layoutId);

        if (!targetLayout) {
            issues.push({
                code: "custom",
                message: `Component '${component.id}' resolves to missing layout '${resolvedMount.data.layoutId}'.`,
                path: ["components", index, "mount"]
            });
            return;
        }

        if (!hasSlotPath(targetLayout, resolvedMount.data.regionPath)) {
            issues.push({
                code: "custom",
                message: `Mount '${component.mount}' resolves to missing slot path '${resolvedMount.data.regionPath.join("/")}' in layout '${targetLayout.id}'. Nested slot paths are not supported; use a ui-container with a child layout.`,
                path: ["components", index, "mount"]
            });
        }
    });

    return issues;
}

export function validateMountReference(rawMount: string, appModel: AppModel): Result<MountResolution> {
    return resolveMountReference(rawMount, appModel);
}

export function validateAppModel(input: unknown): Result<AppModel> {
    const schemaResult = appModelSchema.safeParse(input);

    if (!schemaResult.success) {
        return {
            success: false,
            error: formatValidationIssues(schemaResult.error.issues)
        };
    }

    const issues = collectAppModelIssues(schemaResult.data);

    if (issues.length > 0) {
        return {
            success: false,
            error: formatValidationIssues(issues)
        };
    }

    return {
        success: true,
        data: schemaResult.data
    };
}

export function formatValidationIssues(issues: readonly ZodIssue[]): string {
    return issues
        .map((issue) => {
            const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
            return `${path}${issue.message}`;
        })
        .join("\n");
}

export function formatMountResolutionError(rawMount: string, appModel: AppModel): string | undefined {
    const result = validateMountReference(rawMount, appModel);
    return result.success ? undefined : result.error;
}
