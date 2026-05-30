"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_image(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-image");
};
