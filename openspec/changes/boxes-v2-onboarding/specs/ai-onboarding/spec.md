# AI Onboarding Specification

## Purpose

This spec covers the guided, AI-driven budget setup presented to new users
immediately after account confirmation. The goal is to replace static auto-seeding
with a personalized box structure co-designed through a conversational agent,
available on both web and WhatsApp channels.

## Requirements

### Requirement: No Auto-Seed on New Accounts

When a new user account is confirmed, the system MUST NOT automatically create
any boxes. The box list for a brand-new user MUST start empty.

#### Scenario: New account has no boxes

- GIVEN a user who just confirmed their account
- WHEN the box list is queried for that user
- THEN the response is an empty list

#### Scenario: Existing accounts are unaffected

- GIVEN a user whose account was created before this change (auto-seeded boxes exist)
- WHEN the box list is queried
- THEN their existing boxes are returned unchanged

---

### Requirement: Onboarding Completed Flag

The user record MUST have an `onboardingCompleted` boolean field (default `false`).
The flag MUST be set to `true` when the onboarding agent completes building the
user's box structure and validates the invariants. The flag MUST be readable by the
API so both web and WhatsApp channels can check it.

#### Scenario: Flag starts false for new users

- GIVEN a newly confirmed user
- WHEN the user profile is read
- THEN `onboardingCompleted = false`

#### Scenario: Flag is set after successful onboarding

- GIVEN a user with `onboardingCompleted = false`
- WHEN the onboarding agent finishes creating boxes and validates the structure
- THEN `onboardingCompleted` is set to `true`
- AND subsequent reads return `true`

#### Scenario: Onboarding is not re-triggered when flag is true

- GIVEN a user with `onboardingCompleted = true`
- WHEN the web or WhatsApp channel checks onboarding state
- THEN the onboarding flow MUST NOT be initiated again

---

### Requirement: Onboarding Is Resumable

If a user begins onboarding but does not complete it (session drop, app close,
network loss), the system MUST allow resuming from where it left off.
The agent MUST NOT recreate boxes that already exist.

#### Scenario: Partial onboarding resumes without duplicate boxes

- GIVEN a user with `onboardingCompleted = false` and 2 boxes already created during a prior session
- WHEN the user returns to the onboarding channel
- THEN the agent continues from the current state without deleting or duplicating the 2 existing boxes

---

### Requirement: Web Onboarding Flow

After account confirmation on web, the user MUST be presented with the AI onboarding
UI. When the onboarding agent finishes (all required boxes created and validated),
the web client MUST navigate the user into the agentic chat interface.

#### Scenario: Web onboarding → agentic chat transition

- GIVEN a new web user with `onboardingCompleted = false`
- WHEN the user confirms their account
- THEN the web app shows the onboarding UI (not the main dashboard)
- AND when the agent sets `onboardingCompleted = true`
- THEN the web app navigates to the agentic chat interface

#### Scenario: Completed user skips onboarding on web

- GIVEN a returning web user with `onboardingCompleted = true`
- WHEN they log in
- THEN they are taken directly to the main interface, not the onboarding UI

---

### Requirement: WhatsApp Onboarding Flow

After account confirmation on WhatsApp, the system MUST send a proactive starter
message that begins the guided box-building conversation. The entire onboarding
MUST be completable within the WhatsApp chat thread.

#### Scenario: Proactive starter message sent on confirmation

- GIVEN a new user who confirms their account via WhatsApp
- WHEN account confirmation is processed
- THEN the system sends a proactive, persuasive starter message inviting the user to set up their budget

#### Scenario: WhatsApp onboarding creates boxes in-chat

- GIVEN a WhatsApp user who has received the starter message
- WHEN the user provides income and expense details through the chat
- THEN the agent creates the corresponding fixed, percent, and fund boxes using existing agent tools
- AND when complete, sets `onboardingCompleted = true`

---

### Requirement: Conversational Box Creation via Agent Tools

During onboarding, the agent MUST create boxes by calling the existing agent tools
(`createBox`, etc.) — not through a separate code path. The conversation MUST cover:
income, fixed bills (→ fixed boxes), savings goals (→ fund boxes), and spending
categories (→ percent boxes).

The percent boxes created during onboarding MUST satisfy the 100% remainder invariant
before onboarding is considered complete.

#### Scenario: Agent creates all box types during onboarding

- GIVEN an onboarding conversation where the user specifies: income=4000, rent=1200 (fixed), savings=400 (fund), food=30% remainder, transport=20% remainder, other=50% remainder
- WHEN the agent processes the responses
- THEN `createBox` is called for each box with the correct mode and values
- AND percent boxes sum to 100% of remainder (4000 - 1200 - 400 = 2400; 30+20+50=100)

#### Scenario: Onboarding blocked until invariant satisfied

- GIVEN percent boxes summing to 95% during an onboarding session
- WHEN the agent attempts to mark onboarding complete
- THEN `onboardingCompleted` MUST NOT be set to `true`
- AND the agent informs the user that categories must sum to 100%
