/**
 * Identifies regions of an AsciiDoc document that would be skipped at render
 * time because their guard attribute is not defined. Used by the diagnostics
 * layer to suppress "Unresolved attribute" warnings inside disabled blocks.
 *
 * Recognised forms:
 *   ifdef::name[]       — included when `name` is defined
 *   ifndef::name[]      — included when `name` is NOT defined
 *   ifdef::a,b[]        — comma = OR
 *   ifdef::a+b[]        — plus = AND
 *   ifeval::[expr]      — included only when expr evaluates true; we treat
 *                         these as ALWAYS disabled (we don't evaluate exprs)
 *   endif::[]           — closes the most recent open block
 *
 * `ifeval::` is conservatively treated as disabled so attributes used inside
 * one don't trigger spurious warnings; this matches the expected pattern of
 * "feature gate that's off by default during validation".
 */

export interface DisabledRange {
  /** 1-based line number of the line immediately AFTER the opening conditional. */
  startLine: number;
  /** 1-based line number of the line immediately BEFORE the matching endif. */
  endLine: number;
}

const IFDEF = /^\s*if(n?)def::([^[]+)\[\s*\]\s*$/;
const IFEVAL = /^\s*ifeval::\s*\[/;
const ENDIF = /^\s*endif::([^[]*)\[\s*\]\s*$/;

interface OpenBlock {
  startLine: number;
  disabled: boolean;
}

export function findDisabledRanges(content: string, knownAttributeNames: ReadonlySet<string>): DisabledRange[] {
  const lines = content.split('\n');
  const stack: OpenBlock[] = [];
  const ranges: DisabledRange[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const line = lines[i];

    const ifdefMatch = line.match(IFDEF);
    if (ifdefMatch) {
      const negated = ifdefMatch[1] === 'n';
      const expression = ifdefMatch[2].trim();
      const definedByName = (name: string): boolean => knownAttributeNames.has(name);
      const evaluated = evaluateGuard(expression, definedByName);
      const disabled = negated ? evaluated : !evaluated;
      stack.push({ startLine: lineNumber + 1, disabled });
      continue;
    }

    if (IFEVAL.test(line)) {
      stack.push({ startLine: lineNumber + 1, disabled: true });
      continue;
    }

    if (ENDIF.test(line)) {
      const open = stack.pop();
      if (open && open.disabled) {
        ranges.push({ startLine: open.startLine, endLine: lineNumber - 1 });
      }
    }
  }

  return ranges;
}

/**
 * Evaluates a guard expression `a,b` (any) or `a+b` (all) against a
 * "defined?" predicate. Supports a single operator type per expression.
 */
function evaluateGuard(expression: string, isDefined: (name: string) => boolean): boolean {
  if (expression.includes(',')) {
    return expression.split(',').map((s) => s.trim()).filter(Boolean).some(isDefined);
  }
  if (expression.includes('+')) {
    return expression.split('+').map((s) => s.trim()).filter(Boolean).every(isDefined);
  }
  return isDefined(expression);
}

export function isLineWithinDisabledRange(line: number, ranges: DisabledRange[]): boolean {
  return ranges.some((range) => line >= range.startLine && line <= range.endLine);
}
