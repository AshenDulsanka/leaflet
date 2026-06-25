---
title: "Route Handler Tests Must Provide RequestEvent.url"
date: 2026-04-29
type: learning
status: active
agent: coder
task: "Fix screenshots filename DELETE test mismatch"
tags:
  - learning
  - testing
  - sveltekit
---

# Route Handler Tests Must Provide RequestEvent.url

## Learning

When directly invoking SvelteKit route handlers in tests, include a URL object in the mocked event if handler code reads url.searchParams.

## Why

Missing url in mocked RequestEvent causes runtime TypeError even though real SvelteKit runtime always provides it.

## Related

- [[patterns/api-route-validation]]
- [[features/screenshots]]
