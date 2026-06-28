# Browser Workspace Manager --- Universal Search Engine

## Engineering Vision & Product Design Document (Foundation Edition)

### Executive Summary

The Universal Search Engine is the intelligence layer of Browser
Workspace Manager. It is designed to evolve from a workspace search
utility into a complete Browser Knowledge Engine capable of discovering
everything the user has interacted with locally.

## Vision

Everything you have seen, opened, downloaded, bookmarked, researched or
organized inside your browser should be discoverable from one search
interface.

## Product Philosophy

-   Local-first
-   Privacy-first
-   Fast-by-default
-   Progressive intelligence
-   Provider-based architecture
-   Feature-driven development

## Search Levels

### Level 1 -- Instant Search

-   Workspaces
-   Tabs
-   URLs
-   Domains
-   Tags

### Level 2 -- Universal Search

-   Archive
-   Downloads
-   Bookmarks
-   History
-   Clipboard
-   Sessions

### Level 3 -- Deep Search

Activated using:

    @deep query

Searches page content and paragraphs.

## Architecture

    UI
    ↓
    Stores
    ↓
    Search Engine
    ↓
    Query Parser
    ↓
    Pipeline
    ↓
    Provider Registry
    ↓
    Providers
    ↓
    Repositories
    ↓
    Mappers
    ↓
    Indexers
    ↓
    Entities

Each layer has a single responsibility.

## Providers

Every searchable source implements the same contract:

-   WorkspaceProvider
-   TabProvider
-   ArchiveProvider
-   SessionProvider
-   DownloadProvider
-   BookmarkProvider
-   HistoryProvider
-   ClipboardProvider
-   PageProvider

## Repository Layer

Repositories retrieve browser data only.

## Mapper Layer

Maps browser objects into searchable entities.

## Indexers

Generate optimized search indexes.

## Ranking

Current: - Exact match - Prefix - Keywords

Future: - Favorites - Recency - Frequency - Semantic similarity

## Discovery

When no query exists show:

-   Resume
-   Favorites
-   Recent Searches
-   Tips

## AI Vision

AI consumes Search Results rather than participating in search.

## Roadmap

v0.1 Workspace Search

v0.2 Universal Search

v0.3 Deep Search

v0.4 AI Assistant

v1.0 Browser Workspace Operating System

## Engineering Principles

-   Stable architecture
-   Incremental delivery
-   Test every milestone
-   Build before new features
-   Ship continuously

## Long-Term Goal

Users should remember ideas, not locations. The search engine should
retrieve information instantly from the user's own browser knowledge.
