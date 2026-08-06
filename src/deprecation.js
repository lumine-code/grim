// A single deprecated call site, together with every stack that reached it.
//
// `Grim.deprecate` records one of these per file/line/package, and the panel
// that surfaces them reads `getMessage`, `getOriginName`, `getStacks` and
// `getStackCount`. `serialize`/`deserialize` carry one across the Task IPC
// boundary, so a deprecation hit in a worker still reaches the window.
module.exports = class Deprecation {
  static deserialize({ message, fileName, lineNumber, stacks }) {
    const deprecation = new Deprecation(message, fileName, lineNumber);
    for (const stack of stacks) {
      deprecation.addStack(stack, stack.metadata);
    }
    return deprecation;
  }

  constructor(message, fileName, lineNumber) {
    this.message = message;
    this.fileName = fileName;
    this.lineNumber = lineNumber;
    this.callCount = 0;
    this.stackCount = 0;
    this.stacks = {};
    this.stackCallCounts = {};
  }

  // A call site is either a real V8 CallSite or, once it has crossed the IPC
  // boundary, the plain object `parseStack` produced from one -- hence the
  // property check before every accessor call.
  getFunctionNameFromCallsite(callsite) {
    if (callsite.functionName != null) {
      return callsite.functionName;
    }

    if (callsite.isToplevel()) {
      return callsite.getFunctionName() ?? "<unknown>";
    }

    if (callsite.isConstructor()) {
      return `new ${callsite.getFunctionName()}`;
    }

    if (callsite.getMethodName() && !callsite.getFunctionName()) {
      return callsite.getMethodName();
    }

    return `${callsite.getTypeName()}.${callsite.getMethodName() ?? callsite.getFunctionName() ?? "<anonymous>"}`;
  }

  getLocationFromCallsite(callsite) {
    if (callsite == null) {
      return "unknown";
    }

    if (callsite.location != null) {
      return callsite.location;
    }

    if (callsite.isNative()) {
      return "native";
    }

    if (callsite.isEval()) {
      return `eval at ${this.getLocationFromCallsite(callsite.getEvalOrigin())}`;
    }

    return `${callsite.getFileName()}:${callsite.getLineNumber()}:${callsite.getColumnNumber()}`;
  }

  getFileNameFromCallSite(callsite) {
    return callsite.fileName ?? callsite.getFileName();
  }

  getOriginName() {
    return this.originName;
  }

  getMessage() {
    return this.message;
  }

  getStacks() {
    const parsedStacks = [];

    for (const location of Object.keys(this.stacks)) {
      const stack = this.stacks[location];
      const parsedStack = this.parseStack(stack);
      parsedStack.callCount = this.stackCallCounts[location];
      parsedStack.metadata = stack.metadata;
      parsedStacks.push(parsedStack);
    }

    return parsedStacks;
  }

  getStackCount() {
    return this.stackCount;
  }

  getCallCount() {
    return this.callCount;
  }

  addStack(stack, metadata) {
    this.originName ??= this.getFunctionNameFromCallsite(stack[0]);
    this.fileName ??= this.getFileNameFromCallSite(stack[0]);
    this.lineNumber ??= stack[0].getLineNumber?.();

    this.callCount++;
    stack.metadata = metadata;

    // Group by the *caller*, so one deprecated function called from three
    // places reports three stacks rather than one per invocation.
    const callerLocation = this.getLocationFromCallsite(stack[1]);
    if (this.stacks[callerLocation] == null) {
      this.stacks[callerLocation] = stack;
      this.stackCount++;
    }
    this.stackCallCounts[callerLocation] ??= 0;
    return this.stackCallCounts[callerLocation]++;
  }

  parseStack(stack) {
    return stack.map((callsite) => ({
      functionName: this.getFunctionNameFromCallsite(callsite),
      location: this.getLocationFromCallsite(callsite),
      fileName: this.getFileNameFromCallSite(callsite),
    }));
  }

  serialize() {
    return {
      message: this.getMessage(),
      lineNumber: this.lineNumber,
      fileName: this.fileName,
      stacks: this.getStacks(),
    };
  }
};
