"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_badge(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-badge");
};
