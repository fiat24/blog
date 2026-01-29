---
title: Test Article
description: This is an interesting test article
publishDate: 2024-01-01
tags:
  - test
---

# Test Article for Translation System

This is a placeholder article to test the English content collection.

When you build with `SILICONFLOW_API_KEY` environment variable set, all Chinese articles will be automatically translated and placed in this directory.

## How it works

1. During build, the translation integration scans all articles in `src/content/post/`
2. For each article, it checks if a cached translation exists
3. If not cached, it calls the SiliconFlow API (DeepSeek R1) to translate
4. The translated content is saved with a hash for cache validation
5. English pages render from the `postEn` collection

## Verification

Visit `/en/` to see the English version of the site.
