// A parse tree written short, the same way for both parsers: each node as its name, followed by its
// children in parentheses, `Node(Child Child)`. A parse error is the node ⚠.

export class Tree {
  #name;
  #children;

  constructor(name, children = []) {
    this.#name = name;
    this.#children = children;
  }

  /** The tree of the expression of a single expression: `WITH ND-Root COMPUTE expression`. */
  expression() {
    const children = this.#find('SingleExpression')?.#children ?? [];
    const compute = children.findIndex((child) => child.#name === 'Compute');
    return compute < 0 ? undefined : children[compute + 1];
  }

  toString() {
    return this.#children.length === 0 ? this.#name : `${this.#name}(${this.#children.join(' ')})`;
  }

  #find(name) {
    if (this.#name === name) {
      return this;
    }
    return this.#children.map((child) => child.#find(name)).find((found) => found !== undefined);
  }
}
