const Deprecation = require("./deprecation");

// The registry lives on the global rather than in this module's scope, and the
// module exports that global object rather than a fresh one.
//
// This is load-bearing, not incidental. The editor and the package that
// surfaces deprecations resolve their own copies of this library -- a bundled
// package pins its own -- and both must see one registry. If each copy kept
// private state, a deprecation recorded through the editor's copy would never
// appear in the panel reading through the package's, and the spec runner, which
// gates its exit code on the deprecation count, would go quietly *greener*
// rather than red. Keep the guard and the export exactly as they are.
if (global.__grim__ == null) {
  const { Emitter } = require("@lumine-code/event-kit");

  global.__grim__ = {
    deprecations: {},
    emitter: new Emitter(),
    includeDeprecatedAPIs: true,

    getDeprecations() {
      const deprecations = [];

      for (const deprecationsByLineNumber of Object.values(grim.deprecations)) {
        for (const deprecationsByPackage of Object.values(deprecationsByLineNumber)) {
          for (const deprecation of Object.values(deprecationsByPackage)) {
            deprecations.push(deprecation);
          }
        }
      }

      return deprecations;
    },

    getDeprecationsLength() {
      return this.getDeprecations().length;
    },

    clearDeprecations() {
      grim.deprecations = {};
    },

    logDeprecations() {
      const deprecations = this.getDeprecations();
      deprecations.sort((a, b) => b.getCallCount() - a.getCallCount());

      console.warn("\nCalls to deprecated functions\n-----------------------------");
      for (const deprecation of deprecations) {
        console.warn(
          `(${deprecation.getCallCount()}) ${deprecation.getOriginName()} : ${deprecation.getMessage()}`,
          deprecation,
        );
      }
    },

    deprecate(message, metadata) {
      const originalStackTraceLimit = Error.stackTraceLimit;
      let stack;

      try {
        // Deep enough to name the caller and its caller, shallow enough that a
        // deprecation on a hot path stays cheap.
        Error.stackTraceLimit = 7;
        const error = new Error();
        // The editor installs `getRawStack` on Error.prototype via its compile
        // cache; fall back to capturing one directly when it has not.
        stack =
          (typeof error.getRawStack === "function" ? error.getRawStack() : null) ??
          getRawStack(error);
        stack = stack.slice(1);
      } finally {
        Error.stackTraceLimit = originalStackTraceLimit;
      }

      const deprecationSite = stack[0];
      const fileName = deprecationSite.getFileName();
      const lineNumber = deprecationSite.getLineNumber();
      const packageName = metadata?.packageName ?? "";

      grim.deprecations[fileName] ??= {};
      grim.deprecations[fileName][lineNumber] ??= {};
      grim.deprecations[fileName][lineNumber][packageName] ??= new Deprecation(message);

      const deprecation = grim.deprecations[fileName][lineNumber][packageName];
      deprecation.addStack(stack, metadata);
      grim.emitter.emit("updated", deprecation);
    },

    addSerializedDeprecation(serializedDeprecation) {
      const deserialized = Deprecation.deserialize(serializedDeprecation);
      const message = deserialized.getMessage();
      const { fileName, lineNumber } = deserialized;
      const stacks = deserialized.getStacks();
      const packageName = stacks[0]?.metadata?.packageName ?? "";

      grim.deprecations[fileName] ??= {};
      grim.deprecations[fileName][lineNumber] ??= {};
      grim.deprecations[fileName][lineNumber][packageName] ??= new Deprecation(
        message,
        fileName,
        lineNumber,
      );

      const deprecation = grim.deprecations[fileName][lineNumber][packageName];
      for (const stack of stacks) {
        deprecation.addStack(stack, stack.metadata);
      }
      grim.emitter.emit("updated", deprecation);
    },

    on(eventName, callback) {
      return grim.emitter.on(eventName, callback);
    },
  };
}

const grim = global.__grim__;

function getRawStack(error) {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = (_error, stack) => stack;
  Error.captureStackTrace(error, getRawStack);
  const result = error.stack;
  Error.prepareStackTrace = originalPrepareStackTrace;
  return result;
}

module.exports = grim;
