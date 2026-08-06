const grim = require("../src/grim");
const Deprecation = require("../src/deprecation");

describe("Grim", function () {
  beforeEach(function () {
    expect(grim.includeDeprecatedAPIs).toBe(true);
  });

  afterEach(function () {
    grim.clearDeprecations();
  });

  describe("a deprecated constructor method", function () {
    it("logs a warning", function () {
      class Cow {
        constructor() {
          grim.deprecate("Use new Goat instead.");
        }
      }

      new Cow();

      expect(grim.getDeprecations().length).toBe(1);
      const deprecation = grim.getDeprecations()[0];
      expect(deprecation).toBeDefined();
      expect(deprecation.getMessage()).toBe("Use new Goat instead.");
      expect(deprecation.getCallCount()).toBe(1);
      expect(deprecation.getStacks().length).toBe(1);
      expect(deprecation.getStackCount()).toBe(1);
    });
  });

  describe("a deprecated class method", function () {
    it("logs a warning", function () {
      class Cow {
        static moo() {
          grim.deprecate("Use Cow.say instead.");
        }
      }

      Cow.moo();

      expect(grim.getDeprecations().length).toBe(1);
      const deprecation = grim.getDeprecations()[0];
      expect(deprecation).toBeDefined();
      expect(deprecation.getMessage()).toBe("Use Cow.say instead.");
      expect(deprecation.getCallCount()).toBe(1);
      expect(deprecation.getStacks().length).toBe(1);
      expect(deprecation.getStackCount()).toBe(1);
    });
  });

  describe("a deprecated class instance method", function () {
    it("logs a warning", function () {
      class Cow {
        moo() {
          grim.deprecate("Use Cow::say instead.");
        }
      }

      new Cow().moo();

      expect(grim.getDeprecations().length).toBe(1);
      const deprecation = grim.getDeprecations()[0];
      expect(deprecation).toBeDefined();
      expect(deprecation.getMessage()).toBe("Use Cow::say instead.");
      expect(deprecation.getCallCount()).toBe(1);
      expect(deprecation.getStacks().length).toBe(1);
    });
  });

  describe("a deprecated function", function () {
    it("logs a warning", function () {
      const suchFunction = () => grim.deprecate("Use soWow instead.");
      suchFunction();

      expect(grim.getDeprecations().length).toBe(1);
      const deprecation = grim.getDeprecations()[0];
      expect(deprecation).toBeDefined();
      expect(deprecation.getMessage()).toBe("Use soWow instead.");
      expect(deprecation.getCallCount()).toBe(1);
      expect(deprecation.getStacks().length).toBe(1);
    });

    it("gracefully handles async invocations", function (done) {
      const suchFunction = () => grim.deprecate("Use soWow instead.");

      setTimeout(function () {
        suchFunction();

        const deprecation = grim.getDeprecations()[0];
        expect(deprecation.getLocationFromCallsite()).toBe("unknown");

        done();
      }, 0);
    });
  });

  describe("when a deprecated function is called more than once", function () {
    it("increments the count and appends the new stack trace", function () {
      const suchFunction = () => grim.deprecate("Use soWow instead.");

      suchFunction();
      expect(grim.getDeprecations().length).toBe(1);
      let deprecation = grim.getDeprecations()[0];
      expect(deprecation.getCallCount()).toBe(1);
      expect(deprecation.getStacks().length).toBe(1);

      suchFunction();
      expect(grim.getDeprecations().length).toBe(1);
      deprecation = grim.getDeprecations()[0];
      expect(deprecation.getCallCount()).toBe(2);
      expect(deprecation.getStacks().length).toBe(2);
      expect(deprecation.getStackCount()).toBe(2);
      expect(deprecation.getStacks()[0].callCount).toBe(1);
      expect(deprecation.getStacks()[1].callCount).toBe(1);
    });

    it("does not store multiple stack traces for the same call site", function () {
      const suchFunction = () => grim.deprecate("Use soWow instead.");
      for (let i = 0; i < 3; i++) suchFunction();

      expect(grim.getDeprecations().length).toBe(1);
      const deprecation = grim.getDeprecations()[0];
      expect(deprecation.getCallCount()).toBe(3);
      expect(deprecation.getStacks().length).toBe(1);
      expect(deprecation.getStacks()[0].callCount).toBe(3);
    });
  });

  describe("when metadata is provided as a second argument", function () {
    it("associates the metadata with the stack trace", function () {
      const deprecatedFn = (metadata) => grim.deprecate("It's deprecated.", metadata);

      deprecatedFn({ foo: "bar" });
      deprecatedFn({ baz: "quux" });

      expect(grim.getDeprecations().length).toBe(1);
      const [deprecation] = grim.getDeprecations();
      expect(deprecation.getStacks()[0].metadata).toEqual({ foo: "bar" });
      expect(deprecation.getStacks()[1].metadata).toEqual({ baz: "quux" });
    });

    describe("when a packageName is defined", function () {
      it("uses the packageName when grouping deprecations with the same call stack", function () {
        const deprecatedFn = (metadata) => grim.deprecate("It's deprecated.", metadata);

        deprecatedFn({ packageName: "bar" });
        deprecatedFn({ packageName: "bar" });
        deprecatedFn({ packageName: "quux" });
        deprecatedFn({ packageName: "quux" });

        expect(grim.getDeprecations().length).toBe(2);
        let [deprecation1, deprecation2] = grim.getDeprecations();
        expect(deprecation1.callCount).toBe(2);
        expect(deprecation1.getStacks()[0].metadata).toEqual({ packageName: "bar" });
        expect(deprecation2.callCount).toBe(2);
        expect(deprecation2.getStacks()[0].metadata).toEqual({ packageName: "quux" });

        grim.addSerializedDeprecation(deprecation1.serialize());
        expect(grim.getDeprecationsLength()).toBe(2);
        [deprecation1, deprecation2] = grim.getDeprecations();
        expect(deprecation1.callCount).toBe(4);
        expect(deprecation1.getStacks()[0].metadata).toEqual({ packageName: "bar" });
        expect(deprecation2.callCount).toBe(2);
        expect(deprecation2.getStacks()[0].metadata).toEqual({ packageName: "quux" });
      });
    });
  });

  it("calls console.warn when .logDeprecations is called", function () {
    spyOn(console, "warn");
    const suchFunction = () => grim.deprecate("Use soWow instead.");
    suchFunction();

    expect(console.warn).not.toHaveBeenCalled();
    grim.logDeprecations();
    expect(console.warn).toHaveBeenCalled();
  });

  it("emits the 'updated' event when a new deprecation error is logged", function () {
    const updatedHandler = jasmine.createSpy("updated");
    const subscription = grim.on("updated", updatedHandler);
    grim.deprecate("Something deprecated was called.");

    expect(updatedHandler).toHaveBeenCalled();
    subscription.dispose();
  });

  it("supports JSON serializing/deserializing", function () {
    const metadata = { foo: "bar" };
    grim.deprecate("no good", metadata);

    let [deprecation] = grim.getDeprecations();
    expect(deprecation.getCallCount()).toBe(1);
    expect(grim.getDeprecationsLength()).toBe(1);
    expect(deprecation.getStacks().length).toBe(1);
    expect(deprecation.getStacks()[0].callCount).toBe(1);

    const deserialized = Deprecation.deserialize(deprecation.serialize());
    expect(deserialized.constructor).toBe(deprecation.constructor);
    expect(deserialized.getMessage()).toBe(deprecation.getMessage());
    expect(deserialized.getOriginName()).toBe(deprecation.getOriginName());
    expect(deserialized.getCallCount()).toBe(deprecation.getCallCount());
    expect(deserialized.getStacks()).toEqual(deprecation.getStacks());

    grim.addSerializedDeprecation(deprecation.serialize());
    expect(grim.getDeprecationsLength()).toBe(1);
    expect(deprecation.getCallCount()).toBe(2);
    expect(deprecation.getStacks().length).toBe(1);
    expect(deprecation.getStacks()[0].callCount).toBe(2);

    grim.clearDeprecations();
    grim.addSerializedDeprecation(deprecation.serialize());
    [deprecation] = grim.getDeprecations();
    expect(grim.getDeprecationsLength()).toBe(1);
    expect(deprecation.getCallCount()).toBe(1);
    expect(deprecation.getStacks().length).toBe(1);
    expect(deprecation.getStacks()[0].callCount).toBe(1);
    expect(deserialized.constructor).toBe(deprecation.constructor);
    expect(deserialized.getMessage()).toBe(deprecation.getMessage());
    expect(deserialized.getOriginName()).toBe(deprecation.getOriginName());
    expect(deserialized.getCallCount()).toBe(deprecation.getCallCount());
    expect(deserialized.getStacks()).toEqual(deprecation.getStacks());
  });

  describe("the shared registry", function () {
    it("exports the object stored on the global", function () {
      // A second copy of this library resolved elsewhere in the tree must hand
      // back the same registry, or deprecations recorded through one copy are
      // invisible to a panel reading through the other.
      expect(grim).toBe(global.__grim__);
    });

    it("keeps deprecate replaceable so specs can spy on it", function () {
      const descriptor = Object.getOwnPropertyDescriptor(grim, "deprecate");
      expect(descriptor.writable).toBe(true);
      expect(descriptor.configurable).toBe(true);
    });

    it("keeps deprecations assignable so specs can snapshot and restore them", function () {
      // The editor's spec harness shallow-clones this table before each suite
      // and assigns it back afterward, so the property has to stay writable and
      // the table has to be a plain object keyed by file name.
      const snapshot = { ...grim.deprecations };
      grim.deprecate("snapshot me");
      expect(grim.getDeprecationsLength()).toBe(1);

      grim.deprecations = snapshot;
      expect(grim.getDeprecationsLength()).toBe(0);
    });
  });
});
