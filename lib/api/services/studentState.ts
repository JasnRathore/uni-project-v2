/* eslint-disable @typescript-eslint/no-explicit-any */

const normalizeLifecycleState = (value: unknown): 'active' | 'inactive' =>
  value === 'active' ? 'active' : 'inactive';

const isActiveStudent = (student: any): boolean =>
  student?.lifecycleState === 'active' || student?.lifecycle_state === 'active';

module.exports = { normalizeLifecycleState, isActiveStudent };
