# grim

Tracks deprecated API calls and the code that made them.

Fork of [pulsar-edit/grim](https://github.com/pulsar-edit/grim).

Calling `deprecate()` from a deprecated function records the call site, the stacks that reached it, and how many times each one did. The editor surfaces what accumulates through the `deprecation-cop` package, and its spec runner fails a run that adds new deprecation calls.

## Features

- **Call-site grouping**: records one deprecation per file, line, and package, so repeated calls aggregate instead of piling up.
- **Caller attribution**: groups the stacks reaching a deprecation by their caller, so one deprecated function called from three places reports three stacks.
- **Metadata**: accepts arbitrary metadata per call, and treats a `packageName` as part of the grouping key so the blame lands on the right package.
- **Serialization**: converts a deprecation to plain JSON and back, so one recorded in a worker process can be merged into the window's registry.
- **Change notification**: emits `updated` whenever a deprecation is recorded or merged.
- **Shared registry**: stores state on the global, so every copy of this library resolved in a tree reports into one place.

## Installation

```sh
npm install @lumine-code/grim
```

## Usage

```js
const grim = require("@lumine-code/grim");

class Buffer {
  setTextInRange(range, text, options) {
    if (options?.undo != null) {
      grim.deprecate("The `undo` option is deprecated. Call groupLastChanges() instead.");
    }
  }
}

grim.on("updated", (deprecation) => {
  console.log(deprecation.getOriginName(), deprecation.getCallCount());
});

grim.getDeprecations(); // every Deprecation recorded so far
grim.getDeprecationsLength(); // how many there are
grim.logDeprecations(); // warn them to the console, most-called first
grim.clearDeprecations(); // reset the registry
```

## The shared registry

The registry lives on `global.__grim__` and this module exports that object rather than a fresh one. That is deliberate: the editor and the package that displays deprecations each resolve their own copy, and both have to see the same state. A copy that kept private state would leave the panel empty while looking perfectly healthy, so the guard and the export must stay as they are.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
