Product Requirements Document (PRD)

Obsidian Plugin for Antora + AsciiDoc Authoring


---

1. Overview

Product Name

Obsidian Antora AsciiDoc Toolkit

Purpose

Create an Obsidian plugin that transforms Obsidian into a first-class authoring environment for Antora and AsciiDoc documentation projects.

The plugin should provide:

Antora-aware vault/project support

Intelligent AsciiDoc editing

Live preview enhancements

Antora component/module/version navigation

Cross-reference management

Attribute resolution

Build integration

Validation and linting

Developer tooling integration


The goal is to make Obsidian competitive with IDE-based documentation authoring workflows while preserving the lightweight writing experience users expect from Obsidian.


---

2. Problem Statement

Obsidian has excellent Markdown support but limited native support for:

AsciiDoc authoring

Antora project structures

Antora xrefs

Antora attributes

Component/module/version semantics

Navigation across distributed documentation repositories


Current workflows require developers to:

Use IntelliJ IDEA or VS Code

Manually validate xrefs

Context-switch between editor and terminal

Memorize Antora path syntax

Manually run site builds


This reduces productivity and increases authoring friction.


---

3. Goals

Primary Goals

G1 — First-Class AsciiDoc Editing

Provide rich AsciiDoc editing capabilities inside Obsidian.

G2 — Antora Project Awareness

Understand Antora repository structures and semantics.

G3 — Cross-Reference Intelligence

Enable autocomplete, validation, and navigation for Antora xrefs.

G4 — Documentation Build Workflow

Allow local Antora site generation from Obsidian.

G5 — Reduce Documentation Errors

Detect broken xrefs, invalid attributes, and structural issues early.


---

4. Non-Goals

Out of Scope (Initial Release)

Full Antora runtime replacement

Full semantic AsciiDoc parser implementation

WYSIWYG editor

Git hosting integration (GitHub/GitLab APIs)

Multi-user collaboration

Embedded browser-based Antora UI

Visual site map editor

AI documentation generation



---

5. Target Users

Primary Users

Documentation Engineers

Teams building enterprise documentation portals with Antora.

Developer Advocates

Technical writers maintaining API and platform documentation.

Software Engineers

Developers documenting services, SDKs, and internal systems.

Open Source Maintainers

Projects already using Antora ecosystems.


---

6. User Stories

Editing

US-1

As a documentation author, I want syntax highlighting for AsciiDoc so I can write documentation comfortably.

US-2

As a writer, I want autocomplete for Antora xrefs so I do not memorize paths.

US-3

As a developer, I want inline validation of broken xrefs so I can fix issues immediately.

US-4

As a user, I want Antora attributes resolved in preview mode.


---

Navigation

US-5

As a writer, I want to Ctrl+Click xrefs to navigate between pages.

US-6

As a user, I want to browse Antora components/modules/versions from a sidebar.


---

Build Workflow

US-7

As a user, I want to run an Antora build from Obsidian.

US-8

As a user, I want build errors linked back to source files.


---

Project Awareness

US-9

As a user, I want the plugin to automatically detect Antora projects.

US-10

As a user, I want support for multi-repository Antora workspaces.


---

7. Functional Requirements

7.1 Antora Project Detection

Requirements

FR-1

Detect:

antora.yml

site.yml

playbook files

component versions


FR-2

Identify:

component name

module names

version

navigation files


FR-3

Support:

mono-repo layouts

multi-repo workspaces

symlinked content sources



---

7.2 AsciiDoc Editing Support

Requirements

FR-4

Provide syntax highlighting for:

blocks

macros

attributes

xrefs

includes

admonitions

tables


FR-5

Provide autocomplete for:

block macros

attributes

xrefs

images

includes


FR-6

Provide hover tooltips for:

attributes

xrefs

includes


FR-7

Provide folding support for:

sections

blocks

examples

tables



---

7.3 Antora Xref Support

Requirements

FR-8

Parse all valid Antora xref formats:

xref:page.adoc[]

xref:module:page.adoc[]

xref:component:module:page.adoc[]

versioned references


FR-9

Provide autocomplete for:

components

modules

pages

anchors


FR-10

Validate:

missing targets

invalid modules

invalid components

invalid anchors


FR-11

Enable navigation to xref targets.

FR-12

Provide rename/refactor support for pages and anchors.


---

7.4 Attribute Resolution

Requirements

FR-13

Resolve:

page attributes

component attributes

playbook attributes


FR-14

Support:

attribute inheritance

overrides

conditional attributes


FR-15

Preview resolved content.


---

7.5 Include Support

Requirements

FR-16

Resolve include directives.

FR-17

Support:

tagged includes

partial includes

relative includes


FR-18

Validate broken includes.


---

7.6 Preview System

Requirements

FR-19

Provide enhanced AsciiDoc preview.

FR-20

Use Antora-aware rendering context.

FR-21

Support:

admonitions

tabs

diagrams

callouts

syntax highlighting


FR-22

Resolve:

images

attachments

includes

xrefs



---

7.7 Build Integration

Requirements

FR-23

Allow running:

antora

local build scripts

npm scripts


FR-24

Display build output in Obsidian panel.

FR-25

Parse build errors and warnings.

FR-26

Link errors to source locations.

FR-27

Support Docker-based Antora builds.


---

7.8 Search and Navigation

Requirements

FR-28

Provide Antora-aware global search.

FR-29

Allow filtering by:

component

module

version


FR-30

Provide graph view enhancements using Antora xrefs.


---

7.9 Linting and Validation

Requirements

FR-31

Detect:

broken xrefs

orphan pages

invalid includes

duplicate IDs

invalid attributes


FR-32

Provide diagnostics panel.

FR-33

Support external linters:

Vale

asciidoctor-lint



---

8. Technical Architecture

8.1 Technology Stack

Core

TypeScript

Obsidian Plugin API


Parsing

Asciidoctor.js

Antora libraries where feasible


UI

CodeMirror 6 extensions

Obsidian workspace APIs


Build Execution

Node.js child_process



---

8.2 Plugin Modules

Module: Workspace Scanner

Responsibilities:

detect Antora projects

cache structure metadata



---

Module: AsciiDoc Parser

Responsibilities:

tokenize documents

extract xrefs

extract anchors

extract attributes



---

Module: Indexer

Responsibilities:

maintain searchable graph

index pages/anchors/modules/components



---

Module: Preview Renderer

Responsibilities:

render AsciiDoc

resolve Antora context



---

Module: Build Runner

Responsibilities:

execute Antora builds

capture output

parse errors



---

Module: Diagnostics Engine

Responsibilities:

validation

linting

diagnostics aggregation



---

9. UI/UX Requirements

9.1 Sidebar View

Antora Explorer

Tree structure:

Component
 ├── Version
 │    ├── Module
 │    │    ├── Pages
 │    │    ├── Partials
 │    │    ├── Examples
 │    │    └── Assets

Capabilities:

click to open

search

filter

context menu actions



---

9.2 Editor Enhancements

Inline Decorations

broken xrefs underlined red

unresolved attributes highlighted

include previews on hover



---

9.3 Commands

Required Commands

Reindex Antora workspace

Build Antora site

Validate current page

Open component explorer

Resolve attributes

Show diagnostics



---

10. Performance Requirements

PR-1

Workspace indexing under:

5 seconds for 5,000 pages


PR-2

Autocomplete response:

under 100ms


PR-3

Incremental reindexing:

file-change based


PR-4

Memory usage:

under 500MB for large workspaces



---

11. Compatibility Requirements

Supported Platforms

Windows

macOS

Linux


Supported Obsidian Versions

Latest stable

Previous minor version


Supported Antora Versions

Antora 3.x+

Asciidoctor 2.x+



---

12. Risks

Risk: Antora Internal APIs

Antora internal APIs may change.

Mitigation

Abstract Antora integration behind adapters.


---

Risk: Large Repository Performance

Mitigation

Incremental indexing and caching.


---

Risk: AsciiDoc Complexity

Mitigation

Leverage Asciidoctor.js instead of custom parsing.


---

13. MVP Scope

Included in MVP

Antora project detection

Syntax highlighting

Xref autocomplete

Xref validation

Basic preview

Build runner

Diagnostics panel

Navigation support



---

Deferred

Anchor rename refactoring

Visual graph enhancements

Distributed workspace synchronization

Advanced semantic analysis

Live Antora dev server integration



---

14. Future Enhancements

Phase 2

Antora content catalog visualization

Intelligent refactoring

Diagram live rendering

Git-aware navigation

Multi-playbook support

Workspace templates



---

Phase 3

AI-assisted documentation authoring

Semantic link recommendations

Documentation coverage analysis

Architecture diagram generation



---

15. Suggested Open Source Libraries

Recommended

AsciiDoc

Asciidoctor.js


Antora

Antora Core


Obsidian Plugin Development

Obsidian Sample Plugin


Linting

Vale



---

16. Recommended Architecture Opinion

A strong design choice is to avoid trying to fully emulate Antora internally.

Instead:

Use Antora’s own parsing/catalog concepts where possible

Build a lightweight indexed representation optimized for editor UX

Treat the plugin as an intelligent authoring layer rather than a static-site generator replacement


This dramatically reduces maintenance complexity and future-proofs the plugin against Antora ecosystem changes.


---

17. Success Metrics

Adoption Metrics

Plugin downloads

Active users

GitHub stars


Quality Metrics

Broken xref reduction

Build failure reduction

Faster documentation authoring workflows


Performance Metrics

Index speed

Validation speed

Preview rendering latency



---

18. Acceptance Criteria

MVP Acceptance

The plugin is considered successful when a user can:

1. Open an Antora repository in Obsidian


2. Edit .adoc files with rich syntax support


3. Autocomplete xrefs


4. Navigate xrefs


5. Detect broken references


6. Build the Antora site


7. View diagnostics


8. Work efficiently without switching editors


