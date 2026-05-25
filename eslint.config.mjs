import js from "@eslint/js";
import tseslint from "typescript-eslint";

const nodeGlobals = {
    require: "readonly",
    module: "writable",
    exports: "writable",
    __dirname: "readonly",
    __filename: "readonly",
    process: "readonly",
    Buffer: "readonly",
    console: "readonly",
    setTimeout: "readonly",
    clearTimeout: "readonly",
    setInterval: "readonly",
    clearInterval: "readonly",
};

export default tseslint.config(
    {
        ignores: ["**/dist/**", "**/coverage/**"]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        }
    },
    {
        files: ["nodes/**/*.js"],
        languageOptions: {
            sourceType: "commonjs",
            globals: nodeGlobals,
        },
        rules: {
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/no-this-alias": "off",
            "no-undef": "off",
        }
    }
);
