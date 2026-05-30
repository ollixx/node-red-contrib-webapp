"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_textarea(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-textarea");
};
