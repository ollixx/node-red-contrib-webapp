#!/usr/bin/env node
/**
 * gen-node-examples.js
 *
 * Generates one importable example flow.json per node type, mirroring the
 * flows used in the per-node E2E test suite (P41–P46).
 *
 * Output: examples/<category>/<node-name>.json
 *
 * Usage:
 *   node scripts/gen-node-examples.js
 *   pnpm gen:node-examples
 *
 * Each generated file is a standard Node-RED flow array that can be imported
 * via Menu → Import → Examples → node-red-contrib-webapp.
 *
 * DO NOT hand-edit the generated files. Re-run this script instead.
 */

"use strict";

const { writeFileSync, mkdirSync } = require("node:fs");
const { resolve, dirname } = require("node:path");

const ROOT = resolve(__dirname, "..");

// ── write helper ─────────────────────────────────────────────────────────────

function write(relPath, nodes) {
    const abs = resolve(ROOT, relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(nodes, null, 2) + "\n");
    console.log("  wrote", relPath);
}

// ── node factory helpers ─────────────────────────────────────────────────────

/** Returns a Node-RED tab node. */
function tab(id, label) {
    return { id, type: "tab", label, disabled: false, info: "" };
}

/** Returns a ui-app node. */
function uiApp(id, tabId, overrides = {}) {
    return {
        id, type: "ui-app", name: overrides.name ?? id, uiId: id,
        root: id, layout: "app", z: tabId,
        x: 100, y: 80, wires: [[]],
        ...overrides
    };
}

/** Returns a ui-route node mounted into the given app. */
function uiRoute(id, path, appId, tabId, overrides = {}) {
    return {
        id, type: "ui-route", name: id, uiId: id,
        path, parent: appId, layoutId: overrides.layoutId ?? "vertical",
        z: tabId, x: 100, y: 180, wires: [[]],
        ...overrides
    };
}

/** Returns any view/composite node mounted into a route. */
function viewNode(type, id, appId, routeId, tabId, overrides = {}) {
    return {
        id, type, name: id, uiId: id,
        parent: appId, mount: `${routeId}.content`,
        z: tabId, x: 400, y: 180, wires: [[]],
        ...overrides
    };
}

/** Returns a non-visual node (store, query, action, navigation) — no mount. */
function stateNode(type, id, appId, tabId, overrides = {}) {
    return {
        id, type, name: id, uiId: id,
        parent: appId,
        z: tabId, x: 400, y: 320, wires: [[]],
        ...overrides
    };
}

/** Returns a standard Node-RED inject node wired to targetId. */
function inject(id, tabId, payload, payloadType, targetId, y = 420) {
    return {
        id, type: "inject", name: "Inject", z: tabId,
        x: 100, y,
        payload, payloadType,
        repeat: "", crontab: "", once: false, onceDelay: 0,
        wires: [[targetId]]
    };
}

/** Returns a standard Node-RED debug node. */
function debug(id, tabId, y = 320) {
    return {
        id, type: "debug", name: "Events", z: tabId,
        x: 700, y, active: true, tosidebar: true,
        complete: "payload", targetType: "msg",
        wires: [[]]
    };
}

// ── examples definition ──────────────────────────────────────────────────────
// Each entry: { path, nodes }
// All paths relative to the project root.

const examples = [];

// ── STRUCTURE ────────────────────────────────────────────────────────────────

// ui-app — app-layout shell with title and one home route
{
    const T = "ex-ui-app";
    examples.push({
        path: "examples/structure/ui-app.json",
        nodes: [
            tab(T, "ui-app example"),
            uiApp("myApp", T, { name: "My App", layout: "app" }),
            uiRoute("homeRoute", "/", "myApp", T, { layoutId: "vertical" }),
            viewNode("ui-text", "welcomeText", "myApp", "homeRoute", T, { text: "Welcome to My App!" })
        ]
    });
}

// ui-route — two routes: home and detail, with a navigate action between them
{
    const T = "ex-ui-route";
    examples.push({
        path: "examples/structure/ui-route.json",
        nodes: [
            tab(T, "ui-route example"),
            uiApp("routeApp", T, { name: "Route App" }),
            uiRoute("homeR", "/", "routeApp", T, { layoutId: "vertical" }),
            uiRoute("detailR", "/detail", "routeApp", T, { layoutId: "vertical", x: 100, y: 260 }),
            viewNode("ui-text", "homeText", "routeApp", "homeR", T, { text: "Home route — click the button to navigate." }),
            viewNode("ui-button", "goDetail", "routeApp", "homeR", T,
                { id: "goDetail", label: "Go to Detail", x: 400, y: 260 }),
            viewNode("ui-text", "detailText", "routeApp", "detailR", T,
                { id: "detailText", text: "Detail route.", x: 400, y: 340 }),
            {
                id: "navAction", type: "ui-action", name: "Navigate to /detail", uiId: "navAction",
                parent: "routeApp", actionType: "navigate", target: "/detail",
                z: T, x: 700, y: 260, wires: [[]]
            }
        ]
    });
}

// ui-dialog — dialog opened by a button via ui-action
{
    const T = "ex-ui-dialog";
    examples.push({
        path: "examples/structure/ui-dialog.json",
        nodes: [
            tab(T, "ui-dialog example"),
            uiApp("dlgApp", T, { name: "Dialog App" }),
            uiRoute("dlgHome", "/", "dlgApp", T, { layoutId: "vertical" }),
            { id: "myDialog", type: "ui-dialog", name: "My Dialog", uiId: "myDialog",
              parent: "dlgApp", title: "Hello Dialog",
              z: T, x: 100, y: 360, wires: [[]] },
            viewNode("ui-button", "openBtn", "dlgApp", "dlgHome", T, { label: "Open Dialog" }),
            viewNode("ui-text", "dlgContent", "dlgApp", "dlgHome", T,
                { id: "dlgContent", mount: "myDialog.content", text: "Dialog content here.", x: 400, y: 280 }),
            { id: "openAction", type: "ui-action", name: "Open Dialog", uiId: "openAction",
              parent: "dlgApp", actionType: "openDialog", target: "myDialog",
              z: T, x: 700, y: 180, wires: [[]] }
        ]
    });
}

// ── VIEW — display nodes ─────────────────────────────────────────────────────

// ui-text — literal text and store-bound text
{
    const T = "ex-ui-text";
    examples.push({
        path: "examples/view/ui-text.json",
        nodes: [
            tab(T, "ui-text example"),
            uiApp("textApp", T, { name: "Text App" }),
            uiRoute("textHome", "/", "textApp", T),
            stateNode("ui-store", "counterStore", "textApp", T,
                { statePath: "counter", initialValue: "0" }),
            viewNode("ui-text", "staticText", "textApp", "textHome", T,
                { text: "Static label" }),
            viewNode("ui-text", "boundText", "textApp", "textHome", T,
                { id: "boundText", value: { kind: "state", path: "counter" }, x: 400, y: 260 }),
            inject(T + "-inj", T, "42", "str", "counterStore", 420),
            debug(T + "-dbg", T, 180)
        ]
    });
}

// ui-button — primary and danger variant, with event output
{
    const T = "ex-ui-button";
    examples.push({
        path: "examples/view/ui-button.json",
        nodes: [
            tab(T, "ui-button example"),
            uiApp("btnApp", T, { name: "Button App" }),
            uiRoute("btnHome", "/", "btnApp", T),
            viewNode("ui-button", "primaryBtn", "btnApp", "btnHome", T,
                { label: "Primary Button" }),
            viewNode("ui-button", "dangerBtn", "btnApp", "btnHome", T,
                { id: "dangerBtn", label: "Danger Button", variant: "danger", x: 400, y: 260 }),
            debug(T + "-dbg", T, 180)
        ]
    });
}

// ui-input — text input with label
{
    const T = "ex-ui-input";
    examples.push({
        path: "examples/view/ui-input.json",
        nodes: [
            tab(T, "ui-input example"),
            uiApp("inputApp", T, { name: "Input App" }),
            uiRoute("inputHome", "/", "inputApp", T),
            viewNode("ui-input", "nameInput", "inputApp", "inputHome", T,
                { label: "Full Name", inputType: "text", placeholder: "Enter your name",
                  value: { kind: "literal", value: "" } }),
            viewNode("ui-input", "emailInput", "inputApp", "inputHome", T,
                { id: "emailInput", label: "Email", inputType: "email",
                  placeholder: "you@example.com", value: { kind: "literal", value: "" },
                  x: 400, y: 260 }),
            debug(T + "-dbg", T, 180)
        ]
    });
}

// ui-checkbox — checked / unchecked
{
    const T = "ex-ui-checkbox";
    examples.push({
        path: "examples/view/ui-checkbox.json",
        nodes: [
            tab(T, "ui-checkbox example"),
            uiApp("cbApp", T, { name: "Checkbox App" }),
            uiRoute("cbHome", "/", "cbApp", T),
            viewNode("ui-checkbox", "agreeBox", "cbApp", "cbHome", T,
                { label: "I agree to the terms", value: { kind: "literal", value: false } }),
            viewNode("ui-checkbox", "preChecked", "cbApp", "cbHome", T,
                { id: "preChecked", label: "Pre-selected option",
                  value: { kind: "literal", value: true }, x: 400, y: 260 }),
            debug(T + "-dbg", T, 180)
        ]
    });
}

// ui-switch — on/off toggle
{
    const T = "ex-ui-switch";
    examples.push({
        path: "examples/view/ui-switch.json",
        nodes: [
            tab(T, "ui-switch example"),
            uiApp("swApp", T, { name: "Switch App" }),
            uiRoute("swHome", "/", "swApp", T),
            viewNode("ui-switch", "darkMode", "swApp", "swHome", T,
                { label: "Dark Mode", value: { kind: "literal", value: false } }),
            debug(T + "-dbg", T, 180)
        ]
    });
}

// ui-radio — radio group with options
{
    const T = "ex-ui-radio";
    examples.push({
        path: "examples/view/ui-radio.json",
        nodes: [
            tab(T, "ui-radio example"),
            uiApp("radioApp", T, { name: "Radio App" }),
            uiRoute("radioHome", "/", "radioApp", T),
            viewNode("ui-radio", "sizeRadio", "radioApp", "radioHome", T, {
                label: "Size",
                optionsJson: JSON.stringify([
                    { label: "Small", value: "s" },
                    { label: "Medium", value: "m" },
                    { label: "Large", value: "l" }
                ]),
                value: { kind: "literal", value: "m" }
            }),
            debug(T + "-dbg", T, 180)
        ]
    });
}

// ui-select — dropdown with options
{
    const T = "ex-ui-select";
    examples.push({
        path: "examples/view/ui-select.json",
        nodes: [
            tab(T, "ui-select example"),
            uiApp("selApp", T, { name: "Select App" }),
            uiRoute("selHome", "/", "selApp", T),
            viewNode("ui-select", "countrySelect", "selApp", "selHome", T, {
                label: "Country",
                optionsJson: JSON.stringify([
                    { label: "Germany", value: "de" },
                    { label: "Austria", value: "at" },
                    { label: "Switzerland", value: "ch" }
                ]),
                value: { kind: "literal", value: "" }
            }),
            debug(T + "-dbg", T, 180)
        ]
    });
}

// ui-slider — range slider
{
    const T = "ex-ui-slider";
    examples.push({
        path: "examples/view/ui-slider.json",
        nodes: [
            tab(T, "ui-slider example"),
            uiApp("sliderApp", T, { name: "Slider App" }),
            uiRoute("sliderHome", "/", "sliderApp", T),
            viewNode("ui-slider", "volumeSlider", "sliderApp", "sliderHome", T,
                { label: "Volume", min: 0, max: 100, step: 5,
                  value: { kind: "literal", value: 50 } }),
            debug(T + "-dbg", T, 180)
        ]
    });
}

// ui-textarea — multi-line text input
{
    const T = "ex-ui-textarea";
    examples.push({
        path: "examples/view/ui-textarea.json",
        nodes: [
            tab(T, "ui-textarea example"),
            uiApp("taApp", T, { name: "Textarea App" }),
            uiRoute("taHome", "/", "taApp", T),
            viewNode("ui-textarea", "notesArea", "taApp", "taHome", T,
                { label: "Notes", placeholder: "Enter your notes here…",
                  rows: 4, value: { kind: "literal", value: "" } }),
            debug(T + "-dbg", T, 180)
        ]
    });
}

// ui-datepicker — date picker
{
    const T = "ex-ui-datepicker";
    examples.push({
        path: "examples/view/ui-datepicker.json",
        nodes: [
            tab(T, "ui-datepicker example"),
            uiApp("dpApp", T, { name: "Datepicker App" }),
            uiRoute("dpHome", "/", "dpApp", T),
            viewNode("ui-datepicker", "startDate", "dpApp", "dpHome", T,
                { label: "Start Date", value: { kind: "literal", value: "" } }),
            debug(T + "-dbg", T, 180)
        ]
    });
}

// ui-badge — badge with variants
{
    const T = "ex-ui-badge";
    examples.push({
        path: "examples/view/ui-badge.json",
        nodes: [
            tab(T, "ui-badge example"),
            uiApp("badgeApp", T, { name: "Badge App" }),
            uiRoute("badgeHome", "/", "badgeApp", T),
            viewNode("ui-badge", "successBadge", "badgeApp", "badgeHome", T,
                { label: "Active", variant: "success" }),
            viewNode("ui-badge", "warningBadge", "badgeApp", "badgeHome", T,
                { id: "warningBadge", label: "Pending", variant: "warning", x: 400, y: 260 }),
            viewNode("ui-badge", "dangerBadge", "badgeApp", "badgeHome", T,
                { id: "dangerBadge", label: "Error", variant: "danger", x: 400, y: 320 })
        ]
    });
}

// ui-progress — progress bar
{
    const T = "ex-ui-progress";
    examples.push({
        path: "examples/view/ui-progress.json",
        nodes: [
            tab(T, "ui-progress example"),
            uiApp("progApp", T, { name: "Progress App" }),
            uiRoute("progHome", "/", "progApp", T),
            stateNode("ui-store", "progStore", "progApp", T,
                { statePath: "progress", initialValue: "25" }),
            viewNode("ui-progress", "uploadProgress", "progApp", "progHome", T,
                { label: "Upload", value: { kind: "state", path: "progress" } }),
            inject(T + "-inj", T, "75", "str", "progStore", 420),
        ]
    });
}

// ui-image — image with src
{
    const T = "ex-ui-image";
    examples.push({
        path: "examples/view/ui-image.json",
        nodes: [
            tab(T, "ui-image example"),
            uiApp("imgApp", T, { name: "Image App" }),
            uiRoute("imgHome", "/", "imgApp", T),
            viewNode("ui-image", "heroImage", "imgApp", "imgHome", T, {
                src: "https://picsum.photos/400/200",
                alt: "Random photo",
                width: "400", height: "200"
            })
        ]
    });
}

// ui-avatar — avatar with initials
{
    const T = "ex-ui-avatar";
    examples.push({
        path: "examples/view/ui-avatar.json",
        nodes: [
            tab(T, "ui-avatar example"),
            uiApp("avatarApp", T, { name: "Avatar App" }),
            uiRoute("avatarHome", "/", "avatarApp", T),
            viewNode("ui-avatar", "userAvatar", "avatarApp", "avatarHome", T,
                { initials: "AK", label: "Anna K." }),
            viewNode("ui-avatar", "imgAvatar", "avatarApp", "avatarHome", T,
                { id: "imgAvatar", src: "https://picsum.photos/seed/user/40/40",
                  label: "Photo avatar", x: 400, y: 260 })
        ]
    });
}

// ui-skeleton — loading placeholder
{
    const T = "ex-ui-skeleton";
    examples.push({
        path: "examples/view/ui-skeleton.json",
        nodes: [
            tab(T, "ui-skeleton example"),
            uiApp("skelApp", T, { name: "Skeleton App" }),
            uiRoute("skelHome", "/", "skelApp", T),
            viewNode("ui-skeleton", "textSkeleton", "skelApp", "skelHome", T,
                { effect: "sheen" }),
            viewNode("ui-skeleton", "avatarSkeleton", "skelApp", "skelHome", T,
                { id: "avatarSkeleton", shape: "circle", effect: "pulse", x: 400, y: 260 })
        ]
    });
}

// ui-empty-state — empty state message
{
    const T = "ex-ui-empty-state";
    examples.push({
        path: "examples/view/ui-empty-state.json",
        nodes: [
            tab(T, "ui-empty-state example"),
            uiApp("emptyApp", T, { name: "Empty State App" }),
            uiRoute("emptyHome", "/", "emptyApp", T),
            viewNode("ui-empty-state", "noResults", "emptyApp", "emptyHome", T, {
                title: "No results",
                description: "Try adjusting your search or filters.",
                icon: "search"
            })
        ]
    });
}

// ui-alert — alert with message and variant
{
    const T = "ex-ui-alert";
    examples.push({
        path: "examples/view/ui-alert.json",
        nodes: [
            tab(T, "ui-alert example"),
            uiApp("alertApp", T, { name: "Alert App" }),
            uiRoute("alertHome", "/", "alertApp", T),
            viewNode("ui-alert", "infoAlert", "alertApp", "alertHome", T,
                { message: "This is an informational message.", variant: "primary" }),
            viewNode("ui-alert", "successAlert", "alertApp", "alertHome", T,
                { id: "successAlert", message: "Action completed successfully!", variant: "success",
                  x: 400, y: 260 }),
            viewNode("ui-alert", "dangerAlert", "alertApp", "alertHome", T,
                { id: "dangerAlert", message: "Something went wrong.", variant: "danger",
                  x: 400, y: 320 })
        ]
    });
}

// ui-breadcrumb — breadcrumb navigation
{
    const T = "ex-ui-breadcrumb";
    examples.push({
        path: "examples/view/ui-breadcrumb.json",
        nodes: [
            tab(T, "ui-breadcrumb example"),
            uiApp("breadApp", T, { name: "Breadcrumb App" }),
            uiRoute("breadHome", "/", "breadApp", T),
            viewNode("ui-breadcrumb", "navBread", "breadApp", "breadHome", T, {
                items: JSON.stringify([
                    { label: "Home", href: "/" },
                    { label: "Products", href: "/products" },
                    { label: "Detail" }
                ])
            })
        ]
    });
}

// ── COMPOSITE nodes ──────────────────────────────────────────────────────────

// ui-table — table with columns and injected rows
{
    const T = "ex-ui-table";
    examples.push({
        path: "examples/composite/ui-table.json",
        nodes: [
            tab(T, "ui-table example"),
            uiApp("tblApp", T, { name: "Table App" }),
            uiRoute("tblHome", "/", "tblApp", T),
            stateNode("ui-store", "rowsStore", "tblApp", T,
                {
                    statePath: "users",
                    initialValue: JSON.stringify([
                        { id: "1", name: "Alice", role: "Admin" },
                        { id: "2", name: "Bob", role: "Editor" }
                    ])
                }),
            viewNode("ui-table", "usersTable", "tblApp", "tblHome", T, {
                columns: JSON.stringify([
                    { key: "name", label: "Name" },
                    { key: "role", label: "Role" }
                ]),
                rows: { kind: "state", path: "users" }
            }),
            inject(T + "-inj", T,
                JSON.stringify([
                    { id: "1", name: "Alice", role: "Admin" },
                    { id: "2", name: "Bob", role: "Editor" },
                    { id: "3", name: "Carol", role: "Viewer" }
                ]), "json", "rowsStore", 420),
            debug(T + "-dbg", T, 180)
        ]
    });
}

// ui-container — card wrapper with child nodes
{
    const T = "ex-ui-container";
    examples.push({
        path: "examples/composite/ui-container.json",
        nodes: [
            tab(T, "ui-container example"),
            uiApp("ctApp", T, { name: "Container App" }),
            uiRoute("ctHome", "/", "ctApp", T),
            viewNode("ui-container", "myCard", "ctApp", "ctHome", T,
                { layoutId: "vertical" }),
            viewNode("ui-text", "cardTitle", "ctApp", "ctHome", T,
                { id: "cardTitle", mount: "myCard.content", text: "Card Title",
                  x: 700, y: 160 }),
            viewNode("ui-text", "cardBody", "ctApp", "ctHome", T,
                { id: "cardBody", mount: "myCard.content", text: "Card content goes here.",
                  x: 700, y: 220 }),
            viewNode("ui-button", "cardBtn", "ctApp", "ctHome", T,
                { id: "cardBtn", mount: "myCard.content", label: "Action",
                  x: 700, y: 280 })
        ]
    });
}

// ui-tabs — tabbed interface
{
    const T = "ex-ui-tabs";
    examples.push({
        path: "examples/composite/ui-tabs.json",
        nodes: [
            tab(T, "ui-tabs example"),
            uiApp("tabsApp", T, { name: "Tabs App" }),
            uiRoute("tabsHome", "/", "tabsApp", T),
            viewNode("ui-tabs", "myTabs", "tabsApp", "tabsHome", T, {
                tabs: JSON.stringify([
                    { id: "tab1", label: "Overview" },
                    { id: "tab2", label: "Details" },
                    { id: "tab3", label: "History" }
                ]),
                value: { kind: "literal", value: "tab1" }
            }),
            viewNode("ui-text", "tabContent1", "tabsApp", "tabsHome", T,
                { id: "tabContent1", mount: "myTabs.tab1", text: "Overview content",
                  x: 700, y: 160 }),
            viewNode("ui-text", "tabContent2", "tabsApp", "tabsHome", T,
                { id: "tabContent2", mount: "myTabs.tab2", text: "Details content",
                  x: 700, y: 220 }),
            debug(T + "-dbg", T, 420)
        ]
    });
}

// ui-accordion — accordion sections
{
    const T = "ex-ui-accordion";
    examples.push({
        path: "examples/composite/ui-accordion.json",
        nodes: [
            tab(T, "ui-accordion example"),
            uiApp("accApp", T, { name: "Accordion App" }),
            uiRoute("accHome", "/", "accApp", T),
            viewNode("ui-accordion", "faqAccordion", "accApp", "accHome", T, {
                items: JSON.stringify([
                    { id: "q1", label: "What is Node-RED?", content: "Node-RED is a flow-based programming tool." },
                    { id: "q2", label: "What is a webapp node?", content: "A declarative UI node for building web apps." },
                    { id: "q3", label: "Where do I find examples?", content: "Menu → Import → Examples." }
                ])
            }),
            debug(T + "-dbg", T, 320)
        ]
    });
}

// ui-menu — context/side menu
{
    const T = "ex-ui-menu";
    examples.push({
        path: "examples/composite/ui-menu.json",
        nodes: [
            tab(T, "ui-menu example"),
            uiApp("menuApp", T, { name: "Menu App" }),
            uiRoute("menuHome", "/", "menuApp", T),
            viewNode("ui-menu", "sideMenu", "menuApp", "menuHome", T, {
                items: JSON.stringify([
                    { id: "home", label: "Home", icon: "house" },
                    { id: "settings", label: "Settings", icon: "gear" },
                    { id: "help", label: "Help", icon: "question-circle" }
                ])
            }),
            debug(T + "-dbg", T, 320)
        ]
    });
}

// ui-list — simple list
{
    const T = "ex-ui-list";
    examples.push({
        path: "examples/composite/ui-list.json",
        nodes: [
            tab(T, "ui-list example"),
            uiApp("listApp", T, { name: "List App" }),
            uiRoute("listHome", "/", "listApp", T),
            stateNode("ui-store", "itemsStore", "listApp", T, {
                statePath: "items",
                initialValue: JSON.stringify([
                    { id: "1", label: "First item" },
                    { id: "2", label: "Second item" },
                    { id: "3", label: "Third item" }
                ])
            }),
            viewNode("ui-list", "myList", "listApp", "listHome", T, {
                items: { kind: "state", path: "items" }
            }),
            debug(T + "-dbg", T, 180)
        ]
    });
}

// ui-pagination — prev/next pager
{
    const T = "ex-ui-pagination";
    examples.push({
        path: "examples/composite/ui-pagination.json",
        nodes: [
            tab(T, "ui-pagination example"),
            uiApp("pagApp", T, { name: "Pagination App" }),
            uiRoute("pagHome", "/", "pagApp", T),
            stateNode("ui-store", "pageStore", "pagApp", T,
                { statePath: "page", initialValue: "1" }),
            viewNode("ui-pagination", "pager", "pagApp", "pagHome", T, {
                page: { kind: "state", path: "page" },
                pageCount: 10
            }),
            debug(T + "-dbg", T, 180)
        ]
    });
}

// ui-stepper — step wizard
{
    const T = "ex-ui-stepper";
    examples.push({
        path: "examples/composite/ui-stepper.json",
        nodes: [
            tab(T, "ui-stepper example"),
            uiApp("stepApp", T, { name: "Stepper App" }),
            uiRoute("stepHome", "/", "stepApp", T),
            stateNode("ui-store", "stepStore", "stepApp", T,
                { statePath: "step", initialValue: "0" }),
            viewNode("ui-stepper", "wizard", "stepApp", "stepHome", T, {
                steps: JSON.stringify([
                    { id: "s0", label: "Account" },
                    { id: "s1", label: "Profile" },
                    { id: "s2", label: "Confirm" }
                ]),
                value: { kind: "state", path: "step" }
            }),
            debug(T + "-dbg", T, 180)
        ]
    });
}

// ui-toast — triggered via inject → store → toast
{
    const T = "ex-ui-toast";
    examples.push({
        path: "examples/composite/ui-toast.json",
        nodes: [
            tab(T, "ui-toast example"),
            uiApp("toastApp", T, { name: "Toast App" }),
            uiRoute("toastHome", "/", "toastApp", T),
            viewNode("ui-toast", "myToast", "toastApp", "toastHome", T,
                { message: "", variant: "primary", duration: 3000 }),
            viewNode("ui-button", "triggerBtn", "toastApp", "toastHome", T,
                { id: "triggerBtn", label: "Show Toast", x: 400, y: 260 }),
            {
                id: T + "-inj", type: "inject", name: "Trigger Toast", z: T,
                x: 100, y: 420,
                payload: JSON.stringify({ message: "Hello from Node-RED!", variant: "success" }),
                payloadType: "json",
                repeat: "", crontab: "", once: false, onceDelay: 0,
                wires: [["myToast"]]
            }
        ]
    });
}

// ── STATE nodes ──────────────────────────────────────────────────────────────

// ui-store — shared state bound to a text display; inject updates it
{
    const T = "ex-ui-store";
    examples.push({
        path: "examples/state/ui-store.json",
        nodes: [
            tab(T, "ui-store example"),
            uiApp("storeApp", T, { name: "Store App" }),
            uiRoute("storeHome", "/", "storeApp", T),
            stateNode("ui-store", "counterStore", "storeApp", T,
                { statePath: "counter", initialValue: "0" }),
            viewNode("ui-text", "counterDisplay", "storeApp", "storeHome", T,
                { value: { kind: "state", path: "counter" } }),
            inject(T + "-inj", T, "42", "str", "counterStore", 420),
            {
                id: T + "-fn", type: "function", name: "Increment", z: T,
                x: 400, y: 420,
                func: "msg.payload = (parseInt(msg.payload) || 0) + 1;\nreturn msg;",
                outputs: 1, noerr: 0,
                wires: [["counterStore"]]
            }
        ]
    });
}

// ui-query — query node wired from a function, result bound to a table
{
    const T = "ex-ui-query";
    examples.push({
        path: "examples/state/ui-query.json",
        nodes: [
            tab(T, "ui-query example"),
            uiApp("queryApp", T, { name: "Query App" }),
            uiRoute("queryHome", "/", "queryApp", T),
            stateNode("ui-query", "usersQuery", "queryApp", T,
                { queryPath: "users", trigger: "onShow" }),
            {
                id: T + "-fn", type: "function", name: "Return users", z: T,
                x: 700, y: 320,
                func: [
                    "// Simulate a database result.",
                    "msg.payload = [",
                    "  { id: '1', name: 'Alice', role: 'Admin' },",
                    "  { id: '2', name: 'Bob',   role: 'Editor' }",
                    "];",
                    "return msg;"
                ].join("\n"),
                outputs: 1, noerr: 0,
                wires: [["usersQuery"]]
            },
            viewNode("ui-table", "usersTable", "queryApp", "queryHome", T, {
                columns: JSON.stringify([
                    { key: "name", label: "Name" },
                    { key: "role", label: "Role" }
                ]),
                rows: { kind: "query", path: "users" }
            })
        ]
    });
}

// ── BEHAVIOR nodes ───────────────────────────────────────────────────────────

// ui-action — navigate / openDialog / show / hide
{
    const T = "ex-ui-action";
    examples.push({
        path: "examples/behavior/ui-action.json",
        nodes: [
            tab(T, "ui-action example"),
            uiApp("actionApp", T, { name: "Action App" }),
            uiRoute("actionHome", "/", "actionApp", T),
            uiRoute("actionDetail", "/detail", "actionApp", T,
                { x: 100, y: 260, z: T }),
            { id: "infoDialog", type: "ui-dialog", name: "Info Dialog",
              uiId: "infoDialog", parent: "actionApp", title: "Information",
              z: T, x: 100, y: 360, wires: [[]] },

            // Buttons on the home route
            viewNode("ui-button", "goDetailBtn", "actionApp", "actionHome", T,
                { label: "Go to Detail" }),
            viewNode("ui-button", "openDialogBtn", "actionApp", "actionHome", T,
                { id: "openDialogBtn", label: "Open Dialog", x: 400, y: 260 }),

            // Action nodes (non-visual; placed beside their trigger buttons)
            { id: "navigateAction", type: "ui-action", name: "navigate → /detail",
              uiId: "navigateAction", parent: "actionApp",
              actionType: "navigate", target: "/detail",
              z: T, x: 700, y: 180, wires: [[]] },
            { id: "openDialogAction", type: "ui-action", name: "openDialog",
              uiId: "openDialogAction", parent: "actionApp",
              actionType: "openDialog", target: "infoDialog",
              z: T, x: 700, y: 260, wires: [[]] },

            viewNode("ui-text", "dialogMsg", "actionApp", "actionHome", T,
                { id: "dialogMsg", mount: "infoDialog.content",
                  text: "This dialog was opened by a ui-action node.",
                  x: 700, y: 360 })
        ]
    });
}

// ui-navigation — nav bar with links
{
    const T = "ex-ui-navigation";
    examples.push({
        path: "examples/behavior/ui-navigation.json",
        nodes: [
            tab(T, "ui-navigation example"),
            uiApp("navApp", T, { name: "Navigation App", layout: "app" }),
            uiRoute("navHome", "/", "navApp", T, { layoutId: "app" }),
            uiRoute("navAbout", "/about", "navApp", T,
                { layoutId: "vertical", x: 100, y: 260 }),
            uiRoute("navContact", "/contact", "navApp", T,
                { layoutId: "vertical", x: 100, y: 320 }),

            // Navigation bar mounted in the app sidebar / nav slot
            { id: "mainNav", type: "ui-navigation", name: "Main Nav",
              uiId: "mainNav", parent: "navApp", mount: "navApp.nav",
              links: JSON.stringify([
                  { label: "Home", to: "/" },
                  { label: "About", to: "/about" },
                  { label: "Contact", to: "/contact" }
              ]),
              z: T, x: 400, y: 180, wires: [[]] },

            viewNode("ui-text", "homeContent", "navApp", "navHome", T,
                { text: "Home page" }),
            viewNode("ui-text", "aboutContent", "navApp", "navAbout", T,
                { id: "aboutContent", text: "About page", x: 700, y: 260 }),
            viewNode("ui-text", "contactContent", "navApp", "navContact", T,
                { id: "contactContent", text: "Contact page", x: 700, y: 320 })
        ]
    });
}

// ── write all examples ────────────────────────────────────────────────────────

console.log("Generating node examples…");
for (const { path, nodes } of examples) {
    write(path, nodes);
}
console.log(`\nDone — ${examples.length} example files written.`);
