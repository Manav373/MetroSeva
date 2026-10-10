"""
Golden Set Evaluation Runner.
Evaluates TriagePipeline performance:
- Overall Department Accuracy (Target >= 85%)
- Per-class Precision, Recall, F1
- Safety Recall Gate (Target >= 98%) - MUST PASS
"""

import json
import os
import sys
import time

# Ensure ml package is on PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ml.triage_engine import TriagePipeline


def run_evaluation(data_path: str = None):
    if data_path is None:
        curr_dir = os.path.dirname(os.path.abspath(__file__))
        data_path = os.path.join(curr_dir, "..", "data", "golden_dataset.json")

    with open(data_path, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    pipeline = TriagePipeline()
    total = len(dataset)
    print(f"\n=======================================================")
    print(f"  METRO COMPLAINT TRIAGE ENGINE (CTE) - EVALUATION")
    print(f"=======================================================")
    print(f"Dataset: {data_path} ({total} samples across gu, hi, en, gu-latn)\n")

    start_time = time.time()
    results = []

    for idx, item in enumerate(dataset):
        text = item["text"]
        expected_dept = item["expected_dept"]
        expected_priority = item.get("expected_priority")
        
        pred = pipeline.process(raw_text=text, station_id="TEST_STATION", channel="test")
        
        results.append({
            "text": text,
            "lang": item.get("lang"),
            "expected_dept": expected_dept,
            "predicted_dept": pred["dept_primary"],
            "expected_priority": expected_priority,
            "predicted_priority": pred["priority"],
            "urgency": pred["urgency"],
            "is_safety_floor": pred["priority"] == "P1" and pred["dept_primary"] == "safety"
        })

    elapsed_ms = (time.time() - start_time) * 1000
    latency_per_item = elapsed_ms / total

    # Metrics calculation
    departments = ["safety", "cleanliness", "fare", "lifts_escalators", "staff_behaviour", "other"]
    
    tp = {d: 0 for d in departments}
    fp = {d: 0 for d in departments}
    fn = {d: 0 for d in departments}
    support = {d: 0 for d in departments}

    correct_dept_count = 0
    safety_expected_count = 0
    safety_caught_count = 0

    for r in results:
        exp = r["expected_dept"]
        pred = r["predicted_dept"]
        support[exp] += 1

        if exp == pred:
            tp[exp] += 1
            correct_dept_count += 1
        else:
            fp[pred] += 1
            fn[exp] += 1

        if exp == "safety":
            safety_expected_count += 1
            # Did safety rule or classifier catch it as safety / P1?
            if r["predicted_priority"] == "P1" and r["predicted_dept"] == "safety":
                safety_caught_count += 1

    overall_accuracy = correct_dept_count / total
    safety_recall = (safety_caught_count / safety_expected_count) if safety_expected_count > 0 else 0.0

    print(f"{'Department':<20} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10} | {'Support':<8}")
    print("-" * 68)

    for d in departments:
        prec = tp[d] / (tp[d] + fp[d]) if (tp[d] + fp[d]) > 0 else 0.0
        rec = tp[d] / (tp[d] + fn[d]) if (tp[d] + fn[d]) > 0 else 0.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
        print(f"{d:<20} | {prec:<10.1%} | {rec:<10.1%} | {f1:<10.1%} | {support[d]:<8}")

    print("-" * 68)
    print(f"Overall Department Accuracy : {overall_accuracy:.1%} (Target >= 85.0%)")
    print(f"Average Processing Latency   : {latency_per_item:.2f} ms/complaint (Budget < 300 ms)")
    print(f"\n=======================================================")
    print(f"  CRITICAL SAFETY GATE RESULT:")
    print(f"  SAFETY RECALL: {safety_recall:.2%}  ({safety_caught_count}/{safety_expected_count} safety hazards detected)")
    print(f"=======================================================")

    if safety_recall >= 0.98:
        print(">>> SUCCESS: Safety Recall meets and exceeds the >= 98.0% mission-critical threshold! <<<\n")
        return True
    else:
        print(">>> FAILED: Safety Recall fell below 98.0%! Safety rules require hardening. <<<\n")
        return False


if __name__ == "__main__":
    success = run_evaluation()
    if not success:
        sys.exit(1)
