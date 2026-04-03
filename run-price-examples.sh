#!/usr/bin/env bash
set -euo pipefail

scripts=(
  src/price/scripts/token-rates.ts
  src/price/scripts/token-chart.ts
  src/price/scripts/chart-three-months.ts
  src/price/scripts/chart-six-months.ts
  src/price/scripts/chart-five-years.ts
  src/price/scripts/chart-all.ts
)

for script in "${scripts[@]}"; do
  echo "════════════════════════════════════════"
  echo "Running $script"
  echo "════════════════════════════════════════"
  npx tsx "$script"
  echo ""
done

echo "Done. Output files:"
ls -lh output/*.svg
