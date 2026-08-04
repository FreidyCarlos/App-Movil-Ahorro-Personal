export const MOBILE_ROUTES = {
  home: "/" as const,
  createGoal: "/new-goal" as const,
  data: "/data" as const,
  goalDetail: "/goal/[id]" as const,
  registerMovement: "/goal/[id]/register" as const,
};

export const MOBILE_PRIMARY_NAVIGATION = [
  MOBILE_ROUTES.home,
  MOBILE_ROUTES.createGoal,
  MOBILE_ROUTES.data,
] as const;
