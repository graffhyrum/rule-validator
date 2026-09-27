# Packages

Each folder here is a deep module: a lot of behaviour behind a small interface.

```
src/packages/<name>/
  index.ts        entry point (public). Import this from outside.
  client.ts       another entry point. A package may expose several.
  lib/            implementation. Hidden from outside.
  tests/          tests and fixtures. Hidden from outside.
```

Import only through a package's entry points (its root files). A root file is public. A file in any subfolder is private. `lib/` holds implementation. `tests/` holds tests. A new subfolder is private too. You do not change the boundary config to add one.

Copy `example/` when you add a package, or delete `example/` when you no longer need the template.

## Entry-point boundary

Code outside a package may import that package's root files only. It may not import a subfolder.

## Intra-package freedom

Files in one package may import each other, including `lib/`.

## Tests through the entry points

A file in `<pkg>/tests/` may import any package's root files and its own `tests/` fixtures. It may not import any package's subfolder, including its own `lib/`.

## No cycles

Do not add a dependency cycle.

Expose several small entry points. Do not re-export a whole subtree through one `index.ts`.

Run the check:

```shell
bun run lint:boundaries
```
