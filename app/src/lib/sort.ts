/**
 * Natural sort for employee codes like "CDRF547", "R101", "R1038" — groups
 * by the letter prefix, then compares the numeric part as a number so
 * "R104" sorts near R101-R109 instead of after "R1038" (which a plain
 * string comparison gets wrong once digit counts differ).
 */
export function compareEmployeeCode(a: string, b: string): number {
  const parse = (code: string) => {
    const match = code.match(/^([A-Za-z]*)(\d*)(.*)$/);
    return {
      prefix: (match?.[1] ?? '').toUpperCase(),
      num: match?.[2] ? parseInt(match[2], 10) : null,
      rest: match?.[3] ?? '',
    };
  };
  const pa = parse(a);
  const pb = parse(b);
  if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix);
  if (pa.num !== pb.num) {
    if (pa.num === null) return -1;
    if (pb.num === null) return 1;
    return pa.num - pb.num;
  }
  return pa.rest.localeCompare(pb.rest);
}
