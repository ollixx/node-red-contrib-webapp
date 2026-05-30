"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_progress(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-progress");
};
