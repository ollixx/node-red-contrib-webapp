
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
        prop.transparent = "Transparent";
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

types = [
    {
        name: "GuiApp",
        label: "App",
        props: [
            {
                name: "md-mode",
                type: "radio",
                label: "Mode",
                faIconName: "sliders",
                options: {
                    default: "Default",
                    fixed: "Fixed",
                    "fixed-last": "Fixed Last",
                    reveal: "Reveal",
                    flexible: "Flexible",
                    overlap: "Overlap",
                }
            },
            {
                name: "md-waterfall",
                type: "checkbox",
                label: "Waterfall",
                faIconName: "sliders",
                default: false
            },
            {
                name: "md-scrollbar",
                type: "checkbox",
                label: "Scrollbar",
                faIconName: "sliders",
                default: true
            }
        ]
    },
    {
        name: "GuiToolbar",
        label: "Toolbar",
        props: [
        {
                name: "color",
                type: "select",
                label: "Color",
                faIconName: "paint-brush",
                options: {
                    default: "Default",
                    transparent: "Transparent",
                    primary: "Primary",
                    accent: "Accent"
                }
            },
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
            {
                name: "payload",
                type: "editor",
                label: "Payload",
                faIconName: "code",
            },
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
]

if (typeof module !== 'undefined' && module.exports) {
    module.exports = types;
}