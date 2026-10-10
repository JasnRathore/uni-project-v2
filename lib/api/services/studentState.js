const normalizeLifecycleState = value =>
  value === 'active' ? 'active' : 'inactive';

const isActiveStudent = student =>
  student?.lifecycleState === 'active' || student?.lifecycle_state === 'active';

module.exports = { normalizeLifecycleState, isActiveStudent };
