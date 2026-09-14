/** The UnifyApps AI agent this app talks to (an `e_ai_agent` id).
 *
 * Kept in its own module because two very different screens need it — the Reports
 * workspace and the floating "Ask AI" overlay — and neither should have to import the
 * other to get at it. */
export const PLM_AGENT_ID = 'e_6aa6a450a4e8882e9a3d1ae0'
