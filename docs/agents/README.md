# Agent Operations Documentation

This documentation describes how 24Rabbit marketing agents behave once deployed. It covers the complete agent lifecycle, decision-making logic, and operational procedures.

## Overview

24Rabbit agents are autonomous background workers that:

1. **Monitor schedules** - Check for content generation triggers every 5 minutes
2. **Generate content** - Create platform-specific posts using AI with full Brand Profile context
3. **Manage approvals** - Route content through auto-approve or manual review workflows
4. **Publish posts** - Deliver content to connected social platforms
5. **Collect analytics** - Gather engagement metrics from published posts

## Architecture Principles

### Provider Agnosticism

Agents are designed with abstraction layers that allow swapping providers:

- **AI Adapter Interface** (`AIAdapter`) - Content generation and analysis can use any AI provider (Gemini is the default implementation, but Claude, GPT-4, Llama, etc. can be substituted)
- **Platform Connector Interface** (`PlatformConnector`) - Social platform publishing is abstracted per platform

### Brand Profile Context

All content generation is driven by the complete Brand Profile, which includes:

- Custom context (user instructions injected verbatim)
- Target audience definition
- Voice and tone configuration
- Language rules (words to use/avoid, emoji usage, hashtag style)
- Example posts for few-shot learning
- Platform-specific setting overrides

### Distributed Processing

Agents operate as BullMQ workers processing jobs from Redis queues:

- `content:analyze` - Material analysis jobs
- `content:generate` - Content generation jobs
- `post:publish` - Publishing jobs
- `analytics:collect` - Analytics collection jobs

## Documentation Index

| Document | Description |
|----------|-------------|
| [01-lifecycle.md](./01-lifecycle.md) | Agent lifecycle, states, and initialization |
| [02-content-generation.md](./02-content-generation.md) | Content generation behavior and decision logic |
| [03-approval-workflow.md](./03-approval-workflow.md) | Approval workflow rules and routing |
| [04-error-handling.md](./04-error-handling.md) | Error handling, retries, and recovery |

## Quick Reference

### Job Processing Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Max Retries | 3 | Attempts before job fails permanently |
| Backoff Strategy | Exponential | 1s → 2s → 4s delays between retries |
| Concurrency | 5 | Concurrent jobs per worker instance |
| Completed Retention | 24 hours | How long completed jobs are kept |
| Failed Retention | 7 days | How long failed jobs are kept |

### Similarity Thresholds

| Score Range | Classification | Action |
|-------------|---------------|--------|
| 0.0 - 0.70 | Unique | Proceed with content |
| 0.70 - 0.85 | Similar | Proceed with caution |
| 0.85 - 1.0 | Too Similar | Reject, select different material |

### Platform Rate Limits

| Platform | Daily Limit |
|----------|-------------|
| Twitter | 50 posts |
| Facebook | 50 posts |
| LinkedIn | 100 posts |

## Related Documentation

- [Architecture Overview](../architecture/01-architecture.md)
- [AI Processing](../architecture/02-ai-processing.md)
- [Scheduling System](../architecture/04-scheduling.md)
- [Data Model](../architecture/10-data-model.md)
