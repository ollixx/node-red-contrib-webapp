
let propColor = function (transparent = false) {
    let prop = {
        name: "color",
        type: "buttongroup",
        label: "Color",
        faIconName: "paint-brush",
        options: [
            { value: "default", label: "Default" },
            { value: "primary", label: "Primary" },
            { value: "accent", label: "Accent" },
        ]
    }
    if (transparent) {
        prop.options.push({ value: "transparent", label: "Transparent" });
    }
    return prop;
}

let propSize = {
    name: "size",
    type: "buttongroup",
    label: "Size",
    faIconName: "expand",
    options: [
        { value: "small", label: "Small" },
        { value: "default", label: "Default" },
        { value: "large", label: "Large" },
    ]
};

let propCss = {
    name: "css",
    type: "string",
    label: "Css",
}

let propPayload = function (label = "Payload") {
    return {
        name: "payload",
        type: "typedinput",
        typedInput: {
            types: ["str", "num", "bool", "json", { value: "pay", label: "payload" }, { value: "par", label: "parent" }, { value: "mod", label: "model" }]
        },
        label: label,
        default: { value: "", type: "json" }
    }
}

let propTyped = function (name, label) {
    return {
        name: name,
        type: "typedinput",
        typedInput: {
            types: ["str", "num", "bool", "json", { value: "pay", label: name }, { value: "ctx", label: "context" }, { value: "par", label: "parent" }, { value: "mod", label: "model" }]
        },
        label: label,
        default: { value: "", type: "json" }
    }
}

let propBinding = function (name, label) {
    return {
        name: name,
        type: "typedinput",
        typedInput: {
            types: ["json", { value: "pay", label: name }, { value: "ctx", label: "context" }, { value: "par", label: "parent" }, { value: "mod", label: "model" }]
        },
        label: label,
        default: { value: "", type: "json" }
    }
}

let propBoolean = function (name, label) {
    return {
        name: name,
        type: "typedinput",
        typedInput: {
            types: ["bool", { value: "pay", label: name }, { value: "ctx", label: "context" }, { value: "par", label: "parent" }, { value: "mod", label: "model" }]
        },
        label: label,
        default: { value: "", type: "bool" }
    }
}


types = [
    // ***********************   PageView, i.e. a page placeholder
    {
        name: "GuiPageView",
        label: "PageView",
        props: []
    },
    // ***********************   Page
    {
        name: "GuiPage",
        label: "Page",
        props: [
            {
                name: "defaultPage",
                type: "checkbox",
                checkboxLabel: "Is Default Page",
                default: false
            }
        ]
    },
    // ***********************   MD App
    {
        name: "GuiApp",
        label: "App",
        props: [
            {
                name: "mode",
                type: "buttongroup",
                label: "Mode",
                faIconName: "sliders",
                options: [
                    { value: "default", label: "Default" },
                    { value: "fixed", label: "Fixed" },
                    { value: "fixed-last", label: "Fixed Last" },
                    { value: "reveal", label: "Reveal" },
                    { value: "flexible", label: "Flexible" },
                    { value: "overlap", label: "Overlap" },
                ]
            },
            {
                name: "waterfall",
                type: "checkbox",
                checkboxLabel: "Waterfall",
                default: false
            },
            {
                name: "scrollbar",
                type: "checkbox",
                checkboxLabel: "Scrollbar",
                default: true
            },
            {
                name: "permanent",
                type: "buttongroup",
                label: "Visual",
                options: [
                    { value: "default", label: "Default" },
                    { value: "full", label: "Full" },
                    { value: "clipped", label: "Clipped" },
                    { value: "card", label: "Card" },
                ]
            },
            {
                name: "expand",
                type: "buttongroup",
                label: "Drawer",
                faIconName: "expand",
                options: [
                    { value: "expand", label: "Expand" },
                    { value: "permanent", label: "Permanent" },
                ],
                default: "permanent",
            },
        ]
    },
    // ***********************   Toolbar
    {
        name: "GuiToolbar",
        label: "Toolbar",
        props: [
            propPayload("Title"),
            propColor(true),
            {
                name: "size",
                type: "select",
                label: "Size",
                faIconName: "expand",
                options: {
                    default: "Default",
                    dense: "Dense",
                    medium: "Medium",
                    large: "Large",
                }
            },
        ]
    },
    // ***********************   Html
    {
        name: "GuiHtml",
        label: "Html",
        props: [
            propPayload(),
            {
                name: "tag",
                type: "buttongroup",
                label: "Tag",
                options: [
                    { value: "div", label: "Div" },
                    { value: "span", label: "Span" },
                ]
            }
        ]
    },
    // ***********************   Icon
    {
        name: "GuiIcon",
        label: "Icon",
        props: [
            propPayload(),
            propColor()
        ]
    },
    // ***********************   Button
    {
        name: "GuiButton",
        label: "Button",
        props: [
            propPayload("Title"),
            propTyped("action", "Action Payload"),
            propColor(true),
            {
                name: "raised",
                type: "checkbox",
                checkboxLabel: "Raised",
            },
            {
                name: "dense",
                type: "checkbox",
                checkboxLabel: "Dense",
            },
            {
                name: "ripple",
                type: "checkbox",
                checkboxLabel: "Ripple",
            },
            {
                name: "icon",
                type: "checkbox",
                checkboxLabel: "Icon Button",
            },
        ]
    },
    // ***********************   Content
    {
        name: "GuiContent",
        label: "Content",
        props: [
            propPayload("Content"),
            {
                name: "elevation",
                type: "slider",
                label: "Elevation",
                faIconName: "tag",
            },
        ]
    },
    // ***********************   List
    {
        name: "GuiList",
        label: "List",
        props: [
            propPayload(),
            {
                name: "action",
                type: "select",
                label: "Action",
                options: {
                    default: "default",
                    button: "button"
                }
            },
            {
                name: "dense",
                type: "checkbox",
                checkboxLabel: "Dense",
            },
        ]
    },
    // ***********************   Avatar
    {
        name: "GuiAvatar",
        label: "Avatar",
        props: [
            propPayload(),
            propColor(),
            {
                name: "avatarIcon",
                type: "checkbox",
                checkboxLabel: "Icon",
            },
            propSize,
        ]
    },
    // ***********************   Input
    {
        name: "GuiInput",
        label: "Input",
        props: [
            {
                name: "inputType",
                type: "buttongroup",
                label: "Type",
                faIconName: "",
                options: [
                    { value: "text", label: "Text" },
                    { value: "number", label: "Number" },
                    { value: "email", label: "Email" },
                    { value: "password", label: "Password" },
                    { value: "textarea", label: "Textarea" },
                ],
                default: "text",
            },
            propTyped("value", "Value"),
            propTyped("inputLabel", "InputLabel"),
            {
                name: "placeholder",
                type: "input",
                label: "Placeholder",
                default: "",
            },
            {
                name: "inline",
                type: "checkbox",
                checkboxLabel: "Inline",
                default: false,
            },
            {
                name: "disabled",
                type: "checkbox",
                checkboxLabel: "Disabled",
                default: false,
            },
            {
                name: "counter",
                type: "input",
                label: "Counter",
                default: 0,
            },
            {
                name: "maxLength",
                type: "input",
                label: "Max. Length",
                default: 0,
            },
            {
                name: "clearable",
                type: "checkbox",
                checkboxLabel: "Clearable",
                default: 0,
            },
            {
                name: "togglePassword",
                type: "checkbox",
                checkboxLabel: "Toggle Password",
                default: true,
            },
            {
                name: "helperText",
                type: "input",
                label: "Helper Text",
                default: "",
            },
            {
                name: "error",
                type: "input",
                label: "Error Text",
                default: "",
            },
        ]
    },
    // ***********************   Card
    {
        name: "GuiCard",
        label: "Card",
        props: [
            propColor(),
            propCss,
        ]
    },
    // ***********************   Debug
    {
        name: "GuiDebug",
        label: "Debug",
        props: [],
    },
    // ***********************   Layout Row
    {
        name: "GuiRow",
        label: "Layout Row",
        props: [
            {
                name: "gutter",
                type: "checkbox",
                checkboxLabel: "Gutter",
                default: false
            },
        ]
    },
    // ***********************   Layout Column
    {
        name: "GuiColumn",
        label: "Layout Column",
        props: [
            {
                name: "size",
                type: "select",
                label: "Size",
                options: {
                    5: "5",
                    10: "10",
                    15: "15",
                    20: "20",
                    25: "25",
                    30: "30",
                    33: "33",
                    35: "35",
                    40: "40",
                    45: "45",
                    50: "50",
                    55: "55",
                    60: "60",
                    65: "65",
                    66: "66",
                    70: "70",
                    75: "75",
                    80: "80",
                    85: "85",
                    90: "90",
                    95: "95",
                    100: "100",
                }
            },
        ]
    },
    // ***********************   Radio
    {
        name: "GuiRadio",
        label: "Radio",
        props: [
            propTyped("payload", "Binding"),
            propTyped("value", "Value"),
            propTyped("label", "Label"),
            propColor(),
        ]
    },
    // ***********************   Checkbox
    {
        name: "GuiCheckbox",
        label: "Checkbox",
        props: [
            propTyped("payload", "Binding"),
            propTyped("value", "Value"),
            propTyped("label", "Label"),
            propColor(),
        ]
    },
    // ***********************   Switch
    {
        name: "GuiSwitch",
        label: "Switch",
        props: [
            propTyped("payload", "Binding"),
            propTyped("value", "Value"),
            propTyped("label", "Label"),
            propColor(),
        ]
    },
    // ***********************   Form
    {
        name: "GuiForm",
        label: "Form",
        props: [
            propPayload()
        ]
    },
    // ***********************   Select
    {
        name: "GuiSelect",
        label: "Select",
        props: [
            propTyped("label", "Label"),
            propBinding("payload", "Binding"),
            propBinding("options", "Options"),
            {
                name: "dense",
                type: "checkbox",
                checkboxLabel: "Dense",
                default: false,
            },
            {
                name: "multiple",
                type: "checkbox",
                checkboxLabel: "Multiple",
                default: false,
            },
            {
                name: "required",
                type: "checkbox",
                checkboxLabel: "Required",
                default: false,
            },
        ]
    },
    // ***********************   Dialog
    {
        name: "GuiDialog",
        label: "Dialog",
        props: [
            propTyped("title", "Title"),
            {
                name: "backdrop",
                type: "checkbox",
                checkboxLabel: "Backdrop",
                default: true,
            },
            {
                name: "closeOnEsc",
                type: "checkbox",
                checkboxLabel: "Close on ESC",
                default: true,
            },
            {
                name: "closeOnClick",
                type: "checkbox",
                checkboxLabel: "Close on click outside",
                default: true,
            },
            {
                name: "fullscreen",
                type: "checkbox",
                checkboxLabel: "Mobile Fullscreen",
                default: true,
            },
            {
                name: "hide",
                type: "checkbox",
                checkboxLabel: "Hide on Startup",
                default: true,
            },
        ]
    },
    // ***********************   Chip
    {
        name: "GuiChip",
        label: "Chip",
        props: [
            propTyped("payload", "Label"),
            propColor(),
            {
                name: "deletable",
                type: "checkbox",
                checkboxLabel: "Show Delete Button",
                default: false,
            },
            {
                name: "clickable",
                type: "checkbox",
                checkboxLabel: "Make Chip a Button",
                default: false,
            },
            propBoolean("disabled", "Disabled"),
        ]
    },
]

// sort list by alphanumeric
types = types.sort((a, b) => {
    var nameA = a.name.toUpperCase(); // Groß-/Kleinschreibung ignorieren
    var nameB = b.name.toUpperCase(); // Groß-/Kleinschreibung ignorieren
    if (nameA < nameB) {
        return -1;
    }
    if (nameA > nameB) {
        return 1;
    }
    return 0;
});


if (typeof module !== 'undefined' && module.exports) {
    module.exports = types;
}