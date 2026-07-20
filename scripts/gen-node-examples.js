#!/usr/bin/env node
/**
 * gen-node-examples.js
 *
 * Generates one comprehensive, importable example flow per node type.
 * Each example shows ALL relevant features:
 *   - every documented prop set to a meaningful value
 *   - inject nodes to test incoming messages (msg.payload → primary field,
 *     function nodes for component ops: show/hide/enable/disable/reset)
 *   - debug node(s) wired to the output port(s) so events are visible
 *     in the Node-RED debug sidebar
 *
 * Output: examples/<category>/<node-name>.json
 *
 * Usage:
 *   node scripts/gen-node-examples.js
 *   pnpm gen:node-examples
 *
 * DO NOT hand-edit the generated files — re-run this script instead.
 * Regenerate whenever a node's fields, events, or input behaviour changes.
 */

"use strict";

const { writeFileSync, mkdirSync } = require("node:fs");
const { resolve, dirname } = require("node:path");

const ROOT = resolve(__dirname, "..");

// ── helpers ───────────────────────────────────────────────────────────────────

function write(relPath, nodes) {
    const abs = resolve(ROOT, relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(nodes, null, 2) + "\n");
    console.log("  wrote", relPath);
}

// Standard Node-RED structural nodes
function tab(id, label) {
    return { id, type: "tab", label, disabled: false, info: "" };
}

function uiApp(id, tabId, overrides = {}) {
    return { id, type: "ui-app", name: overrides.name ?? id, uiId: id, root: id, layout: "app", z: tabId, x: 120, y: 80, wires: [[]], ...overrides };
}

function uiRoute(id, path, appId, tabId, overrides = {}) {
    return { id, type: "ui-route", name: id, uiId: id, path, parent: appId, layoutId: "vertical", z: tabId, x: 120, y: 180, wires: [[]], ...overrides };
}

// Inject node that sends msg.payload (updates primary field of any view node)
function injectPayload(id, tabId, label, payload, payloadType, targetId, y) {
    return {
        id, type: "inject", name: label, z: tabId,
        x: 120, y,
        payload, payloadType,
        repeat: "", crontab: "", once: false, onceDelay: 0,
        wires: [[targetId]]
    };
}

// Function node that sets msg.ui.component.op for show/hide/enable/disable/reset
function componentOpFn(id, tabId, op, targetId, y) {
    const labels = { show: "→ show", hide: "→ hide", enable: "→ enable", disable: "→ disable", reset: "→ reset", focus: "→ focus" };
    return {
        id, type: "function", name: labels[op] ?? op, z: tabId,
        func: `msg.ui = { component: { op: "${op}" } };\nreturn msg;`,
        outputs: 1, noerr: 0,
        x: 380, y,
        wires: [[targetId]]
    };
}

// Trigger inject that fires a function node (inject → fn → node)
function injectTrigger(id, tabId, label, targetId, y) {
    return {
        id, type: "inject", name: label, z: tabId,
        x: 120, y,
        payload: "", payloadType: "date",
        repeat: "", crontab: "", once: false, onceDelay: 0,
        wires: [[targetId]]
    };
}

// Debug node — sits on the right, receives a node's output
function debugNode(id, tabId, label, y) {
    return {
        id, type: "debug", name: label, z: tabId,
        x: 700, y,
        active: true, tosidebar: true,
        complete: "ui", targetType: "msg",
        wires: [[]]
    };
}

// View node (renders in a route slot)
function viewNode(type, id, appId, routeId, tabId, overrides = {}) {
    const y = overrides.y ?? 280;
    const x = overrides.x ?? 480;
    delete overrides.x; delete overrides.y;
    return {
        id, type, name: overrides.name ?? id, uiId: id,
        parent: appId, mount: `${routeId}.content`,
        z: tabId, x, y, wires: [[]], ...overrides
    };
}

// State/behavior node (no mount)
function stateNode(type, id, appId, tabId, overrides = {}) {
    const y = overrides.y ?? 380;
    const x = overrides.x ?? 480;
    delete overrides.x; delete overrides.y;
    return {
        id, type, name: overrides.name ?? id, uiId: id,
        parent: appId,
        z: tabId, x, y, wires: [[]], ...overrides
    };
}

// ── examples ──────────────────────────────────────────────────────────────────

const examples = [];

// ════════════════════════════════════════════════════════════════════════
// STRUCTURE
// ════════════════════════════════════════════════════════════════════════

// ui-app ──────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-app"; const A = "myApp"; const R = A;
    examples.push({
        path: "examples/structure/ui-app.json",
        nodes: [
            tab(T, "ui-app example"),
            // layout:"app" on the ui-app node renders a coloured top bar on ALL
            // routes of this app, regardless of the individual route's layoutId.
            // tokens override the CSS custom properties used by the top bar.
            // The ui-app is the implicit root route ("/") — no ui-route node is
            // needed for the home page; content mounts into the app's content slot.
            uiApp(A, T, {
                name: "My App",
                layout: "app",
                tokens: JSON.stringify({ colorPrimary: "#2563eb" })
            }),
            // Simple content so there is something to see when the app loads
            viewNode("ui-text", "appInfo", A, R, T, {
                name: "app info",
                text: "Open /webapp/myApp/ in your browser. The top bar colour comes from the tokens field on the ui-app node."
            })
        ]
    });
}

// ui-route ────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-route"; const A = "routeApp";
    examples.push({
        path: "examples/structure/ui-route.json",
        nodes: [
            tab(T, "ui-route example"),
            uiApp(A, T, { name: "Route App" }),

            // The app is the implicit root route ("/"). One explicit sub-route
            // with a :id param demonstrates the ui-route node.
            uiRoute("routeDetail", "/item/:id", A, T, { layoutId: "vertical", x: 120, y: 260 }),

            // Home page content mounts directly into the ui-app content slot.
            viewNode("ui-text", "homeText", A, A, T, {
                name: "home text", text: "Home — navigate to /webapp/routeApp/item/42 to see the detail route."
            }),

            // Detail page shows the :id route param bound from the URL
            viewNode("ui-text", "detailText", A, "routeDetail", T, {
                name: "detail text", x: 480, y: 360,
                text: "Detail route. The :id param is available as a route param binding."
            }),

            // Navigate action wired from home button
            viewNode("ui-button", "goDetailBtn", A, A, T, {
                name: "go to detail", label: "Go to Item 42", x: 480, y: 360
            }),
            {
                id: "navToDetail", type: "ui-action", name: "navigate → /item/42",
                uiId: "navToDetail", parent: A, actionType: "navigate", target: "/item/42",
                z: T, x: 700, y: 360, wires: [[]]
            }
        ]
    });
}

// ui-dialog ───────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-dialog"; const A = "dlgApp"; const R = A;
    examples.push({
        path: "examples/structure/ui-dialog.json",
        nodes: [
            tab(T, "ui-dialog example"),
            uiApp(A, T, { name: "Dialog App" }),

            // The dialog — mounts to the app, not a route
            {
                id: "myDialog", type: "ui-dialog", name: "Confirm Action",
                uiId: "myDialog", parent: A, title: "Confirm Action",
                z: T, x: 120, y: 360, wires: [[]]
            },

            // Trigger button on the main route
            viewNode("ui-button", "openBtn", A, R, T, { name: "open dialog", label: "Open Dialog" }),

            // Content inside the dialog
            viewNode("ui-text", "dlgText", A, R, T, {
                name: "dialog text", mount: "myDialog.content",
                text: "Are you sure you want to proceed?", x: 480, y: 440
            }),
            viewNode("ui-button", "dlgConfirmBtn", A, R, T, {
                name: "confirm", mount: "myDialog.content", label: "Confirm", x: 480, y: 520
            }),
            viewNode("ui-button", "dlgCancelBtn", A, R, T, {
                name: "cancel", mount: "myDialog.content", label: "Cancel", x: 700, y: 520
            }),

            // Actions
            {
                id: "openDlgAction", type: "ui-action", name: "openDialog",
                uiId: "openDlgAction", parent: A, actionType: "openDialog", target: "myDialog",
                z: T, x: 700, y: 280, wires: [[]]
            },
            {
                id: "closeDlgAction", type: "ui-action", name: "closeDialog",
                uiId: "closeDlgAction", parent: A, actionType: "closeDialog", target: "myDialog",
                z: T, x: 900, y: 520, wires: [[]]
            }
        ]
    });
}

// ════════════════════════════════════════════════════════════════════════
// VIEW — display
// ════════════════════════════════════════════════════════════════════════

// ui-text ─────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-text"; const A = "textApp"; const R = A;
    const NODE = "textNode"; const DBG = "textDbg";
    examples.push({
        path: "examples/view/ui-text.json",
        nodes: [
            tab(T, "ui-text example"),
            uiApp(A, T, { name: "Text App" }),

            // Store provides dynamic value
            stateNode("ui-store", "textStore", A, T, {
                name: "text store", statePath: "label", initialValue: '"Hello from store"'
            }),

            // Literal text
            viewNode("ui-text", "staticText", A, R, T, {
                name: "static text", text: "Static text — always shows this string."
            }),
            // Store-bound text — updates when store changes
            viewNode("ui-text", NODE, A, R, T, {
                name: "store-bound text",
                value: { kind: "state", path: "label" },
                x: 480, y: 360
            }),

            // ui-text has no output port → no debug needed
            // Inject: update the store (which updates the bound text via SSE)
            injectPayload("inj-newVal", T, "Update text via store", "Updated at runtime!", "str", "textStore", 480),
            // Inject: update static text directly via msg.payload
            injectPayload("inj-direct", T, "Update static text directly", "Directly updated!", "str", "staticText", 560),

            // Show/hide ops via function nodes
            injectTrigger("inj-show", T, "show", "fn-show", 640),
            componentOpFn("fn-show", T, "show", NODE, 640),
            injectTrigger("inj-hide", T, "hide", "fn-hide", 720),
            componentOpFn("fn-hide", T, "hide", NODE, 720)
        ]
    });
}

// ui-button ───────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-button"; const A = "btnApp"; const R = A;
    const NODE = "btnNode"; const DBG = "btnDbg";
    examples.push({
        path: "examples/view/ui-button.json",
        nodes: [
            tab(T, "ui-button example"),
            uiApp(A, T, { name: "Button App" }),

            // The button — wired to debug so click events appear in the sidebar
            { ...viewNode("ui-button", NODE, A, R, T, { name: "primary button", label: "Click me", variant: "primary" }), wires: [[DBG]] },
            viewNode("ui-button", "btnDanger", A, R, T, { name: "danger button", label: "Delete", variant: "danger", x: 480, y: 360 }),
            viewNode("ui-button", "btnDisabled", A, R, T, {
                name: "disabled button", label: "Disabled",
                disabled: { kind: "literal", value: true }, x: 480, y: 440
            }),

            // Debug: shows msg.ui.event = "click" when button is clicked in browser
            debugNode(DBG, T, "click events", 280),

            // Inject: update button label at runtime
            injectPayload("inj-label", T, "Update label", "New Label!", "str", NODE, 540),
            // Enable/disable via function nodes
            injectTrigger("inj-disable", T, "disable", "fn-disable", 620),
            componentOpFn("fn-disable", T, "disable", NODE, 620),
            injectTrigger("inj-enable", T, "enable", "fn-enable", 700),
            componentOpFn("fn-enable", T, "enable", NODE, 700)
        ]
    });
}

// ui-image ─────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-image"; const A = "imgApp"; const R = A;
    const NODE = "imgNode"; const DBG = "imgDbg";
    examples.push({
        path: "examples/view/ui-image.json",
        nodes: [
            tab(T, "ui-image example"),
            uiApp(A, T, { name: "Image App" }),

            // Output: "error" event if the image src fails to load
            { ...viewNode("ui-image", NODE, A, R, T, {
                name: "hero image",
                src: "https://picsum.photos/seed/webapp/600/300",
                alt: "A placeholder image"
            }), wires: [[DBG]] },

            debugNode(DBG, T, "error events", 280),

            // Inject: swap image src at runtime (msg.payload = new URL)
            injectPayload("inj-src", T, "Swap image src", "https://picsum.photos/seed/changed/600/300", "str", NODE, 480),

            injectTrigger("inj-show", T, "show", "fn-show", 560),
            componentOpFn("fn-show", T, "show", NODE, 560),
            injectTrigger("inj-hide", T, "hide", "fn-hide", 640),
            componentOpFn("fn-hide", T, "hide", NODE, 640)
        ]
    });
}

// ui-avatar ───────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-avatar"; const A = "avatarApp"; const R = A;
    examples.push({
        path: "examples/view/ui-avatar.json",
        nodes: [
            tab(T, "ui-avatar example"),
            uiApp(A, T, { name: "Avatar App" }),

            viewNode("ui-avatar", "initialsAvatar", A, R, T, { name: "initials avatar", initials: "AK", label: "Anna K." }),
            viewNode("ui-avatar", "imgAvatar", A, R, T, {
                name: "photo avatar", src: "https://i.pravatar.cc/80", label: "Photo avatar", x: 480, y: 360
            }),

            // No output port — no debug needed
            // Inject: update avatar src at runtime
            injectPayload("inj-src", T, "Update src", "https://i.pravatar.cc/80?img=3", "str", "imgAvatar", 480),
            injectPayload("inj-initials", T, "Update initials", "MX", "str", "initialsAvatar", 560)
        ]
    });
}

// ════════════════════════════════════════════════════════════════════════
// VIEW — input controls (all emit "change" on output port)
// ════════════════════════════════════════════════════════════════════════

function inputNodeExample({ path, tabId, appId, routeId, nodeId, nodeType, nodeProps, injectValue, injectPayloadType, extraNodes = [] }) {
    const T = tabId; const A = appId; const R = A; const NODE = nodeId; const DBG = nodeId + "Dbg";
    return {
        path,
        nodes: [
            tab(T, nodeType + " example"),
            uiApp(A, T, { name: nodeType + " App" }),

            // The node — wired to debug so change events appear in sidebar
            { ...viewNode(nodeType, NODE, A, R, T, { name: nodeId, ...nodeProps }), wires: [[DBG]] },

            ...extraNodes,

            // Debug: shows msg.ui when user interacts in browser
            debugNode(DBG, T, "change / submit events", 280),

            // Inject: update the node's value at runtime
            injectPayload("inj-val", T, "Set value", injectValue, injectPayloadType, NODE, 500),
            // Component ops
            injectTrigger("inj-disable", T, "disable", "fn-disable", 580),
            componentOpFn("fn-disable", T, "disable", NODE, 580),
            injectTrigger("inj-enable", T, "enable", "fn-enable", 660),
            componentOpFn("fn-enable", T, "enable", NODE, 660),
            injectTrigger("inj-reset", T, "reset", "fn-reset", 740),
            componentOpFn("fn-reset", T, "reset", NODE, 740)
        ]
    };
}

examples.push(inputNodeExample({
    path: "examples/view/ui-input.json",
    tabId: "ex-ui-input", appId: "inputApp", routeId: "inputRoute", nodeId: "inputNode",
    nodeType: "ui-input",
    nodeProps: {
        label: "Full name", inputType: "text", placeholder: "Enter your name",
        value: { kind: "literal", value: "" }
    },
    injectValue: "Jane Doe", injectPayloadType: "str"
}));

examples.push(inputNodeExample({
    path: "examples/view/ui-textarea.json",
    tabId: "ex-ui-textarea", appId: "taApp", routeId: "taRoute", nodeId: "taNode",
    nodeType: "ui-textarea",
    nodeProps: {
        label: "Notes", placeholder: "Enter your notes…",
        rows: 4, value: { kind: "literal", value: "" }
    },
    injectValue: "Injected text content.", injectPayloadType: "str"
}));

examples.push(inputNodeExample({
    path: "examples/view/ui-checkbox.json",
    tabId: "ex-ui-checkbox", appId: "cbApp", routeId: "cbRoute", nodeId: "cbNode",
    nodeType: "ui-checkbox",
    nodeProps: { label: "I agree to the terms", value: { kind: "literal", value: false } },
    injectValue: "true", injectPayloadType: "str"
}));

examples.push(inputNodeExample({
    path: "examples/view/ui-switch.json",
    tabId: "ex-ui-switch", appId: "swApp", routeId: "swRoute", nodeId: "swNode",
    nodeType: "ui-switch",
    nodeProps: { label: "Dark mode", value: { kind: "literal", value: false } },
    injectValue: "true", injectPayloadType: "str"
}));

examples.push(inputNodeExample({
    path: "examples/view/ui-radio.json",
    tabId: "ex-ui-radio", appId: "radioApp", routeId: "radioRoute", nodeId: "radioNode",
    nodeType: "ui-radio",
    nodeProps: {
        label: "Size",
        optionsJson: JSON.stringify([{ label: "Small", value: "s" }, { label: "Medium", value: "m" }, { label: "Large", value: "l" }]),
        value: { kind: "literal", value: "m" }
    },
    injectValue: "l", injectPayloadType: "str"
}));

examples.push(inputNodeExample({
    path: "examples/view/ui-select.json",
    tabId: "ex-ui-select", appId: "selApp", routeId: "selRoute", nodeId: "selNode",
    nodeType: "ui-select",
    nodeProps: {
        // P133: label is a binding; options is a single json|store binding.
        label: { kind: "literal", value: "Country" },
        options: { kind: "literal", value: [{ label: "Germany", value: "de" }, { label: "Austria", value: "at" }, { label: "Switzerland", value: "ch" }] },
        value: { kind: "literal", value: "" }
    },
    injectValue: "at", injectPayloadType: "str"
}));

examples.push(inputNodeExample({
    path: "examples/view/ui-slider.json",
    tabId: "ex-ui-slider", appId: "sliderApp", routeId: "sliderRoute", nodeId: "sliderNode",
    nodeType: "ui-slider",
    nodeProps: { label: "Volume", min: 0, max: 100, step: 5, showValue: true, value: { kind: "literal", value: 50 } },
    injectValue: "75", injectPayloadType: "str"
}));

examples.push(inputNodeExample({
    path: "examples/view/ui-datepicker.json",
    tabId: "ex-ui-datepicker", appId: "dpApp", routeId: "dpRoute", nodeId: "dpNode",
    nodeType: "ui-datepicker",
    nodeProps: { label: "Start date", value: { kind: "literal", value: "" } },
    injectValue: "2026-06-01", injectPayloadType: "str"
}));

// ════════════════════════════════════════════════════════════════════════
// VIEW — feedback
// ════════════════════════════════════════════════════════════════════════

// ui-badge ────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-badge"; const A = "badgeApp"; const R = A;
    examples.push({
        path: "examples/view/ui-badge.json",
        nodes: [
            tab(T, "ui-badge example"),
            uiApp(A, T, { name: "Badge App" }),

            // No output port — badge is display-only
            viewNode("ui-badge", "badgeSuccess", A, R, T, { name: "success badge", label: "Active", variant: "success" }),
            viewNode("ui-badge", "badgeWarning", A, R, T, { name: "warning badge", label: "Pending", variant: "warning", x: 480, y: 360 }),
            viewNode("ui-badge", "badgeDanger", A, R, T, { name: "danger badge", label: "Error", variant: "danger", x: 480, y: 440 }),
            viewNode("ui-badge", "badgeNeutral", A, R, T, { name: "neutral badge", label: "Archived", variant: "neutral", x: 480, y: 520 }),

            // Inject: update badge text at runtime
            injectPayload("inj-label", T, "Update badge label", "Updated!", "str", "badgeSuccess", 620),
            injectPayload("inj-patch", T, "Patch variant to danger",
                JSON.stringify({ variant: "danger", label: "Critical" }), "json", "badgeSuccess", 700)
        ]
    });
}

// ui-alert ────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-alert"; const A = "alertApp"; const R = A;
    const NODE = "alertNode"; const DBG = "alertDbg";
    examples.push({
        path: "examples/view/ui-alert.json",
        nodes: [
            tab(T, "ui-alert example"),
            uiApp(A, T, { name: "Alert App" }),

            // Output: "dismiss" event when user closes the alert
            // P67: message is a binding (typedInput) — pass a literal binding object.
            { ...viewNode("ui-alert", NODE, A, R, T, {
                name: "info alert", message: { kind: "literal", value: "This is an informational message." }, variant: "primary", closable: true
            }), wires: [[DBG]] },
            viewNode("ui-alert", "alertSuccess", A, R, T, { name: "success alert", message: { kind: "literal", value: "Action completed!" }, variant: "success", x: 480, y: 360 }),
            viewNode("ui-alert", "alertWarning", A, R, T, { name: "warning alert", message: { kind: "literal", value: "Disk almost full." }, variant: "warning", x: 480, y: 440 }),
            viewNode("ui-alert", "alertDanger", A, R, T, { name: "danger alert", message: { kind: "literal", value: "Something went wrong." }, variant: "danger", x: 480, y: 520 }),

            debugNode(DBG, T, "dismiss events", 280),

            // Inject: update alert message
            injectPayload("inj-msg", T, "Update message", "Updated alert message!", "str", NODE, 620),
            injectTrigger("inj-show", T, "show", "fn-show", 700),
            componentOpFn("fn-show", T, "show", NODE, 700),
            injectTrigger("inj-hide", T, "hide", "fn-hide", 780),
            componentOpFn("fn-hide", T, "hide", NODE, 780)
        ]
    });
}

// ui-progress ──────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-progress"; const A = "progApp"; const R = A;
    examples.push({
        path: "examples/view/ui-progress.json",
        nodes: [
            tab(T, "ui-progress example"),
            uiApp(A, T, { name: "Progress App" }),

            stateNode("ui-store", "progStore", A, T, {
                name: "progress store", statePath: "progress", initialValue: "25"
            }),

            // No output port
            viewNode("ui-progress", "progBar", A, R, T, {
                name: "progress bar", label: "Upload", value: { kind: "state", path: "progress" }
            }),
            viewNode("ui-progress", "progBarFixed", A, R, T, {
                name: "fixed 75%", label: "Fixed", value: { kind: "literal", value: 75 }, x: 480, y: 360
            }),

            // Inject: update via store
            injectPayload("inj-25", T, "Set 25%", "25", "str", "progStore", 480),
            injectPayload("inj-75", T, "Set 75%", "75", "str", "progStore", 560),
            injectPayload("inj-100", T, "Set 100%", "100", "str", "progStore", 640)
        ]
    });
}

// ui-skeleton ─────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-skeleton"; const A = "skelApp"; const R = A;
    examples.push({
        path: "examples/view/ui-skeleton.json",
        nodes: [
            tab(T, "ui-skeleton example"),
            uiApp(A, T, { name: "Skeleton App" }),

            // No output port — skeleton is display-only
            viewNode("ui-skeleton", "skelText", A, R, T, { name: "text skeleton", effect: "sheen" }),
            viewNode("ui-skeleton", "skelCircle", A, R, T, { name: "circle skeleton", shape: "circle", effect: "pulse", x: 480, y: 360 }),
            viewNode("ui-skeleton", "skelRect", A, R, T, { name: "rect skeleton", shape: "none", x: 480, y: 440 }),

            // Inject: show / hide skeleton (typically shown while data is loading)
            injectTrigger("inj-show", T, "show skeleton", "fn-show", 540),
            componentOpFn("fn-show", T, "show", "skelText", 540),
            injectTrigger("inj-hide", T, "hide skeleton", "fn-hide", 620),
            componentOpFn("fn-hide", T, "hide", "skelText", 620)
        ]
    });
}

// ui-empty-state ───────────────────────────────────────────────────────────────
{
    const T = "ex-ui-empty-state"; const A = "emptyApp"; const R = A;
    examples.push({
        path: "examples/view/ui-empty-state.json",
        nodes: [
            tab(T, "ui-empty-state example"),
            uiApp(A, T, { name: "Empty State App" }),

            // No output port
            viewNode("ui-empty-state", "noResults", A, R, T, {
                name: "no results", title: "No results found",
                description: "Try adjusting your search filters.", icon: "search"
            }),

            // Inject: show / hide (toggle visibility based on whether list has items)
            injectTrigger("inj-show", T, "show (no results)", "fn-show", 480),
            componentOpFn("fn-show", T, "show", "noResults", 480),
            injectTrigger("inj-hide", T, "hide (results found)", "fn-hide", 560),
            componentOpFn("fn-hide", T, "hide", "noResults", 560)
        ]
    });
}

// ui-toast ─────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-toast"; const A = "toastApp"; const R = A;
    const NODE = "toastNode"; const DBG = "toastDbg";
    examples.push({
        path: "examples/view/ui-toast.json",
        nodes: [
            tab(T, "ui-toast example"),
            uiApp(A, T, { name: "Toast App" }),

            // Output: "dismiss" event
            { ...viewNode("ui-toast", NODE, A, R, T, {
                name: "toast", message: "", variant: "primary", duration: 4000
            }), wires: [[DBG]] },

            debugNode(DBG, T, "dismiss events", 280),

            // Toast is triggered by sending msg.payload = message string
            injectPayload("inj-info", T, "Show info toast", "Operation completed!", "str", NODE, 480),
            injectPayload("inj-success", T, "Show success toast", "Saved successfully.", "str", NODE, 560),
            {
                // Show toast with custom variant via patch
                id: "inj-patch", type: "inject", name: "Show danger toast", z: T,
                x: 120, y: 640,
                payload: JSON.stringify({ message: "Something went wrong.", variant: "danger", duration: 6000 }),
                payloadType: "json",
                repeat: "", crontab: "", once: false, onceDelay: 0,
                wires: [["fn-patch"]]
            },
            {
                id: "fn-patch", type: "function", name: "→ patch", z: T,
                func: "msg.ui = { patch: msg.payload };\nmsg.payload = undefined;\nreturn msg;",
                outputs: 1, noerr: 0, x: 380, y: 640, wires: [[NODE]]
            }
        ]
    });
}

// ui-log ───────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-log"; const A = "logApp"; const R = A;
    const NODE = "logNode";
    examples.push({
        path: "examples/view/ui-log.json",
        nodes: [
            tab(T, "ui-log example"),
            // Enable error forwarding so the ui-log panel receives server errors.
            { ...uiApp(A, T, { name: "Log App" }), forwardErrorsToClient: true, forwardErrorMinSeverity: "debug" },

            // The ui-log panel — shows all severity levels, keeps last 100 entries.
            { ...viewNode("ui-log", NODE, A, R, T, {
                name: "log", minSeverity: "debug", maxEntries: 100, collapsed: false
            }), wires: [] }
        ]
    });
}

// ════════════════════════════════════════════════════════════════════════
// VIEW — display (no output)
// ════════════════════════════════════════════════════════════════════════

// ui-breadcrumb ───────────────────────────────────────────────────────────────
{
    const T = "ex-ui-breadcrumb"; const A = "breadApp"; const R = A;
    const NODE = "breadNode"; const DBG = "breadDbg";
    examples.push({
        path: "examples/view/ui-breadcrumb.json",
        nodes: [
            tab(T, "ui-breadcrumb example"),
            uiApp(A, T, { name: "Breadcrumb App" }),

            // Output: "click" event (params.action) when a crumb is clicked.
            // P95: items use {label, action?, active?}; all items are clickable.
            { ...viewNode("ui-breadcrumb", NODE, A, R, T, {
                name: "breadcrumb",
                items: JSON.stringify([
                    { label: "Home", action: "/" },
                    { label: "Products", action: "/products" },
                    { label: "Widget 42", active: true }
                ])
            }), wires: [[DBG]] },

            debugNode(DBG, T, "click events", 280),

            // Inject: update breadcrumb items at runtime
            injectPayload("inj-items", T, "Update breadcrumb",
                JSON.stringify([{ label: "Home", action: "/" }, { label: "Settings", active: true }]), "json", NODE, 480)
        ]
    });
}

// ════════════════════════════════════════════════════════════════════════
// COMPOSITE
// ════════════════════════════════════════════════════════════════════════

// ui-table ─────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-table"; const A = "tblApp"; const R = A;
    const NODE = "tblNode"; const DBG = "tblDbg";
    const ROWS = [
        { id: "1", name: "Alice Müller", role: "Admin", status: "active" },
        { id: "2", name: "Bob Schmidt", role: "Editor", status: "active" },
        { id: "3", name: "Carol Weber", role: "Viewer", status: "inactive" }
    ];
    examples.push({
        path: "examples/composite/ui-table.json",
        nodes: [
            tab(T, "ui-table example"),
            uiApp(A, T, { name: "Table App" }),

            stateNode("ui-store", "rowsStore", A, T, {
                name: "rows store", statePath: "users", initialValue: JSON.stringify(ROWS)
            }),

            // Output: rowSelect event (wired to debug)
            { ...viewNode("ui-table", NODE, A, R, T, {
                name: "users table",
                columns: JSON.stringify([
                    { key: "name", label: "Name" },
                    { key: "role", label: "Role" },
                    { key: "status", label: "Status" }
                ]),
                rows: { kind: "state", path: "users" }
            }), wires: [[DBG]] },

            debugNode(DBG, T, "rowSelect events", 280),

            // Inject: replace rows at runtime
            injectPayload("inj-rows", T, "Replace rows",
                JSON.stringify([
                    { id: "1", name: "Alice Müller", role: "Admin", status: "active" },
                    { id: "4", name: "Dave Neuer", role: "Editor", status: "active" }
                ]), "json", "rowsStore", 500),
            injectPayload("inj-clear", T, "Clear rows", "[]", "json", "rowsStore", 580),

            injectTrigger("inj-show", T, "show table", "fn-show", 660),
            componentOpFn("fn-show", T, "show", NODE, 660),
            injectTrigger("inj-hide", T, "hide table", "fn-hide", 740),
            componentOpFn("fn-hide", T, "hide", NODE, 740)
        ]
    });
}

// ui-container ─────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-container"; const A = "ctApp"; const R = A;
    const NODE = "ctNode"; const DBG = "ctDbg";
    examples.push({
        path: "examples/composite/ui-container.json",
        nodes: [
            tab(T, "ui-container example"),
            uiApp(A, T, { name: "Container App" }),

            // Output: onShow / onHide (if configured)
            { ...viewNode("ui-container", NODE, A, R, T, { name: "card", layoutId: "vertical" }), wires: [[DBG]] },

            // Children mounted inside the container
            viewNode("ui-text", "ctTitle", A, R, T, { name: "card title", mount: "ctNode.content", text: "Card title", x: 700, y: 200 }),
            viewNode("ui-text", "ctBody", A, R, T, { name: "card body", mount: "ctNode.content", text: "Card body text goes here.", x: 700, y: 280 }),
            viewNode("ui-button", "ctBtn", A, R, T, { name: "card button", mount: "ctNode.content", label: "Card Action", x: 700, y: 360 }),

            debugNode(DBG, T, "onShow / onHide events", 280),

            // Inject: show / hide the entire container
            injectTrigger("inj-show", T, "show container", "fn-show", 480),
            componentOpFn("fn-show", T, "show", NODE, 480),
            injectTrigger("inj-hide", T, "hide container", "fn-hide", 560),
            componentOpFn("fn-hide", T, "hide", NODE, 560)
        ]
    });
}

// ui-tabs ──────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-tabs"; const A = "tabsApp"; const R = A;
    const NODE = "tabsNode"; const DBG = "tabsDbg";
    examples.push({
        path: "examples/composite/ui-tabs.json",
        nodes: [
            tab(T, "ui-tabs example"),
            uiApp(A, T, { name: "Tabs App" }),

            // Output: tabChange event
            { ...viewNode("ui-tabs", NODE, A, R, T, {
                name: "tabs",
                tabs: JSON.stringify([
                    { id: "overview", label: "Overview" },
                    { id: "details", label: "Details" },
                    { id: "history", label: "History" }
                ]),
                value: { kind: "literal", value: "overview" }
            }), wires: [[DBG]] },

            // Content per tab slot
            viewNode("ui-text", "tabOverview", A, R, T, { name: "overview content", mount: "tabsNode.overview", text: "Overview content here.", x: 700, y: 200 }),
            viewNode("ui-text", "tabDetails", A, R, T, { name: "details content", mount: "tabsNode.details", text: "Details content here.", x: 700, y: 280 }),
            viewNode("ui-text", "tabHistory", A, R, T, { name: "history content", mount: "tabsNode.history", text: "History content here.", x: 700, y: 360 }),

            debugNode(DBG, T, "tabChange events", 280),

            // Inject: programmatically switch tab
            injectPayload("inj-tab", T, "Switch to Details tab", "details", "str", NODE, 480)
        ]
    });
}

// ui-accordion ─────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-accordion"; const A = "accApp"; const R = A;
    const NODE = "accNode"; const DBG = "accDbg";
    examples.push({
        path: "examples/composite/ui-accordion.json",
        nodes: [
            tab(T, "ui-accordion example"),
            uiApp(A, T, { name: "Accordion App" }),

            // Output: sectionOpen / sectionClose events
            // P169 (ADR 0018, Model 1a): sections are derived from
            // ui-accordion-section children. A legacy `sections` JSON is migrated at
            // deploy into ui-accordion-section children (mirror of the ui-tabs
            // example, which still rides the migration path).
            { ...viewNode("ui-accordion", NODE, A, R, T, {
                name: "FAQ accordion",
                sections: JSON.stringify([
                    { id: "q1", label: "What is node-red-contrib-webapp?" },
                    { id: "q2", label: "How does routing work?" },
                    { id: "q3", label: "Can I use it with my existing flows?" }
                ]),
                openSection: { kind: "literal", value: "q1" }
            }), wires: [[DBG]] },

            // Content per section slot (legacy section:<id> mounts migrate to
            // ui-accordion-section:<id>/content at deploy).
            viewNode("ui-text", "accQ1", A, R, T, { name: "q1 content", mount: "section:q1", text: "A set of declarative UI nodes for Node-RED to build web apps without custom HTML.", x: 700, y: 200 }),
            viewNode("ui-text", "accQ2", A, R, T, { name: "q2 content", mount: "section:q2", text: "Each ui-route node defines a URL path. Navigation is handled by ui-action nodes.", x: 700, y: 280 }),
            viewNode("ui-text", "accQ3", A, R, T, { name: "q3 content", mount: "section:q3", text: "Yes — nodes emit standard msg.ui events on their output port, compatible with any Node-RED node.", x: 700, y: 360 }),

            debugNode(DBG, T, "sectionOpen / sectionClose events", 280),

            // Inject: programmatically open a section
            injectPayload("inj-section", T, "Open Q2 section", "q2", "str", NODE, 480)
        ]
    });
}

// ui-menu ──────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-menu"; const A = "menuApp"; const R = A;
    const NODE = "menuNode"; const DBG = "menuDbg";
    examples.push({
        path: "examples/composite/ui-menu.json",
        nodes: [
            tab(T, "ui-menu example"),
            uiApp(A, T, { name: "Menu App" }),

            // Output: navigate event when menu item is clicked
            { ...viewNode("ui-menu", NODE, A, R, T, {
                name: "side menu",
                items: JSON.stringify([
                    { id: "home", label: "Home", icon: "house", href: "/" },
                    { id: "settings", label: "Settings", icon: "gear", href: "/settings" },
                    { id: "help", label: "Help", icon: "question-circle", href: "/help" }
                ])
            }), wires: [[DBG]] },

            debugNode(DBG, T, "navigate events", 280),

            // Inject: update menu items dynamically
            injectPayload("inj-items", T, "Update menu items",
                JSON.stringify([
                    { id: "home", label: "Home", icon: "house", href: "/" },
                    { id: "profile", label: "My Profile", icon: "person", href: "/profile" }
                ]), "json", NODE, 480)
        ]
    });
}

// ui-list ──────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-list"; const A = "listApp"; const R = A;
    const NODE = "listNode"; const DBG = "listDbg";
    const ITEMS = [
        { id: "1", label: "First item", description: "A short description" },
        { id: "2", label: "Second item", description: "Another description" },
        { id: "3", label: "Third item" }
    ];
    examples.push({
        path: "examples/composite/ui-list.json",
        nodes: [
            tab(T, "ui-list example"),
            uiApp(A, T, { name: "List App" }),

            stateNode("ui-store", "listStore", A, T, {
                name: "items store", statePath: "items", initialValue: JSON.stringify(ITEMS)
            }),

            // Output: itemClick event
            { ...viewNode("ui-list", NODE, A, R, T, {
                name: "items list", items: { kind: "state", path: "items" }
            }), wires: [[DBG]] },

            debugNode(DBG, T, "itemClick events", 280),

            // Inject: replace items at runtime
            injectPayload("inj-items", T, "Replace items",
                JSON.stringify([{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }]),
                "json", "listStore", 480),
            injectPayload("inj-clear", T, "Clear list", "[]", "json", "listStore", 560)
        ]
    });
}

// ui-pagination ────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-pagination"; const A = "pagApp"; const R = A;
    const NODE = "pagNode"; const DBG = "pagDbg";
    examples.push({
        path: "examples/composite/ui-pagination.json",
        nodes: [
            tab(T, "ui-pagination example"),
            uiApp(A, T, { name: "Pagination App" }),

            stateNode("ui-store", "pageStore", A, T, {
                name: "page store", statePath: "page", initialValue: "1"
            }),

            // Output: pageChange event
            { ...viewNode("ui-pagination", NODE, A, R, T, {
                name: "pager",
                page: { kind: "state", path: "page" },
                pageCount: 10
            }), wires: [[DBG]] },

            // Pair with a text showing the current page
            viewNode("ui-text", "pageDisplay", A, R, T, {
                name: "current page", value: { kind: "state", path: "page" }, x: 480, y: 360
            }),

            debugNode(DBG, T, "pageChange events", 280),

            // Inject: jump to a specific page
            injectPayload("inj-page3", T, "Jump to page 3", "3", "str", "pageStore", 480),
            injectPayload("inj-page1", T, "Jump to page 1", "1", "str", "pageStore", 560),

            // Wire: pageChange event → update store (so the display stays in sync)
            // Done by wiring pagNode → fn-updatePage → pageStore
            {
                id: "fn-updatePage", type: "function", name: "→ update page store",
                z: T, func: "msg.payload = String(msg.ui.params?.page ?? msg.ui.page ?? 1);\nreturn msg;",
                outputs: 1, noerr: 0, x: 380, y: 640, wires: [["pageStore"]]
            }
        ]
    });
}

// ui-stepper ───────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-stepper"; const A = "stepApp"; const R = A;
    const NODE = "stepNode"; const DBG = "stepDbg";
    examples.push({
        path: "examples/composite/ui-stepper.json",
        nodes: [
            tab(T, "ui-stepper example"),
            uiApp(A, T, { name: "Stepper App" }),

            stateNode("ui-store", "stepStore", A, T, {
                name: "step store", statePath: "step", initialValue: '"step1"'
            }),

            // Output: stepChange event (1 output port). P251: the `complete` event
            // was removed — no DOM source ever emitted it.
            { ...viewNode("ui-stepper", NODE, A, R, T, {
                name: "wizard",
                steps: JSON.stringify([
                    { id: "step1", label: "Account" },
                    { id: "step2", label: "Profile" },
                    { id: "step3", label: "Confirm" }
                ]),
                value: { kind: "state", path: "step" }
            }), wires: [[DBG]] },

            debugNode(DBG, T, "stepChange event", 280),

            // Inject: advance to specific step
            injectPayload("inj-step2", T, "Go to Profile step", "step2", "str", "stepStore", 480),
            injectPayload("inj-step3", T, "Go to Confirm step", "step3", "str", "stepStore", 560),
            injectPayload("inj-step1", T, "Reset to Account step", "step1", "str", "stepStore", 640)
        ]
    });
}

// ════════════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════════════

// ui-store ─────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-store"; const A = "storeApp"; const R = A;
    const STORE = "counterStore"; const DBG = "storeDbg";
    examples.push({
        path: "examples/state/ui-store.json",
        nodes: [
            tab(T, "ui-store example"),
            uiApp(A, T, { name: "Store App" }),

            // Store node — output: store notification on every change
            { ...stateNode("ui-store", STORE, A, T, {
                name: "counter store", statePath: "counter", initialValue: "0"
            }), wires: [[DBG]] },

            // Bound display — updates live via SSE whenever store changes
            viewNode("ui-text", "counterDisplay", A, R, T, {
                name: "counter display", value: { kind: "state", path: "counter" }
            }),

            // Second store — shows multiple independent stores in one app
            { ...stateNode("ui-store", "nameStore", A, T, {
                name: "name store", statePath: "name", initialValue: '"World"', y: 460
            }), wires: [[DBG]] },
            viewNode("ui-text", "greeting", A, R, T, {
                name: "greeting", value: { kind: "state", path: "name" }, x: 480, y: 360
            }),

            debugNode(DBG, T, "store change notifications", 280),

            // Inject: set counter
            injectPayload("inj-0", T, "Reset counter to 0", "0", "str", STORE, 540),
            injectPayload("inj-42", T, "Set counter to 42", "42", "str", STORE, 620),
            // Inject: update name
            injectPayload("inj-name", T, "Update name", "Node-RED", "str", "nameStore", 700)
        ]
    });
}

// ui-query ─────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-query"; const A = "queryApp"; const R = A;
    const QUERY = "usersQuery"; const DBG = "queryDbg";
    examples.push({
        path: "examples/state/ui-query.json",
        nodes: [
            tab(T, "ui-query example"),
            uiApp(A, T, { name: "Query App" }),

            // Query node:
            //   Output port → function node (simulates DB response) → back to query input.
            //   This is the canonical round-trip pattern: query fires → your data source
            //   responds → query receives the result and pushes it to bound nodes via SSE.
            { ...stateNode("ui-query", QUERY, A, T, {
                name: "users query", queryPath: "users", trigger: "onShow"
            }), wires: [[DBG]] },

            // Simulate a database: receives the query trigger, returns rows
            {
                id: "dbFn", type: "function", name: "Simulate DB", z: T,
                x: 380, y: 520,
                func: [
                    "// Simulate a database result.",
                    "// In a real flow: replace this with an http-request, mongodb,",
                    "// sqlite, or any Node-RED data node.",
                    "msg.payload = [",
                    "  { id: '1', name: 'Alice', role: 'Admin' },",
                    "  { id: '2', name: 'Bob',   role: 'Editor' },",
                    "  { id: '3', name: 'Carol', role: 'Viewer' }",
                    "];",
                    "return msg;"
                ].join("\n"),
                outputs: 1, noerr: 0,
                wires: [[QUERY]]   // → back to the query's input port
            },

            // Table bound to the query result
            viewNode("ui-table", "usersTable", A, R, T, {
                name: "users table",
                columns: JSON.stringify([{ key: "name", label: "Name" }, { key: "role", label: "Role" }]),
                rows: { kind: "query", path: "users" }
            }),

            debugNode(DBG, T, "query emit (passes through to DB node)", 280),

            // Inject: manually re-trigger the query
            {
                id: "inj-refresh", type: "inject", name: "Refresh data", z: T,
                x: 120, y: 520,
                payload: "", payloadType: "date",
                repeat: "", crontab: "", once: false, onceDelay: 0,
                wires: [["dbFn"]]
            }
        ]
    });
}

// ════════════════════════════════════════════════════════════════════════
// BEHAVIOR
// ════════════════════════════════════════════════════════════════════════

// ui-action ────────────────────────────────────────────────────────────────────
{
    const T = "ex-ui-action"; const A = "actionApp";
    examples.push({
        path: "examples/behavior/ui-action.json",
        nodes: [
            tab(T, "ui-action example"),
            uiApp(A, T, { name: "Action App", layout: "app" }),

            // The app is the implicit root route ("/"); one explicit sub-route.
            uiRoute("detailRoute", "/detail", A, T, { layoutId: "vertical", x: 120, y: 260 }),

            // A dialog
            { id: "infoDialog", type: "ui-dialog", name: "Info", uiId: "infoDialog",
              parent: A, title: "Information", z: T, x: 120, y: 360, wires: [[]] },

            // Home page (app content slot): navigate button + show/hide toggle buttons
            viewNode("ui-button", "goDetailBtn", A, A, T, { name: "go to detail", label: "Go to Detail" }),
            viewNode("ui-button", "openDlgBtn", A, A, T, { name: "open dialog", label: "Open Dialog", x: 480, y: 360 }),
            viewNode("ui-button", "hideCardBtn", A, A, T, { name: "hide card", label: "Hide Card", x: 480, y: 440 }),
            viewNode("ui-button", "showCardBtn", A, A, T, { name: "show card", label: "Show Card", x: 480, y: 520 }),

            // A container that gets shown/hidden
            viewNode("ui-container", "toggleCard", A, A, T, { name: "toggle card", layoutId: "vertical", x: 480, y: 600 }),
            viewNode("ui-text", "cardContent", A, A, T, { name: "card content", mount: "toggleCard.content", text: "This card can be shown/hidden.", x: 700, y: 600 }),

            // Detail page content
            viewNode("ui-text", "detailText", A, "detailRoute", T, { name: "detail text", text: "Detail page — use Back to go home.", x: 480, y: 260 }),
            viewNode("ui-button", "goHomeBtn", A, "detailRoute", T, { name: "go home", label: "← Back", x: 480, y: 340 }),

            // Dialog content
            viewNode("ui-text", "dlgText", A, A, T, { name: "dialog text", mount: "infoDialog.content", text: "Dialog content.", x: 700, y: 360 }),
            viewNode("ui-button", "dlgCloseBtn", A, A, T, { name: "close dialog", mount: "infoDialog.content", label: "Close", x: 700, y: 440 }),

            // Action nodes (non-visual)
            stateNode("ui-action", "navToDetail", A, T, { name: "navigate → /detail", actionType: "navigate", target: "/detail", x: 700, y: 280 }),
            stateNode("ui-action", "navToHome", A, T, { name: "navigate → /", actionType: "navigate", target: "/", x: 700, y: 340 }),
            stateNode("ui-action", "openDialog", A, T, { name: "openDialog", actionType: "openDialog", target: "infoDialog", x: 700, y: 440 }),
            stateNode("ui-action", "closeDialog", A, T, { name: "closeDialog", actionType: "closeDialog", target: "infoDialog", x: 900, y: 440 }),
            stateNode("ui-action", "hideCard", A, T, { name: "hide card", actionType: "hide", target: "toggleCard", x: 700, y: 520 }),
            stateNode("ui-action", "showCard", A, T, { name: "show card", actionType: "show", target: "toggleCard", x: 700, y: 600 })
        ]
    });
}

// ui-navigation was retired in P243 (ADR 0040) — navigation is solely a
// ui-action navigate; no per-node example is generated for it any more.

// ── write all files ────────────────────────────────────────────────────────────

console.log("Generating per-node example flows…\n");
for (const { path, nodes } of examples) {
    write(path, nodes);
}
console.log(`\nDone — ${examples.length} example files written.`);
