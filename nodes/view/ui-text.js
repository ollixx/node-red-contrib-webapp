"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_text(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-text");
};
