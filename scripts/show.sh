#!/bin/bash

for file in "$@"
do
  echo ""
  echo "════════════════════════════════════════════════════"
  echo "FILE: $file"
  echo "════════════════════════════════════════════════════"

  if [ -f "$file" ]; then
      echo "Lines: $(wc -l < "$file")"
      echo ""
      nl -ba "$file"
  else
      echo "❌ File not found"
  fi

  echo ""
done
