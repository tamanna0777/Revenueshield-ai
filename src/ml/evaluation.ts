/**
 * Machine Learning Evaluation & Temporal Validation Engine
 * RevenueShield AI (Phase 6 Prototype / Analytical Foundation)
 * 
 * Implements:
 * 1. Strict Temporal Train / Validation / Test Split (70% / 15% / 15%)
 * 2. ROC-AUC calculation (trapezoidal integration)
 * 3. PR-AUC calculation (Average Precision)
 * 4. Brier Score & Expected Calibration Error (ECE)
 * 5. Precision, Recall, and F1 score at optimal/default threshold
 * 6. Edge-case safety: Zero-positive/zero-negative datasets handled safely without NaN or Infinity.
 */

import { RecoveryFeatureVector } from './features.ts';
import { RecoveryPredictorModel } from './model.ts';

export interface TemporalSplitResult {
  train: RecoveryFeatureVector[];
  validation: RecoveryFeatureVector[];
  test: RecoveryFeatureVector[];
  trainStart: string;
  trainEnd: string;
  valStart: string;
  valEnd: string;
  testStart: string;
  testEnd: string;
}

export interface CalibrationBucket {
  bucketIndex: number;
  minPred: number;
  maxPred: number;
  count: number;
  avgPredicted: number;
  actualPositiveRate: number;
}

export interface ModelEvaluationReport {
  sampleCount: number;
  positiveCount: number;
  negativeCount: number;
  rocAuc: number;
  prAuc: number;
  brierScore: number;
  expectedCalibrationError: number;
  threshold: number;
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  calibrationBuckets: CalibrationBucket[];
}

/**
 * Splits dataset chronologically into Train (70%), Validation (15%), and Test (15%).
 * Strictly ensures no temporal overlap (train < validation < test).
 */
export function temporalSplit(
  vectors: RecoveryFeatureVector[],
  trainRatio: number = 0.70,
  valRatio: number = 0.15
): TemporalSplitResult {
  if (vectors.length === 0) {
    return {
      train: [],
      validation: [],
      test: [],
      trainStart: '',
      trainEnd: '',
      valStart: '',
      valEnd: '',
      testStart: '',
      testEnd: '',
    };
  }

  // Sort strictly by event timestamp
  const sorted = [...vectors].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const n = sorted.length;
  const trainIdx = Math.floor(n * trainRatio);
  const valIdx = Math.floor(n * (trainRatio + valRatio));

  const train = sorted.slice(0, trainIdx);
  const validation = sorted.slice(trainIdx, valIdx);
  const test = sorted.slice(valIdx);

  return {
    train,
    validation,
    test,
    trainStart: train[0]?.timestamp ?? '',
    trainEnd: train[train.length - 1]?.timestamp ?? '',
    valStart: validation[0]?.timestamp ?? '',
    valEnd: validation[validation.length - 1]?.timestamp ?? '',
    testStart: test[0]?.timestamp ?? '',
    testEnd: test[test.length - 1]?.timestamp ?? '',
  };
}

/**
 * Evaluates model predictions against ground truth binary outcomes.
 */
export function evaluateModel(
  model: RecoveryPredictorModel,
  testSamples: RecoveryFeatureVector[],
  threshold: number = 0.50
): ModelEvaluationReport {
  const validSamples = testSamples.filter(s => s.targetRecovered !== undefined);

  if (validSamples.length === 0) {
    return {
      sampleCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      rocAuc: 0.5,
      prAuc: 0.0,
      brierScore: 0.0,
      expectedCalibrationError: 0.0,
      threshold,
      precision: 0.0,
      recall: 0.0,
      f1Score: 0.0,
      accuracy: 0.0,
      calibrationBuckets: [],
    };
  }

  const n = validSamples.length;
  const predictions: { yTrue: number; yPred: number }[] = [];
  let posCount = 0;
  let negCount = 0;
  let brierSum = 0;

  for (const s of validSamples) {
    const yTrue = s.targetRecovered!;
    const yPred = model.predictProbability(s);
    predictions.push({ yTrue, yPred });

    if (yTrue === 1) posCount++;
    else negCount++;

    const diff = yPred - yTrue;
    brierSum += diff * diff;
  }

  const brierScore = Math.round((brierSum / n) * 10000) / 10000;

  // Compute Confusion Matrix at threshold
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (const p of predictions) {
    const predBinary = p.yPred >= threshold ? 1 : 0;
    if (predBinary === 1 && p.yTrue === 1) tp++;
    else if (predBinary === 1 && p.yTrue === 0) fp++;
    else if (predBinary === 0 && p.yTrue === 1) fn++;
    else tn++;
  }

  const precision = (tp + fp) > 0 ? Math.round((tp / (tp + fp)) * 1000) / 1000 : 0;
  const recall = (tp + fn) > 0 ? Math.round((tp / (tp + fn)) * 1000) / 1000 : 0;
  const f1Score = (precision + recall) > 0 ? Math.round((2 * precision * recall / (precision + recall)) * 1000) / 1000 : 0;
  const accuracy = n > 0 ? Math.round(((tp + tn) / n) * 1000) / 1000 : 0;

  // Compute ROC-AUC & PR-AUC via ranking
  let rocAuc = 0.5;
  let prAuc = posCount / n;

  if (posCount > 0 && negCount > 0) {
    // Sort descending by predicted score
    const sorted = [...predictions].sort((a, b) => b.yPred - a.yPred);

    // Trapezoidal ROC-AUC
    let fpPrev = 0;
    let tpPrev = 0;
    let aucRocSum = 0;
    let aucPrSum = 0;

    let currentFp = 0;
    let currentTp = 0;

    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].yTrue === 1) currentTp++;
      else currentFp++;

      // Compute step if next item has different score or is at end
      if (i === sorted.length - 1 || sorted[i + 1].yPred !== sorted[i].yPred) {
        // Trapezoid for ROC
        aucRocSum += (currentFp - fpPrev) * (currentTp + tpPrev) / 2;

        // Precision-Recall integration
        const precAtStep = currentTp / (currentTp + currentFp);
        const recallDiff = (currentTp - tpPrev) / posCount;
        aucPrSum += precAtStep * recallDiff;

        fpPrev = currentFp;
        tpPrev = currentTp;
      }
    }

    rocAuc = Math.round((aucRocSum / (posCount * negCount)) * 1000) / 1000;
    prAuc = Math.round(aucPrSum * 1000) / 1000;
  }

  // Compute Calibration Buckets (10 deciles)
  const numBuckets = 10;
  const bucketCounts = new Array(numBuckets).fill(0);
  const bucketPredSums = new Array(numBuckets).fill(0);
  const bucketPosCounts = new Array(numBuckets).fill(0);

  for (const p of predictions) {
    const bIdx = Math.min(numBuckets - 1, Math.floor(p.yPred * numBuckets));
    bucketCounts[bIdx]++;
    bucketPredSums[bIdx] += p.yPred;
    if (p.yTrue === 1) bucketPosCounts[bIdx]++;
  }

  const calibrationBuckets: CalibrationBucket[] = [];
  let eceSum = 0;

  for (let b = 0; b < numBuckets; b++) {
    const count = bucketCounts[b];
    const minPred = b / numBuckets;
    const maxPred = (b + 1) / numBuckets;
    const avgPred = count > 0 ? bucketPredSums[b] / count : (minPred + maxPred) / 2;
    const actualRate = count > 0 ? bucketPosCounts[b] / count : 0;

    calibrationBuckets.push({
      bucketIndex: b,
      minPred,
      maxPred,
      count,
      avgPredicted: Math.round(avgPred * 1000) / 1000,
      actualPositiveRate: Math.round(actualRate * 1000) / 1000,
    });

    if (count > 0) {
      eceSum += (count / n) * Math.abs(avgPred - actualRate);
    }
  }

  const expectedCalibrationError = Math.round(eceSum * 1000) / 1000;

  return {
    sampleCount: n,
    positiveCount: posCount,
    negativeCount: negCount,
    rocAuc,
    prAuc,
    brierScore,
    expectedCalibrationError,
    threshold,
    precision,
    recall,
    f1Score,
    accuracy,
    calibrationBuckets,
  };
}
