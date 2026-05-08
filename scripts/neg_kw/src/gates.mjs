function fail(gate, error) {
  return { ok: false, code: 2, gate, error };
}

export function validateRegisterGates({ flags, plan, planFileProvided, planFileExists }) {
  if (!flags.approve) {
    return fail(1, '--approve 필수');
  }
  if (!planFileProvided) {
    return fail(2, '--plan-file=output/03_register_plan_*.json 필수');
  }
  if (!planFileExists) {
    return fail(2, 'plan 파일 없음');
  }
  if (!plan || typeof plan !== 'object') {
    return fail(2, 'plan 파일 파싱 실패');
  }
  if (!plan.conflict_check || !Array.isArray(plan.conflict_check.protect_pattern_matched_kws_in_existing)) {
    return fail(2, 'plan.conflict_check.protect_pattern_matched_kws_in_existing 필드 누락. step4 재실행 필요.');
  }
  const expected = plan.confirm_text_required;
  const got = flags['confirm-text'];
  if (got !== expected) {
    return fail(3, `--confirm-text="${expected ?? ''}" 필수 (받은값: "${got ?? ''}")`);
  }
  if (!plan.approved_by) {
    return fail(3, 'plan.approved_by 누락 — step4를 --approved-by 와 함께 재실행');
  }
  return { ok: true };
}
