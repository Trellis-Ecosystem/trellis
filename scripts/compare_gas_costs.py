#!/usr/bin/env python3
"""
Compare gas costs between baseline and current benchmark runs.

Usage:
    python compare_gas_costs.py baseline.json current.json [--threshold 10]

Exit codes:
    0 - No significant regressions
    1 - Regressions detected above threshold
"""

import json
import sys
from typing import Dict, List, Tuple

def load_benchmarks(filepath: str) -> Dict[str, Dict[str, int]]:
    """Load benchmark JSON array into a dict keyed by benchmark name."""
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    return {
        entry['benchmark']: {
            'cpu_instructions': entry['cpu_instructions'],
            'memory_bytes': entry['memory_bytes']
        }
        for entry in data
    }

def compare_costs(
    baseline: Dict[str, Dict[str, int]],
    current: Dict[str, Dict[str, int]],
    threshold: float = 10.0
) -> Tuple[bool, List[str]]:
    """
    Compare current costs against baseline.
    
    Args:
        baseline: Baseline benchmark results
        current: Current benchmark results
        threshold: Regression threshold percentage (default 10%)
    
    Returns:
        (has_regressions, messages)
    """
    messages = []
    has_regressions = False
    
    messages.append("Gas Cost Comparison Report")
    messages.append("=" * 70)
    messages.append("")
    
    for name in sorted(current.keys()):
        if name not in baseline:
            messages.append(f"⚠️  {name}: NEW BENCHMARK (no baseline)")
            continue
        
        base_cpu = baseline[name]['cpu_instructions']
        curr_cpu = current[name]['cpu_instructions']
        base_mem = baseline[name]['memory_bytes']
        curr_mem = current[name]['memory_bytes']
        
        cpu_change = ((curr_cpu - base_cpu) / base_cpu) * 100 if base_cpu > 0 else 0
        mem_change = ((curr_mem - base_mem) / base_mem) * 100 if base_mem > 0 else 0
        
        cpu_symbol = "📈" if cpu_change > threshold else "📉" if cpu_change < -5 else "➡️"
        mem_symbol = "📈" if mem_change > threshold else "📉" if mem_change < -5 else "➡️"
        
        messages.append(f"{name}:")
        messages.append(f"  CPU: {base_cpu:,} → {curr_cpu:,} ({cpu_change:+.1f}%) {cpu_symbol}")
        messages.append(f"  MEM: {base_mem:,} → {curr_mem:,} ({mem_change:+.1f}%) {mem_symbol}")
        
        if cpu_change > threshold or mem_change > threshold:
            messages.append(f"  ❌ REGRESSION DETECTED (threshold: {threshold}%)")
            has_regressions = True
        
        messages.append("")
    
    # Check for removed benchmarks
    for name in baseline.keys():
        if name not in current:
            messages.append(f"⚠️  {name}: REMOVED (was in baseline)")
            messages.append("")
    
    if has_regressions:
        messages.append("=" * 70)
        messages.append(f"❌ Gas cost regressions detected above {threshold}% threshold")
    else:
        messages.append("=" * 70)
        messages.append("✅ No significant gas cost regressions")
    
    return has_regressions, messages

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    
    baseline_file = sys.argv[1]
    current_file = sys.argv[2]
    threshold = float(sys.argv[3]) if len(sys.argv) > 3 else 10.0
    
    try:
        baseline = load_benchmarks(baseline_file)
        current = load_benchmarks(current_file)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        sys.exit(1)
    
    has_regressions, messages = compare_costs(baseline, current, threshold)
    
    for msg in messages:
        print(msg)
    
    sys.exit(1 if has_regressions else 0)

if __name__ == '__main__':
    main()
