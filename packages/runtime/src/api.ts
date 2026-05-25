import type { AppModel } from "@node-red-contrib-webapp/schema";

import type { CompilationResult, RuntimeDiagnostic, RuntimeRegistry } from "./registry";

export interface CompiledAppModelPayload {
    appId: string;
    model?: AppModel;
    diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeApiRequest {
    method: string;
    path: string;
}

export interface RuntimeApiResponse {
    status: number;
    body: CompiledAppModelPayload | { error: string };
}

export interface RuntimeApi {
    getCompiledAppModel(appId: string): CompiledAppModelPayload;
    handle(request: RuntimeApiRequest): RuntimeApiResponse;
}

function toPayload(result: CompilationResult): CompiledAppModelPayload {
    return {
        appId: result.appId,
        model: result.model,
        diagnostics: result.diagnostics
    };
}

function getStatusCode(result: CompilationResult): number {
    if (result.model) {
        return 200;
    }

    if (result.diagnostics.some((diagnostic) => diagnostic.code === "missing-app")) {
        return 404;
    }

    return 422;
}

export function createRuntimeApi(registry: Pick<RuntimeRegistry, "compile">): RuntimeApi {
    return {
        getCompiledAppModel(appId: string): CompiledAppModelPayload {
            return toPayload(registry.compile(appId));
        },

        handle(request: RuntimeApiRequest): RuntimeApiResponse {
            if (request.method.toUpperCase() !== "GET") {
                return {
                    status: 405,
                    body: {
                        error: "Only GET requests are supported."
                    }
                };
            }

            const pathMatch = /^\/apps\/([^/]+)\/model$/.exec(request.path);

            if (!pathMatch) {
                return {
                    status: 404,
                    body: {
                        error: "Unknown runtime API path."
                    }
                };
            }

            const appId = decodeURIComponent(pathMatch[1]);
            const result = registry.compile(appId);

            return {
                status: getStatusCode(result),
                body: toPayload(result)
            };
        }
    };
}