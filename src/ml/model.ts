/**
 * Explainable Predictive Baseline Model
 * RevenueShield AI (Phase 6 Prototype / Analytical Foundation)
 * 
 * Implements a clean, dependency-free regularized Logistic Regression model
 * with feature contribution explainability.
 * 
 * NOTE: This is a predictive analytical evaluation layer.
 * It does NOT overwrite or tamper with the canonical simulation probability.
 */

import { FEATURE_NAMES, RecoveryFeatureVector, vectorToNumericArray } from './features.ts';

export interface ModelExplanation {
  predictedProbability: number;
  topPositiveDrivers: { feature: string; contribution: number; description: string }[];
  topNegativeDrivers: { feature: string; contribution: number; description: string }[];
  summary: string;
}

export interface TrainedModelWeights {
  weights: number[]; // Length matches FEATURE_NAMES
  bias: number;
  featureMeans: number[];
  featureStds: number[];
}

/**
 * Sigmoid activation function
 */
function sigmoid(z: number): number {
  if (z >= 40) return 1.0;
  if (z <= -40) return 0.0;
  return 1.0 / (1.0 + Math.exp(-z));
}

export class RecoveryPredictorModel {
  private weights: number[];
  private bias: number;
  private featureMeans: number[];
  private featureStds: number[];

  constructor(trainedWeights?: TrainedModelWeights) {
    if (trainedWeights) {
      this.weights = [...trainedWeights.weights];
      this.bias = trainedWeights.bias;
      this.featureMeans = [...trainedWeights.featureMeans];
      this.featureStds = [...trainedWeights.featureStds];
    } else {
      // Default domain-heuristic initialization (calibrated prior)
      this.weights = [
        2.2,   // customerResponsePropensity (+)
        -0.05, // logRevenueAtRisk (slight friction on massive amounts)
        -0.45, // attemptCount (-)
        0.02,  // tenureMonths (+)
        0.10,  // isInsufficientFunds (recoverable)
        0.25,  // isBankTimeout (transient network glitch)
        -0.15, // isIssuerDeclined (stricter)
        0.30,  // isExpiredCard (highly recoverable upon card update)
        -0.40, // isCardBlocked (harder to fix)
        -0.20, // isUnknownCause
        0.20,  // isEnterprise (+)
        0.10,  // isMidMarket
        -0.05, // isStartup
        0.00,  // isSmb
      ];
      this.bias = -0.5;
      this.featureMeans = new Array(FEATURE_NAMES.length).fill(0);
      this.featureStds = new Array(FEATURE_NAMES.length).fill(1);
    }
  }

  /**
   * Fits model weights using Stochastic Gradient Descent (SGD) with L2 regularization
   * on normalized features.
   */
  public fit(trainingData: RecoveryFeatureVector[], epochs: number = 25, learningRate: number = 0.05, lambdaL2: number = 0.001): void {
    const validSamples = trainingData.filter(d => d.targetRecovered !== undefined);
    if (validSamples.length === 0) return;

    const n = validSamples.length;
    const numFeatures = FEATURE_NAMES.length;

    // 1. Calculate Feature Means and Standard Deviations for standardization
    const rawMatrix: number[][] = validSamples.map(d => vectorToNumericArray(d));
    this.featureMeans = new Array(numFeatures).fill(0);
    this.featureStds = new Array(numFeatures).fill(0);

    for (let j = 0; j < numFeatures; j++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += rawMatrix[i][j];
      this.featureMeans[j] = sum / n;

      let varSum = 0;
      for (let i = 0; i < n; i++) {
        const diff = rawMatrix[i][j] - this.featureMeans[j];
        varSum += diff * diff;
      }
      this.featureStds[j] = Math.sqrt(varSum / n) || 1.0;
    }

    // 2. Initialize weights
    this.weights = new Array(numFeatures).fill(0);
    this.bias = 0;

    // 3. Train via Mini-batch / SGD
    for (let epoch = 0; epoch < epochs; epoch++) {
      const lr = learningRate / (1 + 0.02 * epoch);

      for (let i = 0; i < n; i++) {
        const y = validSamples[i].targetRecovered!;
        // Standardize sample
        const xNorm = new Array(numFeatures);
        let z = this.bias;
        for (let j = 0; j < numFeatures; j++) {
          xNorm[j] = (rawMatrix[i][j] - this.featureMeans[j]) / this.featureStds[j];
          z += this.weights[j] * xNorm[j];
        }

        const p = sigmoid(z);
        const error = p - y;

        // Gradient update with L2 penalty
        this.bias -= lr * error;
        for (let j = 0; j < numFeatures; j++) {
          const grad = error * xNorm[j] + lambdaL2 * this.weights[j];
          this.weights[j] -= lr * grad;
        }
      }
    }
  }

  /**
   * Predicts recovery probability in [0, 1].
   */
  public predictProbability(fv: RecoveryFeatureVector): number {
    const raw = vectorToNumericArray(fv);
    let z = this.bias;
    for (let j = 0; j < FEATURE_NAMES.length; j++) {
      const std = this.featureStds[j] || 1.0;
      const xNorm = (raw[j] - (this.featureMeans[j] || 0)) / std;
      z += this.weights[j] * xNorm;
    }
    const prob = sigmoid(z);
    return Math.min(1.0, Math.max(0.0, prob));
  }

  /**
   * Generates a lightweight human-readable explainability report for a prediction.
   */
  public explain(fv: RecoveryFeatureVector): ModelExplanation {
    const prob = this.predictProbability(fv);
    const raw = vectorToNumericArray(fv);

    const contributions: { feature: string; contribution: number; description: string }[] = [];

    const featureDescriptions: Record<string, (val: number) => string> = {
      customerResponsePropensity: (v) => `Customer response propensity is ${(v * 100).toFixed(0)}%`,
      logRevenueAtRisk: (v) => `Amount at risk tier (log-scale: ${v.toFixed(1)})`,
      attemptCount: (v) => `${v} prior payment retry attempts`,
      tenureMonths: (v) => `${v} months of customer relationship history`,
      isInsufficientFunds: (v) => v ? 'Insufficient funds failure (re-solvable with balance/reminder)' : '',
      isBankTimeout: (v) => v ? 'Transient bank network timeout' : '',
      isIssuerDeclined: (v) => v ? 'Bank issuer policy decline' : '',
      isExpiredCard: (v) => v ? 'Expired card detected (high uplift upon payment method update)' : '',
      isCardBlocked: (v) => v ? 'Card reported blocked/inactive' : '',
      isUnknownCause: (v) => v ? 'Unspecified payment gateway error' : '',
      isEnterprise: (v) => v ? 'Enterprise customer tier' : '',
      isMidMarket: (v) => v ? 'Mid-market segment' : '',
      isStartup: (v) => v ? 'Startup tier' : '',
      isSmb: (v) => v ? 'SMB account' : '',
    };

    for (let j = 0; j < FEATURE_NAMES.length; j++) {
      const featName = FEATURE_NAMES[j];
      const std = this.featureStds[j] || 1.0;
      const xNorm = (raw[j] - (this.featureMeans[j] || 0)) / std;
      const contrib = this.weights[j] * xNorm;

      if (Math.abs(contrib) > 0.05) {
        const descFn = featureDescriptions[featName];
        const desc = descFn ? descFn(raw[j]) : `${featName}: ${raw[j]}`;
        if (desc) {
          contributions.push({
            feature: featName,
            contribution: Math.round(contrib * 100) / 100,
            description: desc,
          });
        }
      }
    }

    const topPositiveDrivers = contributions
      .filter(c => c.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3);

    const topNegativeDrivers = contributions
      .filter(c => c.contribution < 0)
      .sort((a, b) => a.contribution - b.contribution)
      .slice(0, 3);

    let summary = `Model predicts ${(prob * 100).toFixed(1)}% recovery likelihood.`;
    if (topPositiveDrivers.length > 0) {
      summary += ` Strong positive factor: ${topPositiveDrivers[0].description}.`;
    }
    if (topNegativeDrivers.length > 0) {
      summary += ` Primary friction: ${topNegativeDrivers[0].description}.`;
    }

    return {
      predictedProbability: Math.round(prob * 1000) / 1000,
      topPositiveDrivers,
      topNegativeDrivers,
      summary,
    };
  }

  public getWeights(): TrainedModelWeights {
    return {
      weights: [...this.weights],
      bias: this.bias,
      featureMeans: [...this.featureMeans],
      featureStds: [...this.featureStds],
    };
  }
}
