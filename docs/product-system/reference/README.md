# Implementation reference index

The [product design](../product-design.md) and
[system architecture](../system-architecture.md) are the cross-cutting
overviews. This directory documents the implementation units behind those
overviews in focused pages. Use the coverage pages as source-to-document maps.

## API controllers

Each application controller has an individual implementation reference:

- [Authentication controller](controllers/authController.md)
- [Student controller](controllers/studentController.md)
- [Teacher controller](controllers/teacherController.md)
- [Administrator controller](controllers/adminController.md)
- [Game and progression controller](controllers/gameController.md)

The pages describe controller entry points, request handling, validation,
service/data access, response behavior, and route associations.

## Frontend and user experience

- [Frontend inventory and coverage map](frontend/README.md) maps every
  application-authored component/helper source to its individual reference,
  and indexes all 56 UI primitive source files.
- [UI primitives catalogue](frontend/ui-primitives.md) inventories the shared
  primitive components; product-specific KPI components have a separate
  [KPI reference](frontend/kpi-components.md).

## Backend, data, and domain modules

- [Backend inventory and coverage map](backend/coverage.md) maps each covered
  source module to its detailed reference.
- [Canonical schema contract](backend/schema-contract.md) documents the
  database entities and constraints used by the application.

## Routes and runtime

- [App route and layout entry points](runtime/app-entrypoints.md) inventories
  the App Router pages, layouts, and handlers.
- [API adapter and registry](runtime/api-routing.md) documents HTTP dispatch,
  route matching, and access checks; controller implementation is documented
  separately above.
- [Health endpoints](runtime/health-endpoints.md) documents health handler
  behavior and readiness limitations.
- [Runtime configuration](runtime/runtime-configuration.md) documents
  environment and application configuration.
- [Build, tests, and deployment evidence](runtime/testing-build-deployment.md)
  documents scripts and repository-visible operational assumptions.

## Shared presentation utilities

- [Dashboard logout event contract](shared/dashboard-events.md)
- [Number and delta formatting](shared/format.md)
- [Class-name utility export](shared/utils.md)

## Coverage and interpretation

The inventories document their scope and any intentional grouping or
exclusions. Generated output and installed dependencies are not treated as
application source. These references describe behavior visible in the checked
in files; they do not establish how an uninspected production deployment is
configured.
