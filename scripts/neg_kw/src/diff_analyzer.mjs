export function flattenProtectPatterns(protectConfig) {
  if (!protectConfig?.categories) return [];
  return protectConfig.categories.flatMap((c) => (c.patterns || []).map((p) => ({ pattern: p, category: c.name })));
}

export function matchProtect(keyword, flatPatterns) {
  if (typeof keyword !== 'string') return [];
  return flatPatterns.filter(({ pattern }) => keyword.includes(pattern));
}

export function analyzeGroup(group, flatPatterns, newKwSet) {
  const kept = [];
  const removable = [];
  const dupes = [];
  const conflicts = [];

  for (const kw of group.current_neg_kws || []) {
    const hits = matchProtect(kw.keyword, flatPatterns);
    if (hits.length) {
      const patterns_matched = hits.map((h) => h.pattern);
      const categories = hits.map((h) => h.category);
      kept.push({ ...kw, protect_categories: categories, patterns_matched });
      conflicts.push({ ...kw, patterns_matched, categories });
    } else if (newKwSet.has(kw.keyword)) {
      dupes.push(kw);
    } else {
      removable.push(kw);
    }
  }

  return {
    idx: group.idx,
    campaign: group.campaign,
    group: group.group,
    nccAdgroupId: group.nccAdgroupId,
    high_cost: group.high_cost,
    existing_count: (group.current_neg_kws || []).length,
    to_keep: kept,
    duplicate_with_new: dupes,
    to_remove_safe: removable,
    conflict_kws: conflicts,
  };
}
