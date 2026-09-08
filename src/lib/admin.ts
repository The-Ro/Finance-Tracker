// Single hardcoded admin -- this app has exactly one operator, so an email
// check is simpler and safer than introducing a role/permissions system for
// one person. Mirrored server-side in supabase/policies.sql's
// feedback_select_admin / feedback_update_admin_reply policies -- this
// constant controls what the UI shows, RLS controls what's actually
// enforced, and the two must be kept in sync by hand.
export const ADMIN_EMAIL = 'rohith24112@gmail.com'
