# 🚀 RevenueShield AI

> Autonomous AI-Powered Revenue Recovery Platform for Failed Digital Payments

[![Razorpay AI Builder Internship 2026](https://img.shields.io/badge/Razorpay-AI%20Builder%202026-blue)](#)
[![React](https://img.shields.io/badge/React-19-blue)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](#)
[![Node.js](https://img.shields.io/badge/Node.js-Backend-green)](#)
[![AI Powered](https://img.shields.io/badge/AI-Powered-orange)](#)

---

## 🌐 Live Demo

**Netlify Deployment**

https://tranquil-cactus-3b3555.netlify.app

---

## 🎥 Demo Video

**Project Demonstration (5 Minutes)**

https://drive.google.com/file/d/15Pbl64CnXJ2NdBg2exGvx5SOBVH8V7Bj/view?usp=sharing

---

# 📌 Problem Statement

Digital businesses lose significant revenue due to failed subscription renewals, declined payments, expired cards, insufficient balances, and payment gateway issues.

Current recovery processes are:

- Reactive
- Manual
- Non-prioritized
- Difficult to audit
- Expensive to operate

Businesses often treat every failed payment equally, resulting in poor recovery rates and unnecessary operational effort.

RevenueShield AI solves this challenge through an autonomous AI-driven recovery workflow that:

- Detects payment failures
- Diagnoses root causes
- Predicts recovery probability
- Prioritizes cases based on business impact
- Selects optimal intervention strategies
- Enforces policy guardrails
- Maintains complete audit trails
- Generates customer communication automatically

---

# 🎯 Project Objective

RevenueShield AI helps businesses recover lost revenue intelligently and transparently.

The platform:

- Predicts which failed payments are recoverable
- Prioritizes high-value recovery opportunities
- Automates intervention planning
- Enforces governance and approval workflows
- Maintains explainable AI decisions
- Generates recovery communications in real time

---

# 🏗️ System Architecture

Payment Failure Event
        ↓
Detection Engine
        ↓
Diagnosis Engine
        ↓
Recovery Probability Model
        ↓
Priority Scoring Engine
        ↓
Intervention Planner
        ↓
Policy Guardrails
        ↓
Approval Workflow
        ↓
Execution Engine
        ↓
Email / Recovery Action
        ↓
Audit Trail & Analytics

---

# ✨ Core Features

## 1. Intelligent Failure Diagnosis

Analyzes payment failure reasons such as:

- Insufficient Balance
- Expired Card
- Bank Decline
- UPI Failure
- Payment Gateway Failure
- Subscription Cancellation Risk

Provides explainable reasoning for every classification.

---

## 2. Recovery Probability Prediction

Uses machine learning-inspired scoring models to estimate:

- Likelihood of successful recovery
- Customer recovery potential
- Future payment success probability

Output:

- Recovery Score
- Recovery Probability (%)

---

## 3. AI Priority Scoring

Ranks recovery opportunities using:

- Revenue at Risk
- Recovery Probability
- Customer Value
- Failure Severity

Helps operations teams focus on the highest-impact cases first.

---

## 4. Autonomous Intervention Planning

Automatically recommends actions such as:

### Smart Retry

Retry payment at optimized times.

### Payment Link

Send instant recovery payment links.

### Discount Offer

Provide targeted incentives.

### Escalation

Escalate high-value accounts for manual review.

### No Action

Avoid wasting resources on low-probability cases.

---

## 5. Policy Guardrails

Ensures every decision complies with business rules.

Examples:

- Retry limits
- Approval thresholds
- Risk restrictions
- Recovery caps
- Compliance constraints

---

## 6. Human Approval Workflow

For sensitive actions, RevenueShield AI introduces:

### Pending Approval

Decision waiting for review.

### Approved

Ready for execution.

### Rejected

Blocked by governance policy.

This ensures AI remains controllable and transparent.

---

## 7. Audit Trail Engine

Every decision creates an immutable audit record containing:

- Timestamp
- Case ID
- Event ID
- Recovery Action
- Policy Decision
- Outcome
- Attribution
- Approval Status

Benefits:

- Compliance
- Governance
- Explainability
- Accountability

---

## 8. Email Recovery Automation

Integrated with:

- Resend Email API

Automatically generates customer-facing communications for:

- Payment Recovery
- Payment Retry
- Discount Offers
- Escalation Notices

Email notifications are triggered in real time.

---

## 9. Razorpay Webhook Integration

Supports:

- Test Mode Simulation
- Payment Failure Events
- Recovery Event Generation

Enables end-to-end recovery demonstrations.

---

## 10. Analytics Dashboard

Provides visibility into:

### Revenue Recovery Metrics

- Revenue at Risk
- Revenue Recovered
- Recovery Rate

### Operational Metrics

- Cases Processed
- Interventions Executed
- Approval Statistics

### AI Metrics

- Recovery Probability Distribution
- Failure Cause Distribution
- Intervention Effectiveness

---

# 📊 Dashboard Sections

## Overview Dashboard

Executive summary of:

- Revenue at Risk
- Active Cases
- Recovery Opportunities
- System Status

---

## Analytics & Econometric Lift

Measures impact generated by AI recommendations.

Tracks:

- Recovery performance
- Intervention effectiveness
- Revenue improvements

---

## Audit Trail

Complete history of AI decisions and actions.

---

## Email Templates

Preview customer communications before delivery.

---

## Guardrails

Business rule management layer.

---

## Demo Guides

Interactive walkthrough for judges and evaluators.

---

## Razorpay Simulator

Allows simulation of payment failures and recovery scenarios.

---

# 🧠 AI Components

RevenueShield AI contains multiple specialized AI agents:

### Diagnosis Agent

Identifies payment failure causes.

### Probability Agent

Predicts recovery likelihood.

### Intervention Agent

Chooses optimal recovery strategy.

### Policy Agent

Validates business rules.

### Execution Agent

Executes approved actions.

### Audit Agent

Records all decisions.

---

# 🛠️ Technology Stack

## Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Recharts

## Backend

- Node.js
- Express

## AI Layer

- Google AI Studio
- Agent-Based Decision Pipeline

## Communication

- Resend Email API

## Payments

- Razorpay Test Integration

---

# ⚙️ Local Setup

## Prerequisites

- Node.js 18+
- npm

---

## Installation

Clone repository:

```bash
git clone https://github.com/tamanna0777/Revenueshield-ai.git

cd Revenueshield-ai
```

Install dependencies:

```bash
npm install
```

---

## Environment Variables

Create a `.env` file:

```env
RESEND_API_KEY=your_resend_api_key

RAZORPAY_KEY_ID=your_key_id

RAZORPAY_KEY_SECRET=your_secret

RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

---

## Run Development Server

```bash
npm run dev
```

Application starts at:

```text
http://localhost:3000
```

---

## Build Production Version

```bash
npm run build
```

---

## Run Tests

```bash
npm test
```

---

# 📂 Project Structure

```text
src/
│
├── agents/
│   ├── audit.ts
│   ├── execution.ts
│   ├── intervention.ts
│   ├── ledger.ts
│   ├── policy.ts
│   └── probability.ts
│
├── components/
│   └── dashboard/
│
├── services/
│
├── ml/
│
├── data/
│
├── utils/
│
└── tests/
```

---

# 🔒 Security & Governance

RevenueShield AI enforces:

- Auditability
- Explainability
- Human Oversight
- Policy Enforcement
- Kill Switch Controls
- Approval Workflows
- Secret Protection Rules

No API secrets are stored in audit records.

---

# 🚀 Future Enhancements

- Real Razorpay Production Integration
- WhatsApp Recovery Automation
- SMS Recovery Automation
- Adaptive ML Training
- Multi-Gateway Support
- A/B Intervention Testing
- Recovery Optimization Engine

---

# 👩‍💻 Developer

**Tamanna Shaikh**

Razorpay AI Builder Internship 2026

---

# 🏁 Final Note

RevenueShield AI demonstrates how autonomous AI systems can transform failed payment recovery from a manual operational task into an intelligent, explainable, policy-compliant, and revenue-generating workflow.

By combining AI decision-making, governance controls, auditability, and real-time recovery automation, RevenueShield AI helps businesses maximize recovered revenue while maintaining trust, transparency, and operational efficiency.
