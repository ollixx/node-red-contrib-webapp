
let propColor = function(transparent = false) {
    let prop = {
        name: "color",
        type: "buttongroup",
        label: "Color",
        faIconName: "paint-brush",
        options: [
            { value: "default", label: "Default"},
            { value: "primary", label: "Primary"},
            { value: "accent", label: "Accent"},
        ]
    }
    if (transparent) {
        prop.options.push({value: "transparent", label: "Transparent"});
    }
    return prop;
}

let propSize = {
    name: "size",
    type: "buttongroup",
    label: "Size",
    faIconName: "expand",
    options: [
        { value: "small", label: "Small"},
        { value: "default", label: "Default"},
        { value: "large", label: "Large"},
    ]
};

let propCss = {
    name: "css",
    type: "string",
    label: "Css",
}

let propPayload = function(label = "Payload") {
    return {
        name: "payload",
        type: "typedinput",
        typedInput: {
            types: ["str", "num", "bool", "json", {value: "par", label: "parent"}, {value: "mod", label: "model"}]
        },
        label: label,
        default: {value: "", type: "json"}
    }
}

types = [
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
                    {value: "default", label: "Default"},
                    {value: "fixed", label: "Fixed"},
                    {value: "fixed-last", label: "Fixed Last"},
                    {value: "reveal", label: "Reveal"},
                    {value: "flexible", label: "Flexible"},
                    {value: "overlap", label: "Overlap"},
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
                    {value: "default", label: "Default"},
                    {value: "full", label: "Full"},
                    {value: "clipped", label: "Clipped"},
                    {value: "card", label: "Card"},
                ]
            },
            {
                name: "expand",
                type: "buttongroup",
                label: "Drawer",
                faIconName: "expand",
                options: [
                    {value: "expand", label: "Expand"},
                    {value: "permanent", label: "Permanent"},
                ],
                default: "permanent",
            },
        ]
    },
    {
        name: "GuiToolbar",
        label: "Toolbar",
        props: [
            {
                name: "payload",
                type: "string",
                label: "Title",
            },
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
    {
        name: "GuiHtml",
        label: "Html",
        props: [
            propPayload()
        ]
    },
    {
        name: "GuiButton",
        label: "Button",
        props: [
            {
                name: "payload",
                type: "string",
                label: "Title",
                faIconName: "tag",
            },
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
        ]
    },
    {
        name: "GuiContent",
        label: "Content",
        props: [
            {
                name: "payload",
                type: "editor",
                label: "Content",
                faIconName: "tag",
            },
            {
                name: "elevation",
                type: "slider",
                label: "Elevation",
                faIconName: "tag",
            },
        ]
    },
    {
        name: "GuiList",
        label: "List",
        props: [
            {
                name: "payload",
                type: "typedinput",
                typedInput: {
                    types: ["msg", "json", {value: "par", label: "parent"}]
                },
                label: "Payload",
                faIconName: "code",
            },
        ]
    },
    {
        name: "GuiAvatar",
        label: "Avatar",
        props: [
            {
                name: "payload",
                type: "string",
                label: "Payload",
                faIconName: "code",
            },
            propColor(),
            {
                name: "avatarIcon",
                type: "checkbox",
                checkboxLabel: "Icon",
            },
            propSize,
        ]
    },
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
                    {value: "text", label: "Text"},
                    {value: "number", label: "Number"},
                    {value: "email", label: "Email"},
                    {value: "password", label: "Password"},
                    {value: "textarea", label: "Textarea"},
                ],
                default: "text",
            },
            {
                name: "payload",
                type: "string",
                label: "Value",
            },
            {
                name: "inputLabel",
                type: "string",
                label: "Label",
                default: "",
            },
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
    {
        name: "GuiCard",
        label: "Card",
        props: [
            propColor(),
            propCss,
        ]
    },
    {
        name: "GuiDebug",
        label: "Debug",
        props: [],
    },
]

if (typeof module !== 'undefined' && module.exports) {
    module.exports = types;
}