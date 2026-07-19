/**
 * 文件职责 / File responsibility
 * 定义插件清单、语义版本兼容检查、依赖解析、能力冲突和插件生命周期。
 * Defines plugin manifests, semantic-version compatibility checks, dependency resolution, capability conflicts, and plugin lifecycle.
 */
export interface PluginCapability {
    id: string;
    version?: string;
    exclusive?: boolean;
}
export interface YkPetsPluginManifest {
    schema: 'yk-pets.plugin/v1';
    id: string;
    name: string;
    version: string;
    description?: string;
    engines: {
        ykPets: string;
        petCore?: string;
        api?: string;
    };
    entrypoints: {
        browser?: string;
        worker?: string;
        server?: string;
        styles?: string[];
    };
    capabilities?: {
        provides?: PluginCapability[];
        requires?: PluginCapability[];
    };
    permissions?: {
        tools?: string[];
        scopes?: string[];
        origins?: string[];
    };
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    integrity?: {
        algorithm: 'sha256';
        digest: string;
    };
}
export interface PluginContext {
    manifest: YkPetsPluginManifest;
    getPlugin(id: string): PluginModule | undefined;
    resolveCapability(id: string): PluginModule | undefined;
}
export interface PluginModule {
    activate?(context: PluginContext): void | Promise<void>;
    deactivate?(): void | Promise<void>;
    [key: string]: unknown;
}
export type PluginStatus = 'registered' | 'active' | 'failed' | 'disabled';
export interface RegisteredPlugin {
    manifest: YkPetsPluginManifest;
    module: PluginModule;
    status: PluginStatus;
    error?: string;
}
export interface PluginRuntimeEnvironment {
    ykPetsVersion: string;
    petCoreVersion?: string;
    apiVersion?: string;
    allowedTools?: string[];
    allowedScopes?: string[];
    allowedOrigins?: string[];
}
export interface CompatibilityIssue {
    code: string;
    message: string;
    path: string;
    severity: 'error' | 'warning';
}
export interface CompatibilityReport {
    compatible: boolean;
    issues: CompatibilityIssue[];
}
export declare class PluginRegistry {
    #private;
    readonly environment: PluginRuntimeEnvironment;
    constructor(environment: PluginRuntimeEnvironment);
    register(manifest: YkPetsPluginManifest, module: PluginModule): RegisteredPlugin;
    unregister(id: string): boolean;
    get(id: string): RegisteredPlugin | undefined;
    list(): RegisteredPlugin[];
    resolveCapability(id: string): PluginModule | undefined;
    activationOrder(ids?: string[]): string[];
    activate(ids?: string[]): Promise<string[]>;
    deactivate(ids?: string[]): Promise<string[]>;
}
export declare class PluginCompatibilityError extends Error {
    readonly report: CompatibilityReport;
    constructor(report: CompatibilityReport);
}
export declare function validatePluginManifest(manifest: YkPetsPluginManifest): CompatibilityIssue[];
export declare function checkPluginCompatibility(manifest: YkPetsPluginManifest, environment: PluginRuntimeEnvironment): CompatibilityReport;
interface SemVersion {
    major: number;
    minor: number;
    patch: number;
    prerelease?: string;
}
export declare function parseVersion(input: string): SemVersion | null;
export declare function compareVersions(a: string, b: string): number;
export declare function satisfiesVersion(version: string, range: string): boolean;
export declare function isValidRange(range: string): boolean;
export {};
//# sourceMappingURL=index.d.ts.map