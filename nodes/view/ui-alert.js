"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_alert(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-alert");
};
