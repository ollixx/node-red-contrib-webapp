"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_avatar(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-avatar");
};
