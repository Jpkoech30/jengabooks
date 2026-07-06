# JengaBooks AI Agents

This document describes the 5 AI agents powering the JengaBooks platform, powered by DeepSeek V4.

## Agent Overview

| Agent | Model | Purpose | Cost Optimization |
|-------|-------|---------|-----------------|
| Reconciliation | V4 Pro (Thinking) | Map M-Pesa → Chart of Accounts | Cache hits on system prompts |
| Compliance | V4 Flash | Generate/validate eTIMS XML | Structured output mode |
| Fraud Detection | V4 Pro (Thinking) | Detect duplicates/outliers | Batch nightly processing |
| Advisory | V4 Flash | SMS/WhatsApp alerts | 160-char limit reduces tokens |
| HITL Resolution | V4 Flash | Auto-resolve simple conflicts | Only runs on DLQ items |

## Agent Architecture

```
User Input → BullMQ Queue → Agent Worker → Validation Layer → Postgres/HITL
                         ↓
                    Redis Cache
                    (Account IDs, Templates)
```

## Cost Management

- **V4 Pro**: $0.87/1M output tokens — used only for Reconciliation + Fraud
- **V4 Flash**: $0.28/1M output tokens — used for Compliance, Advisory, HITL
- **Cache Hit Discount**: 99.6% on input tokens with consistent system prompts

## Self-Healing Protocol

If an AI agent hallucinates or references a deleted account:
1. Auto-fallback to "Suspense Account"
2. Log error to `ai_feedback_logs`
3. Route original item to HITL Hub
4. Flag for fine-tuning dataset

## Validation Layer

Every AI output passes through:
- ✓ Account exists and is active
- ✓ Confidence > 0.7 threshold
- ✓ Amount is reasonable (not > 10x average)
- ✓ Date is in OPEN fiscal period
