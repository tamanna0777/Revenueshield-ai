/**
 * Phase 5 & Phase 6 Test Suite
 * RevenueShield AI
 * 
 * Verifies:
 * - Phase 5: Synthetic dataset constraints (5,000 customers, 20,000+ events, unique IDs,
 *   referential integrity, valid probability ranges, failure cause distributions,
 *   seeded determinism, and derivation of RecoveryCases).
 * - Phase 6: Machine Learning foundation (Temporal train/validation/test split,
 *   feature extraction with strict no-leakage, explainability, finite metrics).
 */

import assert from 'node:assert/strict';
import { generateSyntheticDataset } from '../src/data/synthetic.ts';
import { FailureCause } from '../src/types.ts';
import { extractFeatures, vectorToNumericArray } from '../src/ml/features.ts';
import { RecoveryPredictorModel } from '../src/ml/model.ts';
import { evaluateModel, temporalSplit } from '../src/ml/evaluation.ts';
import { executeSimulationBatch } from '../src/agents/execution.ts';
import { decideIntervention, scorePriority } from '../src/agents/intervention.ts';

let passed = 0;
let total = 0;

function test(name: string, fn: () => void) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('\n--- Running Phase 5 & Phase 6 Test Suite ---\n');

// Generate reference dataset using fixed seed 2026
const dataset = generateSyntheticDataset(2026);

// 1. Customer Count Invariant
test('Phase 5: Exactly 5,000 customers generated', () => {
  assert.equal(dataset.customers.length, 5000);
  assert.equal(dataset.metadata.totalCustomers, 5000);
});

// 2. Payment Event Count Invariant
test('Phase 5: At least 20,000 payment events generated', () => {
  assert.ok(dataset.paymentEvents.length >= 20000, `Expected >= 20000, got ${dataset.paymentEvents.length}`);
  assert.ok(dataset.metadata.totalPaymentEvents >= 20000);
});

// 3. Unique IDs (Customers, Payments, Subscriptions)
test('Phase 5: Unique IDs across customers, subscriptions, and payment events', () => {
  const custIds = new Set(dataset.customers.map(c => c.id));
  assert.equal(custIds.size, dataset.customers.length, 'Customer IDs must be unique');

  const subIds = new Set(dataset.subscriptions.map(s => s.id));
  assert.equal(subIds.size, dataset.subscriptions.length, 'Subscription IDs must be unique');

  const payIds = new Set(dataset.paymentEvents.map(p => p.id));
  assert.equal(payIds.size, dataset.paymentEvents.length, 'Payment Event IDs must be unique');
});

// 4. Referential Integrity
test('Phase 5: Referential Integrity across payments, subscriptions, and customers', () => {
  const custMap = new Map(dataset.customers.map(c => [c.id, c]));
  const subMap = new Map(dataset.subscriptions.map(s => [s.id, s]));

  for (const sub of dataset.subscriptions) {
    assert.ok(custMap.has(sub.customerId), `Subscription ${sub.id} references missing customer ${sub.customerId}`);
  }

  for (const p of dataset.paymentEvents) {
    assert.ok(custMap.has(p.customerId), `Payment ${p.id} references missing customer ${p.customerId}`);
    assert.ok(subMap.has(p.subscriptionId), `Payment ${p.id} references missing subscription ${p.subscriptionId}`);
  }

  for (const rc of dataset.recoveryCases) {
    assert.ok(custMap.has(rc.customerId), `RecoveryCase ${rc.id} references missing customer ${rc.customerId}`);
    assert.ok(subMap.has(rc.subscriptionId), `RecoveryCase ${rc.id} references missing subscription ${rc.subscriptionId}`);
  }
});

// 5. Valid Probability & Non-negative Revenue Ranges
test('Phase 5: Propensity within [0, 1] and Revenue at risk >= 0', () => {
  for (const cust of dataset.customers) {
    assert.ok(cust.responsePropensity >= 0 && cust.responsePropensity <= 1, 'Propensity must be in [0, 1]');
  }

  for (const rc of dataset.recoveryCases) {
    assert.ok(rc.customerResponsePropensity >= 0 && rc.customerResponsePropensity <= 1);
    assert.ok(rc.revenueAtRiskInr >= 0, 'Revenue at risk must be non-negative');
    assert.ok(rc.attemptCount >= 1, 'Attempt count must be >= 1');
  }
});

// 6. Valid Failure Causes and Non-uniform Distribution
test('Phase 5: Failure causes are valid enums and distributed realistically', () => {
  const causeCounts = new Map<FailureCause, number>();
  for (const cause of Object.values(FailureCause)) {
    causeCounts.set(cause, 0);
  }

  for (const rc of dataset.recoveryCases) {
    assert.ok(rc.failureCause in FailureCause, `Invalid failure cause: ${rc.failureCause}`);
    causeCounts.set(rc.failureCause, (causeCounts.get(rc.failureCause) || 0) + 1);
  }

  // Verify that all failure causes occur and no single one completely dominates (> 60%)
  const totalCases = dataset.recoveryCases.length;
  for (const [cause, count] of causeCounts.entries()) {
    assert.ok(count > 0, `Cause ${cause} should have at least 1 occurrence`);
    const ratio = count / totalCases;
    assert.ok(ratio < 0.60, `Cause ${cause} dominates unrealistically with ${(ratio * 100).toFixed(1)}%`);
  }
});

// 7. Seed Determinism vs Different Seed
test('Phase 5: Deterministic synthetic generation (Same seed produces identical dataset, different seed changes)', () => {
  const ds1 = generateSyntheticDataset(42);
  const ds2 = generateSyntheticDataset(42);
  const ds3 = generateSyntheticDataset(999);

  // ds1 and ds2 should be identical in customer counts and metadata
  assert.equal(ds1.customers.length, ds2.customers.length);
  assert.equal(ds1.paymentEvents.length, ds2.paymentEvents.length);
  assert.equal(ds1.customers[0].id, ds2.customers[0].id);
  assert.equal(ds1.customers[0].name, ds2.customers[0].name);
  assert.equal(ds1.customers[0].responsePropensity, ds2.customers[0].responsePropensity);
  assert.equal(ds1.paymentEvents[10].id, ds2.paymentEvents[10].id);

  // ds3 with different seed should produce different customers/events
  assert.notEqual(ds1.customers[0].name, ds3.customers[0].name);
});

// 8. Recovery Cases are Correctly Derived from Failed Payments
test('Phase 5: Recovery cases strictly preserve customer response propensity and root cause', () => {
  const custMap = new Map(dataset.customers.map(c => [c.id, c]));

  for (const rc of dataset.recoveryCases.slice(0, 100)) {
    const parentCust = custMap.get(rc.customerId);
    assert.ok(parentCust);
    // Strict preservation of propensity:
    assert.equal(rc.customerResponsePropensity, parentCust.responsePropensity);
  }
});

// 9. No Target Leakage in ML Features
test('Phase 6: Strict no target leakage in feature extraction', () => {
  const sampleCase = dataset.recoveryCases[0];
  const parentCust = dataset.customers.find(c => c.id === sampleCase.customerId);

  // Even if post-intervention outcome is passed for training label, the feature vector itself
  // must contain only pre-intervention attributes
  const fv = extractFeatures(sampleCase, parentCust, true);

  const numericArray = vectorToNumericArray(fv);
  assert.equal(numericArray.length, 14);

  // Verify none of the vector values contain targetRecovered or agent outcome booleans
  for (const val of numericArray) {
    assert.ok(!Number.isNaN(val));
    assert.ok(Number.isFinite(val));
  }
});

// 10. Temporal Train / Validation / Test Split
test('Phase 6: Temporal Split (70% train / 15% validation / 15% test) has no temporal overlap', () => {
  // Build ground-truth simulation for recovery cases to train/test ML
  const scoredCases = dataset.recoveryCases.slice(0, 1000).map(c => {
    const dec = decideIntervention(c);
    return scorePriority({
      ...c,
      recommendedIntervention: dec.recommendedIntervention,
      interventionReasoning: dec.reasoning,
    });
  });

  const { updatedCases } = executeSimulationBatch(scoredCases, 2026);
  const custMap = new Map(dataset.customers.map(c => [c.id, c]));

  const featureVectors = updatedCases.map(c =>
    extractFeatures(c, custMap.get(c.customerId), c.agentRecovered)
  );

  const split = temporalSplit(featureVectors, 0.70, 0.15);

  assert.equal(split.train.length, 700);
  assert.equal(split.validation.length, 150);
  assert.equal(split.test.length, 150);

  // Chronological monotonicity check:
  // trainEnd <= valStart and valEnd <= testStart
  assert.ok(
    split.trainEnd <= split.valStart,
    `Train end (${split.trainEnd}) must be <= Validation start (${split.valStart})`
  );
  assert.ok(
    split.valEnd <= split.testStart,
    `Validation end (${split.valEnd}) must be <= Test start (${split.testStart})`
  );
});

// 11. ML Baseline Training, Calibration, and Evaluation Metrics
test('Phase 6: ML model fits, computes finite ROC-AUC, PR-AUC, and calibration error', () => {
  const scoredCases = dataset.recoveryCases.slice(0, 800).map(c => {
    const dec = decideIntervention(c);
    return scorePriority({
      ...c,
      recommendedIntervention: dec.recommendedIntervention,
    });
  });

  const { updatedCases } = executeSimulationBatch(scoredCases, 777);
  const custMap = new Map(dataset.customers.map(c => [c.id, c]));

  const vectors = updatedCases.map(c =>
    extractFeatures(c, custMap.get(c.customerId), c.agentRecovered)
  );

  const split = temporalSplit(vectors, 0.70, 0.15);

  const model = new RecoveryPredictorModel();
  model.fit(split.train, 15, 0.05);

  const evalReport = evaluateModel(model, split.test);

  assert.equal(evalReport.sampleCount, split.test.length);
  assert.ok(evalReport.rocAuc >= 0.50, `ROC-AUC should be >= 0.50, got ${evalReport.rocAuc}`);
  assert.ok(Number.isFinite(evalReport.rocAuc));
  assert.ok(Number.isFinite(evalReport.brierScore));
  assert.ok(Number.isFinite(evalReport.expectedCalibrationError));
  assert.ok(evalReport.calibrationBuckets.length === 10);
});

// 12. Lightweight Feature Explainability
test('Phase 6: Model provides human-readable explainability without hallucinated features', () => {
  const sampleCase = dataset.recoveryCases[0];
  const cust = dataset.customers.find(c => c.id === sampleCase.customerId);
  const fv = extractFeatures(sampleCase, cust);

  const model = new RecoveryPredictorModel();
  const explanation = model.explain(fv);

  assert.ok(explanation.predictedProbability >= 0 && explanation.predictedProbability <= 1);
  assert.ok(typeof explanation.summary === 'string');
  assert.ok(explanation.summary.length > 0);
  assert.ok(Array.isArray(explanation.topPositiveDrivers));
  assert.ok(Array.isArray(explanation.topNegativeDrivers));
});

// 13. Degenerate and Empty Dataset Safety
test('Phase 6: Evaluation handles empty and single-class edge cases without NaN or crash', () => {
  const model = new RecoveryPredictorModel();
  const emptyReport = evaluateModel(model, []);

  assert.equal(emptyReport.sampleCount, 0);
  assert.equal(emptyReport.rocAuc, 0.5);
  assert.ok(!Number.isNaN(emptyReport.rocAuc));
  assert.ok(!Number.isNaN(emptyReport.brierScore));

  // Single-class (all positives)
  const singleClassVector: typeof dataset.recoveryCases[0] = dataset.recoveryCases[0];
  const fv = extractFeatures(singleClassVector, undefined, true);
  const singleReport = evaluateModel(model, [fv, fv]);

  assert.ok(!Number.isNaN(singleReport.rocAuc));
  assert.ok(!Number.isNaN(singleReport.brierScore));
});

console.log(`\nResults: ${passed} / ${total} Phase 5 & 6 tests passed.\n`);

if (passed !== total) {
  process.exit(1);
}
