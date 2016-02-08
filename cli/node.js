module.exports = Node;

/**
 * Represents a node in the tree of commands and categories of a CLI application
 */
function Node(name, options) {
    this.name = name;
    this.options = options;
    this.parent = null;
}

Node.prototype.configure = function (parser) {};

Node.prototype.setParent = function (parent) {
    this.parent = parent;
};
